-- MEL — Milestone 5: alerta "Perdi meu pet"
-- Privacidade: o ponto exato fica privado; o público vê um ponto aproximado
-- (grade de 250 m) e só bairro/cidade. Leitura pública apenas por funções.

create type public.lost_case_status as enum ('DRAFT', 'ACTIVE', 'FOUND', 'CLOSED', 'REMOVED');

-- ---------------------------------------------------------------------------
-- Aproxima um ponto ao centro de uma célula de grade. Espelha fuzzPoint
-- (packages/core/src/geo/geo.ts) — os testes conferem a paridade.
-- ---------------------------------------------------------------------------
create or replace function private.fuzz_lat_lng(lat double precision, lng double precision, cell_m double precision default 250)
returns table (fuzzed_lat double precision, fuzzed_lng double precision)
language sql
immutable
set search_path = ''
as $$
  with g as (
    select (floor(lat / (cell_m / 111320.0)) + 0.5) * (cell_m / 111320.0) as flat
  )
  select
    round(g.flat::numeric, 6)::double precision,
    round(((floor(lng / (cell_m / (111320.0 * cos(radians(g.flat))))) + 0.5)
           * (cell_m / (111320.0 * cos(radians(g.flat)))))::numeric, 6)::double precision
  from g;
$$;

-- Código curto do link público: /alerta/k3q9xm (sem caracteres ambíguos).
create or replace function private.generate_short_code()
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
    exit when not exists (select 1 from public.lost_cases where short_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- lost_cases
-- ---------------------------------------------------------------------------
create table public.lost_cases (
  id                      uuid primary key default gen_random_uuid(),
  short_code              text not null unique,
  pet_id                  uuid not null references public.pets (id) on delete cascade,
  owner_id                uuid not null references public.profiles (id) on delete cascade,
  status                  public.lost_case_status not null default 'DRAFT',

  -- Onde foi visto pela última vez. Exato = privado (pode ser a casa do tutor).
  last_seen_lat           double precision check (last_seen_lat between -90 and 90),
  last_seen_lng           double precision check (last_seen_lng between -180 and 180),
  last_seen_point         extensions.geography(Point, 4326) generated always as (
                            case when last_seen_lat is not null and last_seen_lng is not null
                              then extensions.st_setsrid(extensions.st_makepoint(last_seen_lng, last_seen_lat), 4326)::extensions.geography
                            end) stored,
  last_seen_label         text check (char_length(last_seen_label) <= 200),
  -- Público: ponto aproximado (ou exato, se o tutor escolher) e só bairro/cidade.
  public_point_exact      boolean not null default false,
  public_lat              double precision,
  public_lng              double precision,
  public_point            extensions.geography(Point, 4326) generated always as (
                            case when public_lat is not null and public_lng is not null
                              then extensions.st_setsrid(extensions.st_makepoint(public_lng, public_lat), 4326)::extensions.geography
                            end) stored,
  public_area_label       text check (char_length(public_area_label) <= 120),
  city                    text check (char_length(city) <= 80),
  state                   text check (char_length(state) = 2),

  lost_at                 timestamptz check (lost_at <= now() + interval '5 minutes'),
  lost_at_uncertain       boolean not null default false,
  wearing                 text[] not null default '{}'
                            check (wearing <@ array['collar', 'clothes', 'harness', 'tag']::text[]),
  notes                   text check (char_length(notes) <= 500),

  -- Contato: nada é público sem o tutor marcar.
  contact_chat            boolean not null default true,
  contact_whatsapp_public boolean not null default false,
  contact_phone_public    boolean not null default false,
  contact_phone           text check (contact_phone ~ '^[0-9]{10,11}$'),

  indexable               boolean not null default false,
  published_at            timestamptz,
  found_at                timestamptz,
  found_how               text check (char_length(found_how) <= 60),
  reunion_story           text check (char_length(reunion_story) <= 2000),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint lost_cases_phone_required check (
    not (contact_whatsapp_public or contact_phone_public) or contact_phone is not null
  )
);

alter table public.lost_cases alter column short_code set default private.generate_short_code();

comment on table public.lost_cases is 'Alertas de desaparecimento. Leitura pública só via get_public_lost_case / nearby_lost_cases.';
comment on column public.lost_cases.last_seen_lat is 'PRIVADO: local exato informado pelo tutor.';

-- Um alerta aberto (rascunho ou ativo) por pet.
create unique index lost_cases_one_open_per_pet on public.lost_cases (pet_id) where status in ('DRAFT', 'ACTIVE');
create index lost_cases_owner_idx on public.lost_cases (owner_id, created_at desc);
create index lost_cases_active_public_point_idx on public.lost_cases using gist (public_point) where status = 'ACTIVE';
create index lost_cases_status_lost_at_idx on public.lost_cases (status, lost_at desc);

create trigger lost_cases_set_updated_at
  before update on public.lost_cases
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Regras de negócio no banco: ponto público, pet do próprio tutor e
-- transições de status válidas.
-- ---------------------------------------------------------------------------
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
      if old_status not in ('ACTIVE', 'FOUND') then
        raise exception 'Transição de status inválida: % → %', old_status, new.status using errcode = '22023';
      end if;
    elsif new.status = 'DRAFT' and old_status is not null then
      raise exception 'Um alerta publicado não volta a rascunho.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger lost_cases_before_write
  before insert or update on public.lost_cases
  for each row execute function private.lost_cases_before_write();

-- ---------------------------------------------------------------------------
-- RLS: tabela base só para o dono e a moderação.
-- ---------------------------------------------------------------------------
alter table public.lost_cases enable row level security;

create policy "lost_cases: dono vê os seus"
  on public.lost_cases for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "lost_cases: moderação vê todos"
  on public.lost_cases for select to authenticated
  using ((select private.is_moderator()));

create policy "lost_cases: conta real cria para o próprio pet"
  on public.lost_cases for insert to authenticated
  with check ((select auth.uid()) = owner_id and not (select private.is_anonymous_session()));

create policy "lost_cases: dono edita"
  on public.lost_cases for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "lost_cases: dono apaga rascunho"
  on public.lost_cases for delete to authenticated
  using ((select auth.uid()) = owner_id and status = 'DRAFT');

revoke all on public.lost_cases from anon, authenticated;
grant select, delete on public.lost_cases to authenticated;
grant insert (pet_id, owner_id, status, last_seen_lat, last_seen_lng, last_seen_label, public_point_exact,
              public_area_label, city, state, lost_at, lost_at_uncertain, wearing, notes, contact_chat,
              contact_whatsapp_public, contact_phone_public, contact_phone, indexable)
  on public.lost_cases to authenticated;
grant update (status, last_seen_lat, last_seen_lng, last_seen_label, public_point_exact, public_area_label,
              city, state, lost_at, lost_at_uncertain, wearing, notes, contact_chat, contact_whatsapp_public,
              contact_phone_public, contact_phone, indexable, found_how, reunion_story)
  on public.lost_cases to authenticated;

-- ---------------------------------------------------------------------------
-- Leitura pública (somente campos seguros)
-- ---------------------------------------------------------------------------
create or replace function private.pet_public_json(p_pet_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.name, 'species', p.species, 'breed', p.breed, 'sex', p.sex, 'size', p.size,
    'color_primary', p.color_primary, 'colors_secondary', p.colors_secondary,
    'unique_marks', p.unique_marks, 'description', p.description, 'mel_id', p.mel_id,
    'birth_date', p.birth_date, 'age_estimate_months', p.age_estimate_months, 'weight_kg', p.weight_kg,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('path', ph.storage_path, 'thumb_path', ph.thumb_path, 'is_primary', ph.is_primary)
                       order by ph.is_primary desc, ph.position)
        from public.pet_photos ph where ph.pet_id = p.id), '[]'::jsonb)
  )
  from public.pets p where p.id = p_pet_id;
$$;

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

create or replace function public.nearby_lost_cases(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 5000,
  p_limit integer default 20
)
returns table (
  code text,
  pet_name text,
  species public.species,
  breed text,
  size public.pet_size,
  photo_thumb_path text,
  area_label text,
  lost_at timestamptz,
  public_lat double precision,
  public_lng double precision,
  distance_m integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select
    c.short_code, p.name, p.species, p.breed, p.size,
    (select ph.thumb_path from public.pet_photos ph where ph.pet_id = p.id
      order by ph.is_primary desc, ph.position limit 1),
    c.public_area_label, c.lost_at, c.public_lat, c.public_lng,
    round(extensions.st_distance(c.public_point, origin.g))::integer
  from public.lost_cases c
  join public.pets p on p.id = c.pet_id
  cross join origin
  where c.status = 'ACTIVE'
    and extensions.st_dwithin(c.public_point, origin.g, least(greatest(p_radius_m, 100), 50000))
  order by extensions.st_distance(c.public_point, origin.g)
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.get_public_lost_case(text), public.nearby_lost_cases(double precision, double precision, integer, integer) from public;
grant execute on function public.get_public_lost_case(text), public.nearby_lost_cases(double precision, double precision, integer, integer) to anon, authenticated;
revoke all on function private.pet_public_json(uuid), private.fuzz_lat_lng(double precision, double precision, double precision) from public, anon;

-- Teste de paridade TS × SQL do ponto aproximado (somente leitura, sem dados).
create or replace function public.debug_fuzz_point(lat double precision, lng double precision)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('lat', f.fuzzed_lat, 'lng', f.fuzzed_lng) from private.fuzz_lat_lng(lat, lng, 250) f;
$$;
grant execute on function public.debug_fuzz_point(double precision, double precision) to authenticated;
