-- Radar MEL v2 — privacidade da distância (P0 da auditoria funcional de 2026-10-30).
--
-- Antes: private.match_score recebia os pontos EXATOS (último local visto do
-- tutor e local de quem encontrou) e devolvia reasons.distance_m em metros,
-- além de uma pontuação contínua na distância (35 × (1 − d/10 km), ~1 ponto a
-- cada 286 m). get_my_matches entrega os dois aos dois lados: com alguns
-- "encontrados" em pontos diferentes dava para triangular o ponto privado.
--
-- Agora TUDO o que o Radar decide ou devolve — existência da correspondência,
-- pontuação e distância — usa só os pontos PÚBLICOS (centro da célula de 250 m,
-- os mesmos do mapa). Dois pontos privados na mesma célula produzem respostas
-- idênticas: nada sai do banco além do que já é público. A distância vira faixa
-- (NEAR ≤ 1 km, MEDIUM ≤ 3 km, AREA ≤ 10 km) e a pontuação usa um degrau por faixa.
-- Espelho: computeMatchScore (packages/core/src/found/match.ts).

-- Os parâmetros *_lat/*_lng continuam com o mesmo nome (create or replace não
-- renomeia), mas quem chama passa os pontos PÚBLICOS.
create or replace function private.match_score(
  l_species public.species, l_size public.pet_size, l_sex public.pet_sex, l_color text, l_colors text[], l_breed text,
  l_lat double precision, l_lng double precision, l_lost_at timestamptz,
  f_species public.species, f_size public.pet_size, f_sex public.pet_sex, f_color text, f_colors text[], f_breed text,
  f_lat double precision, f_lng double precision, f_found_at timestamptz
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  sizes constant text[] := array['mini', 'small', 'medium', 'large', 'giant'];
  -- Haversine (igual ao TypeScript, para a paridade ser exata), entre pontos públicos.
  d double precision := 2 * 6371008.8 * asin(least(1, sqrt(
    sin(radians(f_lat - l_lat) / 2) ^ 2 +
    cos(radians(l_lat)) * cos(radians(f_lat)) * sin(radians(f_lng - l_lng) / 2) ^ 2)));
  days double precision := extract(epoch from (f_found_at - l_lost_at)) / 86400.0;
  score int := 0;
  r_distance text; r_size text; r_sex text; r_color text; r_breed text;
  diff int;
begin
  if l_species is distinct from f_species or d is null or d > 10000 or days < -1 or days > 60 then
    return null;
  end if;
  -- Degrau por faixa: a pontuação não carrega mais distância do que a própria faixa.
  if d <= 1000 then r_distance := 'NEAR'; score := 35;
  elsif d <= 3000 then r_distance := 'MEDIUM'; score := 22;
  else r_distance := 'AREA'; score := 10; end if;
  score := score + round(15 * greatest(0, 1 - greatest(days, 0) / 30.0))::int;

  if l_size is null or f_size is null then r_size := 'unknown'; score := score + 2;
  else
    diff := abs(array_position(sizes, l_size::text) - array_position(sizes, f_size::text));
    if diff = 0 then r_size := 'same'; score := score + 15;
    elsif diff = 1 then r_size := 'close'; score := score + 7;
    else r_size := 'different'; end if;
  end if;

  if l_sex = 'unknown' or f_sex = 'unknown' then r_sex := 'unknown'; score := score + 2;
  elsif l_sex = f_sex then r_sex := 'same'; score := score + 10;
  else r_sex := 'different'; score := score - 15; end if;

  if l_color is null or f_color is null then r_color := 'unknown'; score := score + 2;
  elsif l_color = f_color then r_color := 'same'; score := score + 15;
  elsif l_color = any(coalesce(f_colors, '{}')) or f_color = any(coalesce(l_colors, '{}')) then r_color := 'partial'; score := score + 8;
  else r_color := 'different'; end if;

  if l_breed is null or f_breed is null then r_breed := 'unknown'; score := score + 1;
  elsif lower(btrim(l_breed)) = lower(btrim(f_breed)) then r_breed := 'same'; score := score + 10;
  else r_breed := 'different'; end if;

  return jsonb_build_object(
    'score', least(100, greatest(0, score)),
    'reasons', jsonb_build_object('distance', r_distance, 'days', round(days * 10) / 10.0,
      'size', r_size, 'sex', r_sex, 'color', r_color, 'breed', r_breed));
end;
$$;

-- Candidatos e pontuação pelos pontos públicos (o raio de 10 km também).
create or replace function private.match_found_case(p_found_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.found_cases;
  f_public extensions.geography;
  l record;
begin
  select * into f from public.found_cases where id = p_found_id and status = 'ACTIVE';
  if f.id is null or f.public_lat is null or f.public_lng is null then return; end if;
  f_public := extensions.st_setsrid(extensions.st_makepoint(f.public_lng, f.public_lat), 4326)::extensions.geography;
  for l in
    select lc.id, lc.public_lat, lc.public_lng, lc.lost_at, p.species, p.size, p.sex, p.color_primary, p.colors_secondary, p.breed
      from public.lost_cases lc join public.pets p on p.id = lc.pet_id
     where lc.status = 'ACTIVE' and p.species = f.species and lc.owner_id <> f.reporter_id
       and extensions.st_dwithin(lc.public_point, f_public, 10000)
  loop
    perform private.record_match(l.id, f.id, private.match_score(
      l.species, l.size, l.sex, l.color_primary, l.colors_secondary, l.breed, l.public_lat, l.public_lng, l.lost_at,
      f.species, f.size, f.sex, f.color_primary, f.colors_secondary, f.breed_guess, f.public_lat, f.public_lng, f.found_at));
  end loop;
end;
$$;

create or replace function private.match_lost_case(p_lost_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  f public.found_cases;
begin
  select lc.id, lc.owner_id, lc.public_lat, lc.public_lng, lc.public_point, lc.lost_at,
         p.species, p.size, p.sex, p.color_primary, p.colors_secondary, p.breed
    into l
    from public.lost_cases lc join public.pets p on p.id = lc.pet_id
   where lc.id = p_lost_id and lc.status = 'ACTIVE';
  if l.id is null or l.public_point is null then return; end if;
  for f in
    select * from public.found_cases fc
     where fc.status = 'ACTIVE' and fc.species = l.species and fc.reporter_id <> l.owner_id
       and fc.public_lat is not null and fc.public_lng is not null
       and extensions.st_dwithin(
             extensions.st_setsrid(extensions.st_makepoint(fc.public_lng, fc.public_lat), 4326)::extensions.geography,
             l.public_point, 10000)
  loop
    perform private.record_match(l.id, f.id, private.match_score(
      l.species, l.size, l.sex, l.color_primary, l.colors_secondary, l.breed, l.public_lat, l.public_lng, l.lost_at,
      f.species, f.size, f.sex, f.color_primary, f.colors_secondary, f.breed_guess, f.public_lat, f.public_lng, f.found_at));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dados já gravados: nenhuma correspondência antiga pode continuar carregando
-- a distância exata (nem na pontuação). Recalcula tudo pelos pontos públicos.
-- ---------------------------------------------------------------------------
alter table public.case_matches alter column algorithm_version set default 'v2';

update public.case_matches m
   set score = (x.r ->> 'score')::int, reasons = x.r -> 'reasons', algorithm_version = 'v2'
  from (
    select m2.id, private.match_score(
             p.species, p.size, p.sex, p.color_primary, p.colors_secondary, p.breed, lc.public_lat, lc.public_lng, lc.lost_at,
             fc.species, fc.size, fc.sex, fc.color_primary, fc.colors_secondary, fc.breed_guess, fc.public_lat, fc.public_lng, fc.found_at) as r
      from public.case_matches m2
      join public.lost_cases lc on lc.id = m2.lost_case_id
      join public.pets p on p.id = lc.pet_id
      join public.found_cases fc on fc.id = m2.found_case_id
  ) x
 where x.id = m.id and x.r is not null;

-- O que não seria correspondência pelos pontos públicos (ex.: áreas a mais de
-- 10 km) não tem como ser recalculado sem a distância exata: sai. É dado
-- derivado; o tutor e quem encontrou continuam com seus alertas e publicações.
delete from public.case_matches where algorithm_version <> 'v2';

-- Avisos antigos do Radar guardavam a pontuação antiga (derivada da distância
-- exata). A pontuação nova fica na própria correspondência; o aviso não a repete.
update public.notifications set payload = payload - 'score'
 where kind = 'match_new' and payload ? 'score';

create or replace function private.record_match(p_lost_id uuid, p_found_id uuid, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid;
  info record;
begin
  if p_result is null or (p_result ->> 'score')::int < 50 then
    return;
  end if;
  insert into public.case_matches (lost_case_id, found_case_id, score, reasons)
  values (p_lost_id, p_found_id, (p_result ->> 'score')::int, p_result -> 'reasons')
  on conflict (lost_case_id, found_case_id) do nothing
  returning id into match_id;
  if match_id is null then
    return; -- já existia: não notifica de novo
  end if;

  select lc.owner_id, lc.short_code as lost_code, p.name as pet_name, fc.reporter_id, fc.short_code as found_code
    into info
    from public.lost_cases lc join public.pets p on p.id = lc.pet_id, public.found_cases fc
   where lc.id = p_lost_id and fc.id = p_found_id;

  -- Sem pontuação no aviso (fica na correspondência, vista no Radar).
  insert into public.notifications (user_id, kind, payload) values
    (info.owner_id, 'match_new', jsonb_build_object('to', 'owner', 'pet_name', info.pet_name, 'lost_code', info.lost_code)),
    (info.reporter_id, 'match_new', jsonb_build_object('to', 'finder', 'pet_name', info.pet_name, 'found_code', info.found_code));
end;
$$;
