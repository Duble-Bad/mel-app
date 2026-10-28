-- MEL — Milestone 3: pets, MEL ID, fotos e dados privados

create type public.species as enum ('dog', 'cat', 'other');
create type public.pet_sex as enum ('male', 'female', 'unknown');
create type public.pet_size as enum ('mini', 'small', 'medium', 'large', 'giant');

-- ---------------------------------------------------------------------------
-- MEL ID: identificador curto, legível e impossível de confundir em cartaz
-- (sem 0/O, 1/I/L). Ex.: MEL-7K3Q9H
-- ---------------------------------------------------------------------------
create or replace function private.generate_mel_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
begin
  loop
    candidate := 'MEL-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.pets where mel_id = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- pets
-- ---------------------------------------------------------------------------
create table public.pets (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles (id) on delete cascade,
  mel_id              text not null unique,
  name                text not null check (char_length(name) between 1 and 60),
  species             public.species not null,
  breed               text check (char_length(breed) <= 80),
  sex                 public.pet_sex not null default 'unknown',
  birth_date          date check (birth_date <= current_date),
  age_estimate_months smallint check (age_estimate_months between 0 and 360),
  size                public.pet_size,
  weight_kg           numeric(5, 2) check (weight_kg > 0 and weight_kg < 150),
  color_primary       text check (char_length(color_primary) <= 30),
  colors_secondary    text[] not null default '{}' check (cardinality(colors_secondary) <= 5),
  description         text check (char_length(description) <= 1000),
  unique_marks        text check (char_length(unique_marks) <= 500),
  neutered            boolean,
  has_microchip       boolean,
  city                text check (char_length(city) <= 80),
  state               text check (state in (
                        'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
                        'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  -- Página /pet/[mel_id] visível para qualquer pessoa. Um alerta ativo
  -- publica o pet independentemente disto (M5).
  is_public           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.pets alter column mel_id set default private.generate_mel_id();

comment on table public.pets is 'Pets cadastrados. Dados que o tutor não quer públicos ficam em pet_private_details.';

create index pets_owner_idx on public.pets (owner_id, created_at desc);
create index pets_public_idx on public.pets (id) where is_public;
create index pets_breed_trgm_idx on public.pets using gin (breed extensions.gin_trgm_ops);

create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Dados privados (prova de posse). Tabela separada: nenhum select em `pets`
-- consegue vazá-los por engano.
-- ---------------------------------------------------------------------------
create table public.pet_private_details (
  pet_id           uuid primary key references public.pets (id) on delete cascade,
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  microchip_number text check (char_length(microchip_number) <= 30),
  hidden_marks     text check (char_length(hidden_marks) <= 500),
  ownership_notes  text check (char_length(ownership_notes) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index pet_private_details_owner_idx on public.pet_private_details (owner_id);

create trigger pet_private_details_set_updated_at
  before update on public.pet_private_details
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Fotos
-- ---------------------------------------------------------------------------
create table public.pet_photos (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  thumb_path   text not null check (char_length(thumb_path) <= 300),
  is_primary   boolean not null default false,
  position     smallint not null default 0,
  width        smallint,
  height       smallint,
  created_at   timestamptz not null default now()
);

create index pet_photos_pet_idx on public.pet_photos (pet_id, position);
create index pet_photos_owner_idx on public.pet_photos (owner_id);
create unique index pet_photos_one_primary_idx on public.pet_photos (pet_id) where is_primary;

-- Mantém owner_id das tabelas filhas igual ao dono do pet (não confia no cliente).
create or replace function private.check_pet_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.pets where id = new.pet_id and owner_id = new.owner_id) then
    raise exception 'pet não pertence a este usuário' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger pet_photos_check_owner
  before insert or update on public.pet_photos
  for each row execute function private.check_pet_owner();

create trigger pet_private_details_check_owner
  before insert or update on public.pet_private_details
  for each row execute function private.check_pet_owner();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pets enable row level security;
alter table public.pet_private_details enable row level security;
alter table public.pet_photos enable row level security;

-- pets
create policy "pets: público vê pets públicos"
  on public.pets for select
  to anon, authenticated
  using (is_public);

create policy "pets: dono vê os seus"
  on public.pets for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "pets: moderação vê todos"
  on public.pets for select
  to authenticated
  using ((select private.is_moderator()));

create policy "pets: conta real cadastra os seus"
  on public.pets for insert
  to authenticated
  with check ((select auth.uid()) = owner_id and not (select private.is_anonymous_session()));

create policy "pets: dono edita"
  on public.pets for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "pets: dono remove"
  on public.pets for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.pets from anon, authenticated;
grant select on public.pets to anon, authenticated;
grant insert, delete on public.pets to authenticated;
-- mel_id, owner_id e datas de sistema não são editáveis.
grant update (name, species, breed, sex, birth_date, age_estimate_months, size, weight_kg, color_primary,
              colors_secondary, description, unique_marks, neutered, has_microchip, city, state, is_public)
  on public.pets to authenticated;

-- pet_private_details: somente o dono. Nem moderação lê por padrão.
create policy "pet_private: só o dono"
  on public.pet_private_details for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

revoke all on public.pet_private_details from anon, authenticated;
grant select, insert, update, delete on public.pet_private_details to authenticated;

-- pet_photos: visíveis quando o pet é visível
create policy "pet_photos: visíveis com o pet"
  on public.pet_photos for select
  to anon, authenticated
  using (exists (
    select 1 from public.pets p
    where p.id = pet_id and (p.is_public or p.owner_id = (select auth.uid()))
  ));

create policy "pet_photos: dono gerencia"
  on public.pet_photos for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id and not (select private.is_anonymous_session()));

revoke all on public.pet_photos from anon, authenticated;
grant select on public.pet_photos to anon, authenticated;
grant insert, update, delete on public.pet_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: pet-photos/<owner_id>/<pet_id>/<arquivo>
-- Bucket público para servir imagens rápido; nomes com UUID não são adivinháveis.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-photos', 'pet-photos', true, 5 * 1024 * 1024, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "pet-photos: dono envia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select private.is_anonymous_session())
  );

create policy "pet-photos: dono lista"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "pet-photos: dono remove"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
