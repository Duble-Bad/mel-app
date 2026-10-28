-- MEL — Milestone 10: "Encontrei um pet" / "Vi um pet solto" + Radar MEL.
-- Quem encontrou pode estar sem conta (sessão anônima + captcha na rota).
-- Privado: ponto exato e o "detalhe para conferir o tutor" (prova de posse).
-- O Radar cruza encontrados × alertas ativos no banco, com a mesma fórmula
-- de packages/core/src/found/match.ts (teste de paridade).

create type public.found_case_status as enum ('ACTIVE', 'REUNITED', 'CLOSED', 'REMOVED');
create type public.found_custody as enum ('with_me', 'safe_place', 'clinic', 'street', 'other');

create or replace function private.generate_found_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.found_cases where short_code = candidate);
  end loop;
  return candidate;
end;
$$;

create table public.found_cases (
  id                 uuid primary key default gen_random_uuid(),
  short_code         text not null unique,
  reporter_id        uuid not null references public.profiles (id) on delete cascade,
  status             public.found_case_status not null default 'ACTIVE',
  species            public.species not null,
  breed_guess        text check (char_length(breed_guess) <= 80),
  sex                public.pet_sex not null default 'unknown',
  size               public.pet_size,
  color_primary      text check (char_length(color_primary) <= 30),
  colors_secondary   text[] not null default '{}' check (cardinality(colors_secondary) <= 5),
  description        text check (char_length(description) <= 500),
  -- PRIVADO: ponto exato (pode ser a casa de quem encontrou).
  lat                double precision not null check (lat between -90 and 90),
  lng                double precision not null check (lng between -180 and 180),
  point              extensions.geography(Point, 4326) generated always as (
                       extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  public_lat         double precision,
  public_lng         double precision,
  public_area_label  text check (char_length(public_area_label) <= 200),
  found_at           timestamptz not null,
  custody            public.found_custody not null,
  custody_notes      text check (char_length(custody_notes) <= 300),
  -- PRIVADO: prova de posse do lado de quem encontrou. Só a própria pessoa vê.
  verification_hint  text check (char_length(verification_hint) <= 200),
  photo_path         text check (char_length(photo_path) <= 300),
  closed_at          timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.found_cases alter column short_code set default private.generate_found_code();

create index found_cases_point_idx on public.found_cases using gist (point) where status = 'ACTIVE';
create index found_cases_reporter_idx on public.found_cases (reporter_id, created_at desc);
create index found_cases_status_found_at_idx on public.found_cases (status, found_at desc);

create or replace function private.found_cases_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.found_at > now() + interval '5 minutes' then
    raise exception 'A data não pode estar no futuro.' using errcode = '22023';
  end if;
  if new.found_at < now() - interval '60 days' then
    raise exception 'Use uma data dos últimos 60 dias.' using errcode = '22023';
  end if;
  if new.photo_path is not null and split_part(new.photo_path, '/', 1) <> new.reporter_id::text then
    raise exception 'Foto inválida.' using errcode = '42501';
  end if;
  if (select count(*) from public.found_cases
       where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Você já publicou muitos animais encontrados agora. Tente de novo mais tarde.' using errcode = 'P0429';
  end if;
  select f.fuzzed_lat, f.fuzzed_lng into new.public_lat, new.public_lng
    from private.fuzz_lat_lng(new.lat, new.lng, 250) f;
  new.status := 'ACTIVE';
  new.short_code := private.generate_found_code();
  new.created_at := now();
  new.closed_at := null;
  return new;
end;
$$;

create trigger found_cases_before_insert
  before insert on public.found_cases
  for each row execute function private.found_cases_before_insert();

alter table public.found_cases enable row level security;

create policy "found_cases: qualquer sessão publica em seu nome"
  on public.found_cases for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

create policy "found_cases: quem publicou vê os seus"
  on public.found_cases for select to authenticated
  using ((select auth.uid()) = reporter_id);

create policy "found_cases: moderação vê todos"
  on public.found_cases for select to authenticated
  using ((select private.is_moderator()));

revoke all on public.found_cases from anon, authenticated;
grant select on public.found_cases to authenticated;
grant insert (reporter_id, species, breed_guess, sex, size, color_primary, colors_secondary, description, lat, lng,
              public_area_label, found_at, custody, custody_notes, verification_hint, photo_path)
  on public.found_cases to authenticated;

-- ---------------------------------------------------------------------------
-- Radar MEL v1 — espelho de computeMatchScore (packages/core/src/found/match.ts).
-- null = não é candidato (espécie diferente, longe demais, tempo incompatível).
-- ---------------------------------------------------------------------------
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
  -- Haversine (igual ao TypeScript, para a paridade ser exata).
  d double precision := 2 * 6371000 * asin(sqrt(
    sin(radians(f_lat - l_lat) / 2) ^ 2 +
    cos(radians(l_lat)) * cos(radians(f_lat)) * sin(radians(f_lng - l_lng) / 2) ^ 2));
  days double precision := extract(epoch from (f_found_at - l_lost_at)) / 86400.0;
  score int := 0;
  r_size text; r_sex text; r_color text; r_breed text;
  diff int;
begin
  if l_species is distinct from f_species or d > 10000 or days < -1 or days > 60 then
    return null;
  end if;
  score := score + round(35 * (1 - d / 10000.0))::int;
  score := score + round(15 * greatest(0, 1 - greatest(days, 0) / 30.0))::int;

  if l_size is null or f_size is null then r_size := 'unknown'; score := score + 5;
  else
    diff := abs(array_position(sizes, l_size::text) - array_position(sizes, f_size::text));
    if diff = 0 then r_size := 'same'; score := score + 15;
    elsif diff = 1 then r_size := 'close'; score := score + 7;
    else r_size := 'different'; end if;
  end if;

  if l_sex = 'unknown' or f_sex = 'unknown' then r_sex := 'unknown'; score := score + 5;
  elsif l_sex = f_sex then r_sex := 'same'; score := score + 10;
  else r_sex := 'different'; score := score - 15; end if;

  if l_color is null or f_color is null then r_color := 'unknown'; score := score + 5;
  elsif l_color = f_color then r_color := 'same'; score := score + 15;
  elsif l_color = any(coalesce(f_colors, '{}')) or f_color = any(coalesce(l_colors, '{}')) then r_color := 'partial'; score := score + 8;
  else r_color := 'different'; end if;

  if l_breed is null or f_breed is null then r_breed := 'unknown'; score := score + 3;
  elsif lower(btrim(l_breed)) = lower(btrim(f_breed)) then r_breed := 'same'; score := score + 10;
  else r_breed := 'different'; end if;

  return jsonb_build_object(
    'score', least(100, greatest(0, score)),
    'reasons', jsonb_build_object('distance_m', round(d)::int, 'days', round(days * 10) / 10.0,
      'size', r_size, 'sex', r_sex, 'color', r_color, 'breed', r_breed));
end;
$$;

-- Só para o teste de paridade com o TypeScript (sem dados de ninguém).
create or replace function public.debug_match_score(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select private.match_score(
    (p ->> 'l_species')::public.species, (p ->> 'l_size')::public.pet_size, (p ->> 'l_sex')::public.pet_sex,
    p ->> 'l_color', array(select jsonb_array_elements_text(coalesce(p -> 'l_colors', '[]'))), p ->> 'l_breed',
    (p ->> 'l_lat')::float8, (p ->> 'l_lng')::float8, (p ->> 'l_lost_at')::timestamptz,
    (p ->> 'f_species')::public.species, (p ->> 'f_size')::public.pet_size, (p ->> 'f_sex')::public.pet_sex,
    p ->> 'f_color', array(select jsonb_array_elements_text(coalesce(p -> 'f_colors', '[]'))), p ->> 'f_breed',
    (p ->> 'f_lat')::float8, (p ->> 'f_lng')::float8, (p ->> 'f_found_at')::timestamptz);
$$;

revoke all on function public.debug_match_score(jsonb) from public, anon;
grant execute on function public.debug_match_score(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Correspondências
-- ---------------------------------------------------------------------------
create table public.case_matches (
  id                uuid primary key default gen_random_uuid(),
  lost_case_id      uuid not null references public.lost_cases (id) on delete cascade,
  found_case_id     uuid not null references public.found_cases (id) on delete cascade,
  score             smallint not null check (score between 0 and 100),
  reasons           jsonb not null default '{}',
  algorithm_version text not null default 'v1',
  owner_dismissed   boolean not null default false,
  finder_dismissed  boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (lost_case_id, found_case_id)
);

create index case_matches_lost_idx on public.case_matches (lost_case_id, score desc);
create index case_matches_found_idx on public.case_matches (found_case_id, score desc);

-- Só funções leem e escrevem (mostram apenas o que cada lado pode ver).
alter table public.case_matches enable row level security;
revoke all on public.case_matches from anon, authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('sighting_new', 'message_new', 'reunion_thanks', 'match_new'));

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

  insert into public.notifications (user_id, kind, payload) values
    (info.owner_id, 'match_new', jsonb_build_object('to', 'owner', 'pet_name', info.pet_name,
       'score', (p_result ->> 'score')::int, 'lost_code', info.lost_code)),
    (info.reporter_id, 'match_new', jsonb_build_object('to', 'finder', 'pet_name', info.pet_name,
       'score', (p_result ->> 'score')::int, 'found_code', info.found_code));
end;
$$;

create or replace function private.match_found_case(p_found_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.found_cases;
  l record;
begin
  select * into f from public.found_cases where id = p_found_id and status = 'ACTIVE';
  if f.id is null then return; end if;
  for l in
    select lc.id, lc.last_seen_lat, lc.last_seen_lng, lc.lost_at, p.species, p.size, p.sex, p.color_primary, p.colors_secondary, p.breed
      from public.lost_cases lc join public.pets p on p.id = lc.pet_id
     where lc.status = 'ACTIVE' and p.species = f.species and lc.owner_id <> f.reporter_id
       and extensions.st_dwithin(lc.last_seen_point, f.point, 10000)
  loop
    perform private.record_match(l.id, f.id, private.match_score(
      l.species, l.size, l.sex, l.color_primary, l.colors_secondary, l.breed, l.last_seen_lat, l.last_seen_lng, l.lost_at,
      f.species, f.size, f.sex, f.color_primary, f.colors_secondary, f.breed_guess, f.lat, f.lng, f.found_at));
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
  select lc.id, lc.owner_id, lc.last_seen_lat, lc.last_seen_lng, lc.last_seen_point, lc.lost_at,
         p.species, p.size, p.sex, p.color_primary, p.colors_secondary, p.breed
    into l
    from public.lost_cases lc join public.pets p on p.id = lc.pet_id
   where lc.id = p_lost_id and lc.status = 'ACTIVE';
  if l.id is null then return; end if;
  for f in
    select * from public.found_cases fc
     where fc.status = 'ACTIVE' and fc.species = l.species and fc.reporter_id <> l.owner_id
       and extensions.st_dwithin(fc.point, l.last_seen_point, 10000)
  loop
    perform private.record_match(l.id, f.id, private.match_score(
      l.species, l.size, l.sex, l.color_primary, l.colors_secondary, l.breed, l.last_seen_lat, l.last_seen_lng, l.lost_at,
      f.species, f.size, f.sex, f.color_primary, f.colors_secondary, f.breed_guess, f.lat, f.lng, f.found_at));
  end loop;
end;
$$;

revoke all on function private.record_match(uuid, uuid, jsonb), private.match_found_case(uuid), private.match_lost_case(uuid)
  from public, anon, authenticated;

create or replace function private.found_cases_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.match_found_case(new.id);
  return new;
end;
$$;

create trigger found_cases_after_insert
  after insert on public.found_cases
  for each row execute function private.found_cases_after_insert();

create or replace function private.lost_cases_after_activate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.match_lost_case(new.id);
  return new;
end;
$$;

create trigger lost_cases_after_activate
  after update of status on public.lost_cases
  for each row when (old.status = 'DRAFT' and new.status = 'ACTIVE')
  execute function private.lost_cases_after_activate();

-- ---------------------------------------------------------------------------
-- Leitura pública do encontrado (sem ponto exato, sem prova de posse — esta só
-- para quem publicou).
-- ---------------------------------------------------------------------------
create or replace function public.get_public_found_case(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', f.short_code,
    'status', f.status,
    'species', f.species,
    'breed_guess', f.breed_guess,
    'sex', f.sex,
    'size', f.size,
    'color_primary', f.color_primary,
    'colors_secondary', f.colors_secondary,
    'description', f.description,
    'public_lat', f.public_lat,
    'public_lng', f.public_lng,
    'area_label', f.public_area_label,
    'found_at', f.found_at,
    'custody', f.custody,
    'photo_path', f.photo_path,
    'is_reporter', coalesce(f.reporter_id = (select auth.uid()), false),
    'verification_hint', case when f.reporter_id = (select auth.uid()) then f.verification_hint end
  )
  from public.found_cases f
  where f.short_code = lower(p_code) and f.status <> 'REMOVED';
$$;

revoke all on function public.get_public_found_case(text) from public;
grant execute on function public.get_public_found_case(text) to anon, authenticated;

-- Quem publicou encerra: devolvido ao tutor (REUNITED) ou não está mais com ela (CLOSED).
create or replace function public.close_found_case(p_code text, p_status public.found_case_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('REUNITED', 'CLOSED') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;
  update public.found_cases set status = p_status, closed_at = now()
   where short_code = lower(p_code) and reporter_id = (select auth.uid()) and status = 'ACTIVE';
  if not found then
    raise exception 'Publicação não encontrada.' using errcode = '42501';
  end if;
end;
$$;

-- Correspondências que EU posso ver (como tutor ou como quem encontrou).
create or replace function public.get_my_matches(p_found_code text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'role', case when lc.owner_id = (select auth.uid()) then 'owner' else 'finder' end,
      'score', m.score,
      'reasons', m.reasons,
      'created_at', m.created_at,
      'lost', jsonb_build_object(
        'code', lc.short_code, 'status', lc.status, 'pet_name', p.name, 'species', p.species, 'breed', p.breed,
        'area_label', lc.public_area_label, 'lost_at', lc.lost_at, 'contact_chat', lc.contact_chat,
        'photo_path', (select ph.thumb_path from public.pet_photos ph where ph.pet_id = p.id order by ph.is_primary desc, ph.position limit 1)),
      'found', jsonb_build_object(
        'code', fc.short_code, 'status', fc.status, 'species', fc.species, 'breed_guess', fc.breed_guess,
        'size', fc.size, 'color_primary', fc.color_primary, 'area_label', fc.public_area_label,
        'found_at', fc.found_at, 'custody', fc.custody, 'photo_path', fc.photo_path))
    order by m.score desc, m.created_at desc), '[]'::jsonb)
  from public.case_matches m
  join public.lost_cases lc on lc.id = m.lost_case_id
  join public.pets p on p.id = lc.pet_id
  join public.found_cases fc on fc.id = m.found_case_id
  where (
      (lc.owner_id = (select auth.uid()) and not m.owner_dismissed)
      or (fc.reporter_id = (select auth.uid()) and not m.finder_dismissed)
    )
    and (p_found_code is null or fc.short_code = lower(p_found_code))
    and lc.status in ('ACTIVE', 'FOUND') and fc.status <> 'REMOVED';
$$;

create or replace function public.dismiss_match(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  update public.case_matches m
     set owner_dismissed = m.owner_dismissed or lc.owner_id = me,
         finder_dismissed = m.finder_dismissed or fc.reporter_id = me
    from public.lost_cases lc, public.found_cases fc
   where m.id = p_id and lc.id = m.lost_case_id and fc.id = m.found_case_id
     and me in (lc.owner_id, fc.reporter_id);
  if not found then
    raise exception 'Correspondência não encontrada.' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat a partir de uma correspondência: o tutor fala com quem encontrou.
-- (Quem encontrou fala com o tutor pelo start_conversation do alerta.)
-- ---------------------------------------------------------------------------
alter table public.conversations add column found_case_id uuid references public.found_cases (id) on delete set null;

create or replace function public.open_conversation_from_match(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  m record;
  conv_id uuid;
begin
  select lc.id as case_id, lc.owner_id, lc.status, fc.id as found_id, fc.reporter_id
    into m
    from public.case_matches cm
    join public.lost_cases lc on lc.id = cm.lost_case_id
    join public.found_cases fc on fc.id = cm.found_case_id
   where cm.id = p_id;
  if m.case_id is null or m.owner_id is distinct from me then
    raise exception 'Correspondência não encontrada.' using errcode = '42501';
  end if;
  if m.status not in ('ACTIVE', 'FOUND') then
    raise exception 'Este alerta não está mais ativo.' using errcode = '22023';
  end if;
  select id into conv_id from public.conversations where lost_case_id = m.case_id and helper_id = m.reporter_id;
  if conv_id is null then
    if private.is_blocked_between(me, m.reporter_id) or private.is_suspended(me) then
      raise exception 'Não é possível iniciar esta conversa.' using errcode = '42501';
    end if;
    insert into public.conversations (lost_case_id, owner_id, helper_id, found_case_id, created_by)
    values (m.case_id, me, m.reporter_id, m.found_id, me)
    returning id into conv_id;
  end if;
  return conv_id;
end;
$$;

-- Rótulo de quem ajuda: "Quem encontrou um pet parecido".
create or replace function private.conversation_json(conv public.conversations, me uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', conv.id,
    'code', lc.short_code,
    'case_status', lc.status,
    'pet_name', p.name,
    'pet_thumb_path', (select ph.thumb_path from public.pet_photos ph where ph.pet_id = p.id
                        order by ph.is_primary desc, ph.position limit 1),
    'my_role', case when me = conv.owner_id then 'owner' else 'helper' end,
    'peer_id', peer.id,
    'peer_name', case when me = conv.owner_id and not peer.is_anonymous then split_part(peer.display_name, ' ', 1) end,
    'peer_is_anonymous', peer.is_anonymous,
    'from_sighting', conv.sighting_id is not null,
    'from_found', conv.found_case_id is not null,
    'blocked_by_me', exists (select 1 from public.blocks b where b.blocker_id = me and b.blocked_id = peer.id),
    'can_send', lc.status in ('ACTIVE', 'FOUND') and not private.is_blocked_between(me, peer.id) and not private.is_suspended(me),
    'created_at', conv.created_at,
    'last_message', (select jsonb_build_object('body', left(m.body, 140), 'created_at', m.created_at, 'mine', m.sender_id = me)
                       from public.messages m
                      where m.conversation_id = conv.id and m.hidden_at is null
                      order by m.created_at desc limit 1),
    'unread', (select count(*) from public.messages m
                where m.conversation_id = conv.id and m.sender_id <> me and m.hidden_at is null
                  and m.created_at > coalesce(case when me = conv.owner_id then conv.owner_last_read_at
                                                   else conv.helper_last_read_at end, '-infinity'))
  )
  from public.lost_cases lc
  join public.pets p on p.id = lc.pet_id
  join public.profiles peer on peer.id = case when me = conv.owner_id then conv.helper_id else conv.owner_id end
  where lc.id = conv.lost_case_id and me in (conv.owner_id, conv.helper_id);
$$;

revoke all on function
  public.close_found_case(text, public.found_case_status),
  public.get_my_matches(text),
  public.dismiss_match(uuid),
  public.open_conversation_from_match(uuid)
from public, anon;
grant execute on function
  public.close_found_case(text, public.found_case_status),
  public.get_my_matches(text),
  public.dismiss_match(uuid),
  public.open_conversation_from_match(uuid)
to authenticated;
