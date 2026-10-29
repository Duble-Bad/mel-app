-- MEL — Milestone 12: Guardião MEL + notificações no celular (Web Push).
-- O Guardião escolhe uma área (guardada já APROXIMADA), um raio e o que quer
-- receber. Ao ativar um alerta / publicar um encontrado, o banco cria os avisos
-- in-app (com antispam) e enfileira o push; o servidor do app envia.

-- ---------------------------------------------------------------------------
-- Configuração do Guardião (conta real)
-- ---------------------------------------------------------------------------
create table public.guardian_settings (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  enabled      boolean not null default true,
  -- Sempre aproximado (grade de 250 m): o trigger arredonda; o exato nunca é guardado.
  area_lat     double precision not null check (area_lat between -90 and 90),
  area_lng     double precision not null check (area_lng between -180 and 180),
  area_point   extensions.geography(Point, 4326) generated always as (
                 extensions.st_setsrid(extensions.st_makepoint(area_lng, area_lat), 4326)::extensions.geography) stored,
  area_label   text check (char_length(area_label) <= 200),
  radius_m     integer not null default 3000 check (radius_m in (1000, 3000, 5000, 10000)),
  alert_lost   boolean not null default true,
  alert_found  boolean not null default true,
  max_per_day  smallint not null default 5 check (max_per_day between 1 and 20),
  quiet_night  boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index guardian_settings_area_idx on public.guardian_settings using gist (area_point) where enabled;

create or replace function private.guardian_settings_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select f.fuzzed_lat, f.fuzzed_lng into new.area_lat, new.area_lng
    from private.fuzz_lat_lng(new.area_lat, new.area_lng, 250) f;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guardian_settings_before_write
  before insert or update on public.guardian_settings
  for each row execute function private.guardian_settings_before_write();

alter table public.guardian_settings enable row level security;

create policy "guardian_settings: dono lê"
  on public.guardian_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "guardian_settings: conta real cria a sua"
  on public.guardian_settings for insert to authenticated
  with check ((select auth.uid()) = user_id and not (select private.is_anonymous_session()));
create policy "guardian_settings: dono altera"
  on public.guardian_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "guardian_settings: dono remove"
  on public.guardian_settings for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.guardian_settings from anon, authenticated;
grant select, delete on public.guardian_settings to authenticated;
grant insert (user_id, enabled, area_lat, area_lng, area_label, radius_m, alert_lost, alert_found, max_per_day, quiet_night),
      update (enabled, area_lat, area_lng, area_label, radius_m, alert_lost, alert_found, max_per_day, quiet_night)
  on public.guardian_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Inscrições de push (um aparelho = um endpoint)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  endpoint        text not null unique check (char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) <= 200),
  auth            text not null check (char_length(auth) <= 100),
  user_agent      text check (char_length(user_agent) <= 300),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: dono lê"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "push_subscriptions: dono remove"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.push_subscriptions from anon, authenticated;
grant select (id, endpoint, user_agent, created_at, last_success_at), delete on public.push_subscriptions to authenticated;

-- Grava (ou passa para a sessão atual) a inscrição deste aparelho.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception 'Inscrição inválida.' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (me, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = me, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Avisos para Guardiões + fila de push
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('sighting_new', 'message_new', 'reunion_thanks', 'match_new', 'guardian_alert', 'guardian_resolved'));

-- Um aviso de Guardião por caso por pessoa.
create unique index notifications_guardian_once_idx
  on public.notifications (user_id, (payload ->> 'case_key')) where kind = 'guardian_alert';

create table public.push_outbox (
  id              bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  status          text not null default 'PENDING' check (status in ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED')),
  reason          text check (char_length(reason) <= 200),
  created_at      timestamptz not null default now(),
  processed_at    timestamptz
);

create index push_outbox_pending_idx on public.push_outbox (created_at) where status = 'PENDING';
alter table public.push_outbox enable row level security; -- sem políticas: só o servidor (chave secreta)
revoke all on public.push_outbox from anon, authenticated;

/**
 * Avisa os Guardiões cuja área (raio) cobre o ponto público do caso.
 * Antispam: só quem pediu esse tipo, nunca o autor, um aviso por caso e no
 * máximo `max_per_day` avisos de Guardião por dia (horário de Brasília).
 */
create or replace function private.notify_guardians(
  p_kind text,              -- 'lost' | 'found'
  p_case_key text,
  p_point extensions.geography,
  p_author uuid,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  n integer;
begin
  if p_point is null then
    return 0;
  end if;
  with targets as (
    select g.user_id
      from public.guardian_settings g
      join public.profiles pr on pr.id = g.user_id
     where g.enabled and pr.suspended_at is null
       and g.user_id is distinct from p_author
       and ((p_kind = 'lost' and g.alert_lost) or (p_kind = 'found' and g.alert_found))
       and extensions.st_dwithin(g.area_point, p_point, g.radius_m)
       and (select count(*) from public.notifications nn
             where nn.user_id = g.user_id and nn.kind = 'guardian_alert' and nn.created_at >= today_start) < g.max_per_day
  ),
  inserted as (
    insert into public.notifications (user_id, kind, payload)
    select t.user_id, 'guardian_alert', p_payload || jsonb_build_object('case_key', p_case_key, 'case_kind', p_kind)
      from targets t
    on conflict (user_id, (payload ->> 'case_key')) where kind = 'guardian_alert' do nothing
    returning id, user_id
  ),
  queued as (
    insert into public.push_outbox (notification_id, user_id)
    select i.id, i.user_id from inserted i
    returning 1
  )
  select count(*) into n from queued;
  return n;
end;
$$;

revoke all on function private.notify_guardians(text, text, extensions.geography, uuid, jsonb) from public, anon, authenticated;

-- Alerta ativado: Radar (M10) + Guardiões.
create or replace function private.lost_cases_after_activate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pet record;
begin
  perform private.match_lost_case(new.id);
  select name, species into pet from public.pets where id = new.pet_id;
  perform private.notify_guardians('lost', 'lost:' || new.short_code, new.public_point, new.owner_id,
    jsonb_build_object('code', new.short_code, 'pet_name', pet.name, 'species', pet.species, 'area_label', new.public_area_label));
  return new;
end;
$$;

-- Encontrado / visto solto publicado: Radar + Guardiões.
create or replace function private.found_cases_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.match_found_case(new.id);
  perform private.notify_guardians('found', 'found:' || new.short_code,
    extensions.st_setsrid(extensions.st_makepoint(new.public_lng, new.public_lat), 4326)::extensions.geography, new.reporter_id,
    jsonb_build_object('found_code', new.short_code, 'species', new.species, 'custody', new.custody, 'area_label', new.public_area_label));
  return new;
end;
$$;

-- Reencontro: quem foi avisado como Guardião recebe "resolvido" (só in-app, sem push).
create or replace function private.lost_cases_after_found()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pet_name text;
begin
  select name into pet_name from public.pets where id = new.pet_id;
  insert into public.notifications (user_id, kind, payload)
  select distinct n.user_id, 'guardian_resolved', jsonb_build_object('code', new.short_code, 'pet_name', pet_name)
    from public.notifications n
   where n.kind = 'guardian_alert' and n.payload ->> 'case_key' = 'lost:' || new.short_code;
  return new;
end;
$$;

create trigger lost_cases_after_found
  after update of status on public.lost_cases
  for each row when (old.status = 'ACTIVE' and new.status = 'FOUND')
  execute function private.lost_cases_after_found();

-- ---------------------------------------------------------------------------
-- Despachante (servidor do app, chave secreta): pega um lote e devolve o resultado.
-- ---------------------------------------------------------------------------
create or replace function public.claim_push_batch(p_limit integer default 50)
returns table (
  outbox_id bigint,
  user_id uuid,
  kind text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz,
  notification_id uuid,
  quiet_night boolean,
  subscriptions jsonb
)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.push_outbox o set status = 'SENDING'
     where o.id in (
       select id from public.push_outbox where status = 'PENDING'
        order by created_at limit least(greatest(p_limit, 1), 200)
        for update skip locked)
    returning o.id, o.notification_id, o.user_id
  )
  select c.id, c.user_id, n.kind, n.payload, n.read_at, n.created_at, n.id,
         coalesce(g.quiet_night, true),
         coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                     from public.push_subscriptions s where s.user_id = c.user_id), '[]'::jsonb)
    from claimed c
    join public.notifications n on n.id = c.notification_id
    left join public.guardian_settings g on g.user_id = c.user_id;
$$;

create or replace function public.finish_push(p_outbox_id bigint, p_status text, p_reason text default null, p_dead_subscriptions uuid[] default '{}', p_ok_subscriptions uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_outbox set status = p_status, reason = left(p_reason, 200), processed_at = now() where id = p_outbox_id;
  delete from public.push_subscriptions where id = any(p_dead_subscriptions);
  update public.push_subscriptions set last_success_at = now() where id = any(p_ok_subscriptions);
end;
$$;

revoke all on function public.claim_push_batch(integer), public.finish_push(bigint, text, text, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer), public.finish_push(bigint, text, text, uuid[], uuid[]) to service_role;
