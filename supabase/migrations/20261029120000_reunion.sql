-- MEL — Milestone 9: reencontro ("ESTÁ EM CASA"), agradecimento e KPI.
-- O tutor confirma o reencontro por uma função com regras (só o dono, só
-- alerta ativo, a pista escolhida precisa ser deste alerta). Quem ajudou
-- (enviou avistamento ou conversou) recebe um "obrigado" in-app.

alter table public.lost_cases
  add column helpful_sighting_id uuid references public.sightings (id) on delete set null,
  add column found_area_label text check (char_length(found_area_label) <= 120),
  add constraint lost_cases_found_how_values
    check (found_how is null or found_how in ('came_back', 'sighting_mel', 'found_mel', 'neighbor', 'clinic_shelter', 'other'));

-- ---------------------------------------------------------------------------
-- Eventos de produto (KPI). Só o banco escreve; leitura fica para o admin (M13).
-- ---------------------------------------------------------------------------
create table public.events (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) <= 60),
  subject_id uuid,
  user_id    uuid references public.profiles (id) on delete set null,
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index events_name_created_idx on public.events (name, created_at);

alter table public.events enable row level security;

create policy "events: moderação lê"
  on public.events for select to authenticated
  using ((select private.is_moderator()));

revoke all on public.events from anon, authenticated;
grant select on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- Notificação de agradecimento.
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('sighting_new', 'message_new', 'reunion_thanks'));

-- Quem ajudou neste alerta: enviou avistamento ou conversou com o tutor.
create or replace function private.lost_case_helpers(p_case_id uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.reporter_id from public.sightings s
   where s.lost_case_id = p_case_id and s.reporter_id is not null and s.status = 'VISIBLE'
  union
  select c.helper_id from public.conversations c
   where c.lost_case_id = p_case_id and c.last_message_at is not null;
$$;

revoke all on function private.lost_case_helpers(uuid) from public, anon, authenticated;

create or replace function public.confirm_reunion(
  p_code text,
  p_how text,
  p_helpful_sighting_id uuid default null,
  p_found_area_label text default null,
  p_story text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c record;
  helpful_reporter uuid;
begin
  select lc.id, lc.owner_id, lc.status, lc.short_code, p.name as pet_name
    into c
    from public.lost_cases lc join public.pets p on p.id = lc.pet_id
   where lc.short_code = lower(p_code);
  if c.id is null or c.owner_id is distinct from me then
    raise exception 'Alerta não encontrado.' using errcode = '42501';
  end if;
  if c.status <> 'ACTIVE' then
    raise exception 'Este alerta não está mais ativo.' using errcode = '22023';
  end if;
  if p_helpful_sighting_id is not null then
    select reporter_id into helpful_reporter
      from public.sightings where id = p_helpful_sighting_id and lost_case_id = c.id;
    if not found then
      raise exception 'Esta pista não é deste alerta.' using errcode = '22023';
    end if;
  end if;

  -- O trigger valida a transição ACTIVE → FOUND e grava found_at.
  update public.lost_cases
     set status = 'FOUND',
         found_how = p_how,
         helpful_sighting_id = p_helpful_sighting_id,
         found_area_label = nullif(btrim(p_found_area_label), ''),
         reunion_story = nullif(btrim(p_story), '')
   where id = c.id;

  insert into public.notifications (user_id, kind, payload)
  select h.user_id, 'reunion_thanks', jsonb_build_object(
           'code', c.short_code, 'pet_name', c.pet_name,
           'helpful', h.user_id = helpful_reporter)
    from private.lost_case_helpers(c.id) h
   where h.user_id is distinct from me;

  insert into public.events (name, subject_id, user_id, props)
  values ('pet_reunited', c.id, me, jsonb_build_object('how', p_how, 'helpful_sighting', p_helpful_sighting_id is not null));
end;
$$;

revoke all on function public.confirm_reunion(text, text, uuid, text, text) from public, anon;
grant execute on function public.confirm_reunion(text, text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Página pública: dados do reencontro (sem identidade de ninguém).
-- ---------------------------------------------------------------------------
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
    'lost_at', c.lost_at,
    'lost_at_uncertain', c.lost_at_uncertain,
    'published_at', c.published_at,
    'found_at', c.found_at,
    'found_how', c.found_how,
    'found_area_label', c.found_area_label,
    'reunion_story', c.reunion_story,
    'helpful_sighting_id', c.helpful_sighting_id,
    'helpers_count', case when c.status = 'FOUND' then (select count(*) from private.lost_case_helpers(c.id)) end,
    'public_lat', c.public_lat,
    'public_lng', c.public_lng,
    'public_point_exact', c.public_point_exact,
    'area_label', c.public_area_label,
    'city', c.city,
    'state', c.state,
    'wearing', c.wearing,
    'notes', c.notes,
    'contact_chat', c.contact_chat,
    'contact_whatsapp', case when c.contact_whatsapp_public then c.contact_phone end,
    'contact_phone', case when c.contact_phone_public then c.contact_phone end,
    'indexable', c.indexable,
    'is_owner', c.owner_id = (select auth.uid()),
    'pet', private.pet_public_json(c.pet_id)
  )
  from public.lost_cases c
  where c.short_code = lower(p_code) and c.status in ('ACTIVE', 'FOUND');
$$;
