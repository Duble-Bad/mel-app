-- MEL — Milestone 15: parceiros básicos (empresas do mundo pet).
-- Cadastro aprovado pela moderação; diretório público por proximidade;
-- ofertas com selo "Patrocinado" (só a moderação marca). Planos sem cobrança.

create type public.business_category as enum ('vet', 'petshop', 'grooming', 'hotel', 'trainer', 'ngo', 'other');
create type public.business_status as enum ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

create table public.plans (
  code        text primary key check (code in ('FREE', 'LOCAL', 'PRO', 'PREMIUM')),
  name        text not null,
  features    jsonb not null default '[]',
  price_cents integer,            -- null = sem cobrança (MVP)
  active      boolean not null default true,
  sort        smallint not null default 0
);

insert into public.plans (code, name, features, price_cents, sort) values
  ('FREE', 'Gratuito', '["Perfil no diretório", "Endereço e contatos", "Aparece no mapa"]', null, 1),
  ('LOCAL', 'Local', '["Tudo do Gratuito", "Ofertas no perfil"]', null, 2),
  ('PRO', 'Profissional', '["Tudo do Local", "Destaque em buscas próximas"]', null, 3),
  ('PREMIUM', 'Premium', '["Tudo do Profissional", "Ofertas patrocinadas (rotuladas)"]', null, 4)
on conflict (code) do nothing;

alter table public.plans enable row level security;
create policy "plans: todos leem" on public.plans for select to anon, authenticated using (active);
revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;

create table public.businesses (
  id            uuid primary key default gen_random_uuid(),
  short_code    text not null unique,
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  status        public.business_status not null default 'PENDING_REVIEW',
  name          text not null check (char_length(btrim(name)) between 2 and 80),
  category      public.business_category not null,
  description   text not null check (char_length(btrim(description)) between 20 and 800),
  -- Endereço de estabelecimento é público (não é casa de ninguém).
  address_label text not null check (char_length(address_label) <= 200),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  point         extensions.geography(Point, 4326) generated always as (
                  extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  phone         text check (phone ~ '^[0-9]{10,11}$'),
  whatsapp      text check (whatsapp ~ '^[0-9]{10,11}$'),
  website       text check (website ~ '^https://' and char_length(website) <= 200),
  instagram     text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  hours         text check (char_length(hours) <= 200),
  helps_lost    boolean not null default false,   -- ex.: leitor de microchip, abrigo temporário
  logo_path     text check (char_length(logo_path) <= 300),
  plan_code     text not null default 'FREE' references public.plans (code),
  review_note   text check (char_length(review_note) <= 300),
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index businesses_point_idx on public.businesses using gist (point) where status = 'APPROVED';
create index businesses_owner_idx on public.businesses (owner_id);

create or replace function private.generate_business_code()
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
    exit when not exists (select 1 from public.businesses where short_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function private.businesses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if private.is_suspended(new.owner_id) then
      raise exception 'Sua conta está suspensa. Fale com a equipe da MEL.' using errcode = '42501';
    end if;
    if (select count(*) from public.businesses where owner_id = new.owner_id) >= 5 then
      raise exception 'Limite de 5 empresas por conta.' using errcode = 'P0429';
    end if;
    new.short_code := private.generate_business_code();
    new.status := 'PENDING_REVIEW';
    new.plan_code := 'FREE';
    new.created_at := now();
  end if;
  if new.logo_path is not null and split_part(new.logo_path, '/', 1) <> new.owner_id::text then
    raise exception 'Logo inválido.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if (new.status is distinct from old.status or new.plan_code is distinct from old.plan_code) and not private.is_moderator() then
      raise exception 'Só a moderação aprova empresas e muda planos.' using errcode = '42501';
    end if;
    if new.status = 'APPROVED' and old.status <> 'APPROVED' then
      new.approved_at := now();
    end if;
    -- Mudou nome/categoria/endereço de uma empresa aprovada: volta para análise.
    if old.status = 'APPROVED' and new.status = 'APPROVED' and not private.is_moderator()
       and (new.name, new.category, new.address_label, new.lat, new.lng) is distinct from (old.name, old.category, old.address_label, old.lat, old.lng) then
      new.status := 'PENDING_REVIEW';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger businesses_before_write
  before insert or update on public.businesses
  for each row execute function private.businesses_before_write();

alter table public.businesses enable row level security;
create policy "businesses: dono vê" on public.businesses for select to authenticated using ((select auth.uid()) = owner_id);
create policy "businesses: moderação vê" on public.businesses for select to authenticated using ((select private.is_moderator()));
create policy "businesses: conta real cadastra" on public.businesses for insert to authenticated
  with check ((select auth.uid()) = owner_id and not (select private.is_anonymous_session()));
create policy "businesses: dono altera" on public.businesses for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "businesses: moderação altera" on public.businesses for update to authenticated
  using ((select private.is_moderator())) with check ((select private.is_moderator()));

revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to authenticated;
grant insert (owner_id, name, category, description, address_label, lat, lng, phone, whatsapp, website, instagram, hours, helps_lost, logo_path)
  on public.businesses to authenticated;
grant update (name, category, description, address_label, lat, lng, phone, whatsapp, website, instagram, hours, helps_lost, logo_path,
              status, plan_code, review_note)
  on public.businesses to authenticated;

-- ---------------------------------------------------------------------------
-- Ofertas
-- ---------------------------------------------------------------------------
create table public.business_offers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 3 and 80),
  description  text check (char_length(description) <= 300),
  starts_at    date,
  ends_at      date,
  is_sponsored boolean not null default false,   -- só a moderação marca; o selo é sempre visível
  created_at   timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index business_offers_business_idx on public.business_offers (business_id);

create or replace function private.business_offers_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator() then
    if tg_op = 'INSERT' and new.is_sponsored then
      raise exception 'Só a moderação marca ofertas como patrocinadas.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.is_sponsored is distinct from old.is_sponsored then
      raise exception 'Só a moderação marca ofertas como patrocinadas.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.businesses b where b.id = new.business_id and b.status = 'APPROVED') then
      raise exception 'A empresa precisa estar aprovada para publicar ofertas.' using errcode = '22023';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.business_offers where business_id = new.business_id) >= 10 then
      raise exception 'Limite de 10 ofertas por empresa.' using errcode = 'P0429';
    end if;
  end if;
  return new;
end;
$$;

create trigger business_offers_before_write
  before insert or update on public.business_offers
  for each row execute function private.business_offers_before_write();

alter table public.business_offers enable row level security;
create policy "offers: dono gerencia" on public.business_offers for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "offers: moderação gerencia" on public.business_offers for all to authenticated
  using ((select private.is_moderator())) with check ((select private.is_moderator()));
revoke all on public.business_offers from anon, authenticated;
grant select, delete on public.business_offers to authenticated;
grant insert (business_id, title, description, starts_at, ends_at, is_sponsored), update (title, description, starts_at, ends_at, is_sponsored)
  on public.business_offers to authenticated;

-- ---------------------------------------------------------------------------
-- Leitura pública
-- ---------------------------------------------------------------------------
create or replace function private.business_json(b public.businesses, p_origin extensions.geography default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', b.short_code, 'status', b.status, 'name', b.name, 'category', b.category, 'description', b.description,
    'address_label', b.address_label, 'lat', b.lat, 'lng', b.lng, 'phone', b.phone, 'whatsapp', b.whatsapp,
    'website', b.website, 'instagram', b.instagram, 'hours', b.hours, 'helps_lost', b.helps_lost,
    'logo_path', b.logo_path, 'plan_code', b.plan_code,
    'distance_m', case when p_origin is not null then round(extensions.st_distance(b.point, p_origin))::int end,
    'is_owner', coalesce(b.owner_id = (select auth.uid()), false),
    'review_note', case when b.owner_id = (select auth.uid()) or private.is_moderator() then b.review_note end,
    'offers', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description,
        'starts_at', o.starts_at, 'ends_at', o.ends_at, 'is_sponsored', o.is_sponsored) order by o.is_sponsored desc, o.created_at desc)
      from public.business_offers o
      where o.business_id = b.id and (o.ends_at is null or o.ends_at >= current_date)), '[]'::jsonb));
$$;

revoke all on function private.business_json(public.businesses, extensions.geography) from public, anon, authenticated;

create or replace function public.get_business(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.business_json(b) from public.businesses b
   where b.short_code = lower(p_code) and (b.status = 'APPROVED' or b.owner_id = (select auth.uid()) or private.is_moderator());
$$;

create or replace function public.list_businesses(
  p_lat double precision, p_lng double precision, p_radius_m integer default 10000,
  p_categories public.business_category[] default null, p_limit integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with o as (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g)
  select coalesce(jsonb_agg(private.business_json(b, o.g) order by extensions.st_distance(b.point, o.g)), '[]'::jsonb)
    from public.businesses b, o
   where b.status = 'APPROVED'
     and extensions.st_dwithin(b.point, o.g, least(greatest(coalesce(p_radius_m, 10000), 500), 50000))
     and (p_categories is null or b.category = any(p_categories))
   limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.admin_list_businesses_for_review()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_moderator();
  return coalesce((select jsonb_agg(private.business_json(b) order by b.created_at) from public.businesses b where b.status = 'PENDING_REVIEW'), '[]'::jsonb);
end;
$$;

create or replace function public.admin_review_business(p_code text, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.businesses;
begin
  perform private.require_moderator();
  select * into b from public.businesses where short_code = lower(p_code) and status = 'PENDING_REVIEW';
  if b.id is null then
    raise exception 'Empresa não está aguardando aprovação.' using errcode = '22023';
  end if;
  update public.businesses
     set status = case when p_approve then 'APPROVED'::public.business_status else 'REJECTED'::public.business_status end,
         review_note = nullif(btrim(p_note), '')
   where id = b.id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason)
  values ((select auth.uid()), case when p_approve then 'approve' else 'reject' end, 'business', b.id, nullif(btrim(p_note), ''));
end;
$$;

revoke all on function public.get_business(text), public.list_businesses(double precision, double precision, integer, public.business_category[], integer) from public;
grant execute on function public.get_business(text), public.list_businesses(double precision, double precision, integer, public.business_category[], integer) to anon, authenticated;
revoke all on function public.admin_list_businesses_for_review(), public.admin_review_business(text, boolean, text) from public, anon;
grant execute on function public.admin_list_businesses_for_review(), public.admin_review_business(text, boolean, text) to authenticated;
