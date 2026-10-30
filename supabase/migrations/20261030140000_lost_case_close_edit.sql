-- Ciclo de vida do alerta de perdido (P1 da auditoria funcional de 2026-10-30):
-- o tutor edita o alerta ativo e pode ENCERRÁ-LO sem declarar reencontro.
--
-- Estados (enum já existente, sem valor novo):
--   ACTIVE   publicado e procurando;
--   FOUND    reencontrado (fluxo de reencontro: confirm_reunion) — conta como reencontro;
--   CLOSED   encerrado voluntariamente pelo tutor — NÃO conta como reencontro;
--   REMOVED  removido pela moderação.
--
-- Esta migration:
--   1. registra quando o alerta foi encerrado (closed_at, coluna de sistema);
--   2. CLOSED só a partir de ACTIVE (antes FOUND → CLOSED era aceito e apagaria um reencontro);
--   3. depois de FOUND/CLOSED/REMOVED o conteúdo do alerta não muda mais (corrida entre abas);
--   4. página pública de um alerta encerrado: só o essencial (sem local, contato nem observações);
--   5. linha do tempo de um alerta encerrado: só o tutor vê (os avistamentos continuam guardados);
--   6. Radar recalculado quando o tutor muda o local/data do alerta ou as características do pet.

alter table public.lost_cases add column closed_at timestamptz;

create or replace function private.lost_cases_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status public.lost_case_status := case when tg_op = 'UPDATE' then old.status end;
begin
  if tg_op = 'INSERT' and not exists (
    select 1 from public.pets where id = new.pet_id and owner_id = new.owner_id
  ) then
    raise exception 'O pet não pertence a este usuário.' using errcode = '42501';
  end if;

  -- Encerrado (reencontrado, encerrado pelo tutor ou removido): o conteúdo fica como estava.
  if tg_op = 'UPDATE' and old_status in ('FOUND', 'CLOSED', 'REMOVED') and not private.is_moderator() and (
       new.last_seen_lat is distinct from old.last_seen_lat or new.last_seen_lng is distinct from old.last_seen_lng
    or new.last_seen_label is distinct from old.last_seen_label or new.public_point_exact is distinct from old.public_point_exact
    or new.public_area_label is distinct from old.public_area_label or new.city is distinct from old.city
    or new.state is distinct from old.state or new.lost_at is distinct from old.lost_at
    or new.lost_at_uncertain is distinct from old.lost_at_uncertain or new.wearing is distinct from old.wearing
    or new.notes is distinct from old.notes or new.contact_chat is distinct from old.contact_chat
    or new.contact_whatsapp_public is distinct from old.contact_whatsapp_public
    or new.contact_phone_public is distinct from old.contact_phone_public or new.contact_phone is distinct from old.contact_phone
    or new.indexable is distinct from old.indexable
  ) then
    raise exception 'Este alerta já foi encerrado e não pode mais ser alterado.' using errcode = '22023';
  end if;

  -- Ponto público sempre derivado do privado (nunca vem do cliente).
  if new.last_seen_lat is null or new.last_seen_lng is null then
    new.public_lat := null;
    new.public_lng := null;
  elsif new.public_point_exact then
    new.public_lat := new.last_seen_lat;
    new.public_lng := new.last_seen_lng;
  else
    select f.fuzzed_lat, f.fuzzed_lng into new.public_lat, new.public_lng
      from private.fuzz_lat_lng(new.last_seen_lat, new.last_seen_lng, 250) f;
  end if;

  -- closed_at é do sistema: só muda junto com o encerramento.
  if tg_op = 'UPDATE' and new.status = old_status then
    new.closed_at := old.closed_at;
  end if;

  if old_status is distinct from new.status then
    if new.status = 'REMOVED' or old_status = 'REMOVED' then
      if not private.is_moderator() then
        raise exception 'Somente a moderação remove ou restaura alertas.' using errcode = '42501';
      end if;
    elsif new.status = 'ACTIVE' then
      if old_status is not null and old_status <> 'DRAFT' then
        raise exception 'Transição de status inválida: % → %', old_status, new.status using errcode = '22023';
      end if;
      if new.last_seen_lat is null or new.lost_at is null then
        raise exception 'Para ativar o alerta, informe onde e quando o pet foi visto.' using errcode = '22023';
      end if;
      new.published_at := now();
    elsif new.status = 'FOUND' then
      if old_status is distinct from 'ACTIVE' then
        raise exception 'Transição de status inválida: % → %', old_status, new.status using errcode = '22023';
      end if;
      new.found_at := coalesce(new.found_at, now());
    elsif new.status = 'CLOSED' then
      -- Só um alerta ativo é encerrado; um reencontro (FOUND) não vira "encerrado".
      if old_status is distinct from 'ACTIVE' then
        raise exception 'Só um alerta ativo pode ser encerrado.' using errcode = '22023';
      end if;
      new.closed_at := now();
    elsif new.status = 'DRAFT' and old_status is not null then
      raise exception 'Um alerta publicado não volta a rascunho.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

-- Página pública: alerta encerrado pelo tutor continua no link (histórico),
-- mas só com o essencial — sem ponto, área, contato, roupa ou observações.
create or replace function public.get_public_lost_case(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', c.short_code,
    'status', c.status,
    'lost_at', case when c.status <> 'CLOSED' then c.lost_at end,
    'lost_at_uncertain', c.lost_at_uncertain,
    'published_at', c.published_at,
    'closed_at', c.closed_at,
    'found_at', c.found_at,
    'found_how', c.found_how,
    'found_area_label', c.found_area_label,
    'reunion_story', c.reunion_story,
    'helpful_sighting_id', c.helpful_sighting_id,
    'helpers_count', case when c.status = 'FOUND' then (select count(*) from private.lost_case_helpers(c.id)) end,
    'public_lat', case when c.status <> 'CLOSED' then c.public_lat end,
    'public_lng', case when c.status <> 'CLOSED' then c.public_lng end,
    'public_point_exact', c.public_point_exact,
    'area_label', case when c.status <> 'CLOSED' then c.public_area_label end,
    'city', case when c.status <> 'CLOSED' then c.city end,
    'state', case when c.status <> 'CLOSED' then c.state end,
    'wearing', case when c.status <> 'CLOSED' then c.wearing end,
    'notes', case when c.status <> 'CLOSED' then c.notes end,
    'contact_chat', c.contact_chat and c.status <> 'CLOSED',
    'contact_whatsapp', case when c.contact_whatsapp_public and c.status <> 'CLOSED' then c.contact_phone end,
    'contact_phone', case when c.contact_phone_public and c.status <> 'CLOSED' then c.contact_phone end,
    'indexable', c.indexable and c.status <> 'CLOSED',
    'is_owner', coalesce(c.owner_id = (select auth.uid()), false),
    'pet', private.pet_public_json(c.pet_id)
  )
  from public.lost_cases c
  where c.short_code = lower(p_code) and c.status in ('ACTIVE', 'FOUND', 'CLOSED');
$$;

-- Linha do tempo: de um alerta encerrado, só o tutor continua vendo os avistamentos.
create or replace function public.get_lost_case_timeline(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'seen_at', s.seen_at, 'lat', s.lat, 'lng', s.lng, 'place_label', s.place_label,
      'direction', s.direction, 'states', s.states, 'notes', s.notes, 'photo_path', s.photo_path,
      'hidden', s.status = 'HIDDEN', 'mine', s.reporter_id = (select auth.uid()),
      'can_reply', c.owner_id = (select auth.uid()) and c.status in ('ACTIVE', 'FOUND')
                   and s.reporter_id is not null and s.reporter_id <> c.owner_id)
    order by s.seen_at), '[]'::jsonb)
  from public.lost_cases c
  join public.sightings s on s.lost_case_id = c.id
  where c.short_code = lower(p_code)
    and (c.status in ('ACTIVE', 'FOUND') or (c.status = 'CLOSED' and c.owner_id = (select auth.uid())))
    -- Ocultos só aparecem para o tutor (que pode reexibir).
    and (s.status = 'VISIBLE' or c.owner_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Radar ao editar: recalcula as correspondências do alerta ativo (pelos pontos
-- públicos, como sempre) e procura novas. Avisa só as NOVAS (record_match).
-- ---------------------------------------------------------------------------
create or replace function private.refresh_lost_case_matches(p_lost_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with recomputed as (
    select m.id, private.match_score(
             p.species, p.size, p.sex, p.color_primary, p.colors_secondary, p.breed, lc.public_lat, lc.public_lng, lc.lost_at,
             fc.species, fc.size, fc.sex, fc.color_primary, fc.colors_secondary, fc.breed_guess, fc.public_lat, fc.public_lng, fc.found_at) as r
      from public.case_matches m
      join public.lost_cases lc on lc.id = m.lost_case_id
      join public.pets p on p.id = lc.pet_id
      join public.found_cases fc on fc.id = m.found_case_id
     where m.lost_case_id = p_lost_id and lc.status = 'ACTIVE'
  ), updated as (
    update public.case_matches m
       set score = (x.r ->> 'score')::int, reasons = x.r -> 'reasons', algorithm_version = 'v2'
      from recomputed x
     where x.id = m.id and x.r is not null and (x.r ->> 'score')::int >= 50
    returning m.id
  )
  -- Deixou de ser compatível (outra área, outra data, outras características): sai.
  delete from public.case_matches m
   using recomputed x
   where x.id = m.id and m.id not in (select id from updated);

  perform private.match_lost_case(p_lost_id);
end;
$$;

revoke all on function private.refresh_lost_case_matches(uuid) from public, anon, authenticated;

create or replace function private.lost_cases_after_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_lost_case_matches(new.id);
  return new;
end;
$$;

create trigger lost_cases_after_edit
  after update of last_seen_lat, last_seen_lng, public_point_exact, lost_at on public.lost_cases
  for each row
  when (old.status = 'ACTIVE' and new.status = 'ACTIVE' and (
        old.public_lat is distinct from new.public_lat or old.public_lng is distinct from new.public_lng
     or old.lost_at is distinct from new.lost_at))
  execute function private.lost_cases_after_edit();

create or replace function private.pets_after_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lc record;
begin
  for lc in select id from public.lost_cases where pet_id = new.id and status = 'ACTIVE' loop
    perform private.refresh_lost_case_matches(lc.id);
  end loop;
  return new;
end;
$$;

create trigger pets_after_edit
  after update of species, size, sex, color_primary, colors_secondary, breed on public.pets
  for each row
  when (old.species is distinct from new.species or old.size is distinct from new.size or old.sex is distinct from new.sex
     or old.color_primary is distinct from new.color_primary or old.colors_secondary is distinct from new.colors_secondary
     or old.breed is distinct from new.breed)
  execute function private.pets_after_edit();

revoke all on function private.lost_cases_after_edit(), private.pets_after_edit() from public, anon, authenticated;
