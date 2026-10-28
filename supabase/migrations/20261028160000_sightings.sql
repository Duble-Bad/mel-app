-- MEL — Milestone 6: avistamentos, linha do tempo e notificações in-app
-- Avistamento pode vir de sessão anônima (sem cadastro). Antispam: limite de
-- envios no banco + captcha verificado no servidor (rota /api/avistamentos).

create type public.sighting_direction as enum ('N', 'S', 'E', 'W', 'unknown');
create type public.sighting_state as enum ('walking', 'running', 'stopped', 'with_person', 'injured', 'scared', 'other');
create type public.sighting_status as enum ('VISIBLE', 'HIDDEN');

create table public.sightings (
  id            uuid primary key default gen_random_uuid(),
  lost_case_id  uuid not null references public.lost_cases (id) on delete cascade,
  reporter_id   uuid references public.profiles (id) on delete set null,
  -- Local do avistamento: é a pista (rua), então é público.
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  point         extensions.geography(Point, 4326) generated always as (
                  extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  place_label   text check (char_length(place_label) <= 200),
  seen_at       timestamptz not null,
  direction     public.sighting_direction not null default 'unknown',
  states        public.sighting_state[] not null default '{}',
  notes         text check (char_length(notes) <= 500),
  photo_path    text check (char_length(photo_path) <= 300),
  status        public.sighting_status not null default 'VISIBLE',
  created_at    timestamptz not null default now()
);

create index sightings_case_seen_idx on public.sightings (lost_case_id, seen_at);
create index sightings_reporter_idx on public.sightings (reporter_id, created_at desc);
create index sightings_point_idx on public.sightings using gist (point);

-- Regras: só alerta ativo; horário plausível; foto na pasta de quem enviou;
-- limite de envios (antispam).
create or replace function private.sightings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_row public.lost_cases;
begin
  select * into case_row from public.lost_cases where id = new.lost_case_id;
  if case_row.id is null or case_row.status <> 'ACTIVE' then
    raise exception 'Este alerta não está mais ativo.' using errcode = '22023';
  end if;
  if new.seen_at > now() + interval '5 minutes' then
    raise exception 'O horário do avistamento não pode estar no futuro.' using errcode = '22023';
  end if;
  if new.seen_at < coalesce(case_row.lost_at, case_row.created_at) - interval '1 day' then
    raise exception 'O avistamento é de antes do desaparecimento.' using errcode = '22023';
  end if;
  if new.photo_path is not null and split_part(new.photo_path, '/', 1) <> new.reporter_id::text then
    raise exception 'Foto inválida.' using errcode = '42501';
  end if;
  if (select count(*) from public.sightings
       where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Você já enviou muitos avistamentos agora. Tente de novo mais tarde.' using errcode = 'P0429';
  end if;
  if (select count(*) from public.sightings
       where reporter_id = new.reporter_id and lost_case_id = new.lost_case_id
         and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Você já enviou avistamentos para este alerta agora há pouco. Obrigado!' using errcode = 'P0429';
  end if;
  new.status := 'VISIBLE';
  new.created_at := now();
  return new;
end;
$$;

create trigger sightings_before_insert
  before insert on public.sightings
  for each row execute function private.sightings_before_insert();

alter table public.sightings enable row level security;

create policy "sightings: qualquer sessão envia em seu nome"
  on public.sightings for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

create policy "sightings: quem enviou vê os seus"
  on public.sightings for select to authenticated
  using ((select auth.uid()) = reporter_id);

create policy "sightings: tutor vê os do seu alerta"
  on public.sightings for select to authenticated
  using (exists (select 1 from public.lost_cases c where c.id = lost_case_id and c.owner_id = (select auth.uid())));

create policy "sightings: tutor oculta/mostra no seu alerta"
  on public.sightings for update to authenticated
  using (exists (select 1 from public.lost_cases c where c.id = lost_case_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.lost_cases c where c.id = lost_case_id and c.owner_id = (select auth.uid())));

create policy "sightings: moderação vê todos"
  on public.sightings for select to authenticated
  using ((select private.is_moderator()));

revoke all on public.sightings from anon, authenticated;
grant select on public.sightings to authenticated;
grant insert (lost_case_id, reporter_id, lat, lng, place_label, seen_at, direction, states, notes, photo_path)
  on public.sightings to authenticated;
grant update (status) on public.sightings to authenticated;

-- ---------------------------------------------------------------------------
-- Fotos de avistamento: qualquer sessão (inclusive anônima) envia na própria pasta.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sighting-media', 'sighting-media', true, 5 * 1024 * 1024, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "sighting-media: sessão envia na própria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'sighting-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "sighting-media: sessão lista a própria pasta"
  on storage.objects for select to authenticated
  using (bucket_id = 'sighting-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Notificações in-app (Realtime). O banco cria; o usuário só lê e marca lida.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('sighting_new')),
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: dono lê"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "notifications: dono marca como lida"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

create or replace function private.notify_sighting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select lc.owner_id, lc.short_code, p.name as pet_name
    into c
    from public.lost_cases lc join public.pets p on p.id = lc.pet_id
   where lc.id = new.lost_case_id;
  -- O próprio tutor registrando não gera aviso para si.
  if c.owner_id is distinct from new.reporter_id then
    insert into public.notifications (user_id, kind, payload)
    values (c.owner_id, 'sighting_new', jsonb_build_object(
      'code', c.short_code, 'pet_name', c.pet_name, 'sighting_id', new.id,
      'place_label', new.place_label, 'seen_at', new.seen_at));
  end if;
  return new;
end;
$$;

create trigger sightings_notify
  after insert on public.sightings
  for each row execute function private.notify_sighting();

-- ---------------------------------------------------------------------------
-- Linha do tempo pública: último local conhecido + avistamentos visíveis.
-- ---------------------------------------------------------------------------
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
      'hidden', s.status = 'HIDDEN', 'mine', s.reporter_id = (select auth.uid()))
    order by s.seen_at), '[]'::jsonb)
  from public.lost_cases c
  join public.sightings s on s.lost_case_id = c.id
  where c.short_code = lower(p_code)
    and c.status in ('ACTIVE', 'FOUND')
    -- Ocultos só aparecem para o tutor (que pode reexibir).
    and (s.status = 'VISIBLE' or c.owner_id = (select auth.uid()));
$$;

revoke all on function public.get_lost_case_timeline(text) from public;
grant execute on function public.get_lost_case_timeline(text) to anon, authenticated;
