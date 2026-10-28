-- MEL — Milestone 1: fundação
-- Extensões, schema privado, helpers, profiles (+ RLS) e health check.

-- ---------------------------------------------------------------------------
-- Extensões (no schema `extensions`, como recomenda o Supabase)
-- ---------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Schema privado: funções security definer ficam fora do schema exposto pela API
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- updated_at automático
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('user', 'moderator', 'admin');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text check (char_length(display_name) between 1 and 80),
  avatar_url       text check (char_length(avatar_url) <= 500),
  city             text check (char_length(city) between 1 and 80),
  state            text check (state in (
                     'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
                     'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  role             public.user_role not null default 'user',
  is_anonymous     boolean not null default false,
  -- Contatos privados: nunca expostos por view pública; só exibidos se o
  -- usuário autorizar em cada alerta.
  phone_private    text check (char_length(phone_private) <= 20),
  whatsapp_private text check (char_length(whatsapp_private) <= 20),
  onboarded_at     timestamptz,
  suspended_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'Dados do usuário. Telefones são privados; leitura pública só via views específicas.';

create index profiles_role_idx on public.profiles (role) where role <> 'user';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Papel do usuário atual (usado nas políticas). security definer evita recursão de RLS.
create or replace function private.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_role() = 'admin', false);
$$;

create or replace function private.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_role() in ('moderator', 'admin'), false);
$$;

revoke all on function private.my_role(), private.is_admin(), private.is_moderator() from public, anon;
grant execute on function private.my_role(), private.is_admin(), private.is_moderator() to authenticated;

-- Cria o profile quando um usuário (inclusive anônimo) se cadastra.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, is_anonymous)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80), ''),
    nullif(left(new.raw_user_meta_data ->> 'avatar_url', 500), ''),
    coalesce(new.is_anonymous, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Quando um usuário anônimo vira conta real, atualiza o profile.
create or replace function private.handle_user_converted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set is_anonymous = false
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_converted
  after update of is_anonymous on auth.users
  for each row
  when (old.is_anonymous is true and new.is_anonymous is false)
  execute function private.handle_user_converted();

-- ---------------------------------------------------------------------------
-- RLS de profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: usuário lê o próprio"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: moderação lê todos"
  on public.profiles for select
  to authenticated
  using ((select private.is_moderator()));

create policy "profiles: usuário edita o próprio"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Privilégios por coluna: o usuário não consegue alterar role, is_anonymous,
-- suspended_at nem datas de sistema, mesmo sendo dono da linha.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, city, state, phone_private, whatsapp_private, onboarded_at)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Health check (público): confirma banco + PostGIS
-- ---------------------------------------------------------------------------
create or replace function public.health_check()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'postgis', extensions.postgis_lib_version(),
    'checked_at', now()
  );
$$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;
