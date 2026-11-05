-- Parceiros: tipo (empresa, ONG, protetor independente), documentos e privacidade
-- (decisões 8, 9 e 10 do proprietário, 2026-11-05).
--
--   1. businesses.partner_kind: company | ngo | independent (imutável depois do
--      cadastro). Empresa e ONG exigem CNPJ válido (dígitos conferidos aqui, com
--      o formato alfanumérico da IN RFB 2.229/2024). Protetor independente não
--      tem CNPJ nem endereço: guardamos só bairro/cidade e um ponto arredondado
--      em ~1 km (o exato nunca chega ao banco). ONG também usa o ponto aproximado.
--   2. CNPJ, razão social e responsável ficam em businesses, que o público nunca
--      lê direto (só pelas RPCs, que não devolvem esses campos). O público vê só
--      "cnpj_verified", verdadeiro apenas com consulta válida + aprovação.
--   3. business_cnpj_checks: fila/resultado da consulta automática (desligada no
--      piloto: nenhuma fonte oficial gratuita autorizada). Só a moderação lê;
--      só o servidor (service role) grava.
--   4. partner_documents: CPF do protetor CIFRADO no servidor Next.js
--      (AES-256-GCM; a chave nunca vem ao banco) + HMAC-SHA256 para detectar
--      duplicidade (índice único). Nem anon nem authenticated têm acesso: só o
--      service role, pelas rotas do servidor.
--   5. partner_document_access_log: quem viu/gravou/apagou o CPF, quando e de
--      qual parceiro (sem o valor). A moderação lê; só o servidor grava.
--   6. pii_access_grants: moderadores AUTORIZADOS explicitamente a ver CPF
--      (concedido por SQL pelo proprietário). Ser moderador não basta.
--   7. Retenção: recusa apaga o CPF cifrado (e registra); excluir a conta ou o
--      cadastro apaga em cascata. Protetor só é aprovado com CPF guardado.
--   8. Ofertas: a ordem pública deixa de favorecer "Patrocinado" (piloto sem
--      patrocínio). A coluna is_sponsored continua; a UI decide pela flag.

create type public.partner_kind as enum ('company', 'ngo', 'independent');
create type public.cnpj_check_status as enum ('PENDING', 'VERIFIED', 'NOT_FOUND', 'INACTIVE', 'ERROR');

alter table public.businesses
  add column partner_kind     public.partner_kind not null default 'company',
  add column cnpj             text check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  add column legal_name       text check (char_length(btrim(legal_name)) between 2 and 150),
  add column responsible_name text check (char_length(btrim(responsible_name)) between 2 and 120),
  add column activity_area    text check (char_length(btrim(activity_area)) between 2 and 80),
  add column city             text check (char_length(btrim(city)) between 2 and 80),
  add column neighborhood     text check (char_length(btrim(neighborhood)) between 2 and 80);

create index businesses_cnpj_idx on public.businesses (cnpj) where cnpj is not null;

-- ---------------------------------------------------------------------------
-- CNPJ: módulo 11 com valor = código ASCII − 48 (vale para o numérico e o
-- alfanumérico). Sequências repetidas (000…, 111…) são recusadas.
-- ---------------------------------------------------------------------------
create or replace function private.is_valid_cnpj(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  w1 constant int[] := '{5,4,3,2,9,8,7,6,5,4,3,2}';
  w2 constant int[] := '{6,5,4,3,2,9,8,7,6,5,4,3,2}';
  s int;
  r int;
  d1 int;
  d2 int;
begin
  if p is null or p !~ '^[0-9A-Z]{12}[0-9]{2}$' or p ~ '^(.)\1{13}$' then
    return false;
  end if;
  s := 0;
  for i in 1..12 loop
    s := s + (ascii(substr(p, i, 1)) - 48) * w1[i];
  end loop;
  r := s % 11;
  d1 := case when r < 2 then 0 else 11 - r end;
  s := 0;
  for i in 1..13 loop
    s := s + (ascii(substr(p, i, 1)) - 48) * w2[i];
  end loop;
  r := s % 11;
  d2 := case when r < 2 then 0 else 11 - r end;
  return d1 = ascii(substr(p, 13, 1)) - 48 and d2 = ascii(substr(p, 14, 1)) - 48;
end;
$$;

revoke all on function private.is_valid_cnpj(text) from public, anon;

-- ---------------------------------------------------------------------------
-- Regras por tipo no trigger (vale para qualquer cliente, não só para o app).
-- ---------------------------------------------------------------------------
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
    if not private.is_moderator() then
      new.review_note := null;
    end if;
    -- Empresa e ONG precisam de ao menos um contato público.
    if new.partner_kind <> 'independent'
       and new.phone is null and new.whatsapp is null and new.website is null and new.instagram is null then
      raise exception 'Informe ao menos um contato: telefone, WhatsApp, site ou Instagram.' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.partner_kind is distinct from old.partner_kind then
    raise exception 'O tipo de parceiro não muda depois do cadastro.' using errcode = '42501';
  end if;

  -- Documentos por tipo.
  if new.partner_kind = 'independent' then
    if new.cnpj is not null or new.legal_name is not null then
      raise exception 'Protetor independente não informa CNPJ nem razão social.' using errcode = '22023';
    end if;
  elsif tg_op = 'INSERT' or new.cnpj is distinct from old.cnpj then
    if new.cnpj is null then
      raise exception 'Informe o CNPJ.' using errcode = '22023';
    end if;
    if not private.is_valid_cnpj(new.cnpj) then
      raise exception 'Confira os 14 caracteres do CNPJ.' using errcode = '22023';
    end if;
  end if;
  if new.partner_kind = 'company' and tg_op = 'INSERT' and new.legal_name is null then
    raise exception 'Informe a razão social.' using errcode = '22023';
  end if;
  if new.partner_kind = 'ngo' and tg_op = 'INSERT' and (new.responsible_name is null or new.activity_area is null) then
    raise exception 'Informe a área de atuação e a pessoa responsável pela ONG.' using errcode = '22023';
  end if;

  -- ONG e protetor: só bairro/cidade em público e um ponto arredondado em
  -- ~1 km (0,01°). O ponto exato não é guardado.
  if new.partner_kind in ('ngo', 'independent') then
    if new.city is null or new.neighborhood is null then
      raise exception 'Informe o bairro e a cidade.' using errcode = '22023';
    end if;
    new.lat := round(new.lat::numeric, 2)::double precision;
    new.lng := round(new.lng::numeric, 2)::double precision;
    new.address_label := btrim(new.neighborhood) || ', ' || btrim(new.city);
  end if;

  if new.logo_path is not null and split_part(new.logo_path, '/', 1) <> new.owner_id::text then
    raise exception 'Logo inválido.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if (new.status is distinct from old.status or new.plan_code is distinct from old.plan_code) and not private.is_moderator() then
      raise exception 'Só a moderação aprova empresas e muda planos.' using errcode = '42501';
    end if;
    if not private.is_moderator() then
      new.review_note := old.review_note;
    end if;
    if new.status = 'APPROVED' and old.status <> 'APPROVED' then
      new.approved_at := now();
    end if;
    -- Parceiro aprovado mudou qualquer informação pública ou documento: volta para análise.
    if old.status = 'APPROVED' and new.status = 'APPROVED' and not private.is_moderator()
       and (new.name, new.category, new.description, new.address_label, new.lat, new.lng, new.phone, new.whatsapp,
            new.website, new.instagram, new.hours, new.helps_lost, new.logo_path, new.cnpj, new.legal_name,
            new.responsible_name, new.activity_area, new.city, new.neighborhood)
           is distinct from
           (old.name, old.category, old.description, old.address_label, old.lat, old.lng, old.phone, old.whatsapp,
            old.website, old.instagram, old.hours, old.helps_lost, old.logo_path, old.cnpj, old.legal_name,
            old.responsible_name, old.activity_area, old.city, old.neighborhood) then
      new.status := 'PENDING_REVIEW';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

grant insert (partner_kind, cnpj, legal_name, responsible_name, activity_area, city, neighborhood) on public.businesses to authenticated;
grant update (cnpj, legal_name, responsible_name, activity_area, city, neighborhood) on public.businesses to authenticated;

-- ---------------------------------------------------------------------------
-- Consulta de CNPJ (fila + resultado). Desligada no piloto (MEL_CNPJ_LOOKUP=off):
-- as linhas ficam PENDING ("Verificação pendente") até existir uma fonte
-- oficial autorizada. Só o necessário: razão social, situação, data e fonte.
-- ---------------------------------------------------------------------------
create table public.business_cnpj_checks (
  business_id         uuid primary key references public.businesses (id) on delete cascade,
  cnpj                text not null check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  status              public.cnpj_check_status not null default 'PENDING',
  attempts            smallint not null default 0 check (attempts between 0 and 20),
  next_attempt_at     timestamptz,
  last_error          text check (char_length(last_error) <= 200),
  official_name       text check (char_length(official_name) <= 200),      -- razão social na fonte
  registration_status text check (char_length(registration_status) <= 60), -- situação cadastral
  source              text check (char_length(source) <= 60),
  checked_at          timestamptz,
  updated_at          timestamptz not null default now()
);

create index business_cnpj_checks_cnpj_idx on public.business_cnpj_checks (cnpj);
create index business_cnpj_checks_due_idx on public.business_cnpj_checks (next_attempt_at) where status in ('PENDING', 'ERROR');

alter table public.business_cnpj_checks enable row level security;
create policy "cnpj_checks: moderação lê" on public.business_cnpj_checks for select to authenticated
  using ((select private.is_moderator()));
revoke all on public.business_cnpj_checks from public, anon, authenticated;
grant select on public.business_cnpj_checks to authenticated;
grant select, insert, update, delete on public.business_cnpj_checks to service_role;

-- CNPJ novo ou trocado: volta para "pendente" e zera as tentativas.
create or replace function private.businesses_after_cnpj()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cnpj is null then
    delete from public.business_cnpj_checks where business_id = new.id;
  elsif tg_op = 'INSERT' or new.cnpj is distinct from old.cnpj then
    insert into public.business_cnpj_checks (business_id, cnpj, status, attempts, next_attempt_at)
    values (new.id, new.cnpj, 'PENDING', 0, now())
    on conflict (business_id) do update
      set cnpj = excluded.cnpj, status = 'PENDING', attempts = 0, next_attempt_at = now(), last_error = null,
          official_name = null, registration_status = null, source = null, checked_at = null, updated_at = now();
  end if;
  return null;
end;
$$;

create trigger businesses_after_cnpj
  after insert or update of cnpj on public.businesses
  for each row execute function private.businesses_after_cnpj();

-- Sem backfill: a coluna cnpj nasce nesta migration (nenhum cadastro antigo tem CNPJ).

-- ---------------------------------------------------------------------------
-- CPF do protetor: só cifrado. Nenhuma policy: anon/authenticated não veem a
-- tabela; o service role (rotas do servidor) ignora RLS.
-- ---------------------------------------------------------------------------
create table public.partner_documents (
  business_id      uuid primary key references public.businesses (id) on delete cascade,
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  doc_type         text not null default 'CPF' check (doc_type = 'CPF'),
  ciphertext       text not null check (ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(ciphertext) <= 200),
  iv               text not null check (iv ~ '^[A-Za-z0-9+/]{16}$'),          -- 12 bytes
  auth_tag         text not null check (auth_tag ~ '^[A-Za-z0-9+/]{22}==$'),  -- 16 bytes
  key_version      smallint not null check (key_version between 1 and 999),
  lookup_hmac      text not null check (lookup_hmac ~ '^[0-9a-f]{64}$'),
  hmac_key_version smallint not null default 1 check (hmac_key_version between 1 and 999),
  created_at       timestamptz not null default now()
);

create unique index partner_documents_hmac_uidx on public.partner_documents (doc_type, lookup_hmac);
create index partner_documents_owner_idx on public.partner_documents (owner_id);

alter table public.partner_documents enable row level security;
revoke all on public.partner_documents from public, anon, authenticated;
grant select, insert, delete on public.partner_documents to service_role;

-- Quem pode ver CPF (além do próprio dono): concessão explícita por SQL.
create table public.pii_access_grants (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  granted_at timestamptz not null default now(),
  note       text check (char_length(note) <= 200)
);

alter table public.pii_access_grants enable row level security;
revoke all on public.pii_access_grants from public, anon, authenticated;
grant select, insert, delete on public.pii_access_grants to service_role;

-- Auditoria de acesso ao CPF (nunca o valor).
create table public.partner_document_access_log (
  id            bigint generated always as identity primary key,
  business_id   uuid references public.businesses (id) on delete set null,
  business_code text check (char_length(business_code) <= 12),
  actor_id      uuid references public.profiles (id) on delete set null,
  action        text not null check (action in ('stored', 'owner_view', 'moderator_view', 'denied', 'duplicate_rejected', 'deleted_rejected')),
  full_value    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index partner_document_access_log_business_idx on public.partner_document_access_log (business_id);
create index partner_document_access_log_actor_idx on public.partner_document_access_log (actor_id, created_at desc);
create index partner_document_access_log_created_idx on public.partner_document_access_log (created_at desc);

alter table public.partner_document_access_log enable row level security;
create policy "pii_log: moderação lê" on public.partner_document_access_log for select to authenticated
  using ((select private.is_moderator()));
revoke all on public.partner_document_access_log from public, anon, authenticated;
grant select on public.partner_document_access_log to authenticated;
grant select, insert on public.partner_document_access_log to service_role;

-- ---------------------------------------------------------------------------
-- Leitura: público vê tipo, bairro/cidade e o selo; dono e moderação veem os
-- dados de cadastro (nunca o CPF: esse só pela rota do servidor).
-- ---------------------------------------------------------------------------
create or replace function private.business_json(b public.businesses, p_origin extensions.geography default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', b.short_code, 'status', b.status, 'kind', b.partner_kind, 'name', b.name, 'category', b.category,
    'description', b.description, 'address_label', b.address_label, 'city', b.city, 'neighborhood', b.neighborhood,
    'activity_area', b.activity_area, 'lat', b.lat, 'lng', b.lng, 'phone', b.phone, 'whatsapp', b.whatsapp,
    'website', b.website, 'instagram', b.instagram, 'hours', b.hours, 'helps_lost', b.helps_lost,
    'logo_path', b.logo_path, 'plan_code', b.plan_code,
    'cnpj_verified', b.status = 'APPROVED'
      and exists (select 1 from public.business_cnpj_checks c where c.business_id = b.id and c.status = 'VERIFIED' and c.cnpj = b.cnpj),
    'distance_m', case when p_origin is not null then round(extensions.st_distance(b.point, p_origin))::int end,
    'is_owner', coalesce(b.owner_id = (select auth.uid()), false),
    'review_note', case when b.owner_id = (select auth.uid()) or private.is_moderator() then b.review_note end,
    'private', case when b.owner_id = (select auth.uid()) or private.is_moderator() then jsonb_build_object(
        'cnpj', b.cnpj, 'legal_name', b.legal_name, 'responsible_name', b.responsible_name,
        'cnpj_status', (select c.status from public.business_cnpj_checks c where c.business_id = b.id),
        'has_document', exists (select 1 from public.partner_documents d where d.business_id = b.id)) end,
    'offers', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description,
        'starts_at', o.starts_at, 'ends_at', o.ends_at, 'is_sponsored', o.is_sponsored) order by o.created_at desc)
      from public.business_offers o
      where o.business_id = b.id and (o.ends_at is null or o.ends_at >= current_date)), '[]'::jsonb));
$$;

revoke all on function private.business_json(public.businesses, extensions.geography) from public, anon, authenticated;

-- Reescrita sem o construtor de linha (a tabela ganhou colunas).
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
  with o as (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g),
  picked as (
    select b.id, extensions.st_distance(b.point, o.g) as d
      from public.businesses b, o
     where b.status = 'APPROVED'
       and extensions.st_dwithin(b.point, o.g, least(greatest(coalesce(p_radius_m, 10000), 500), 50000))
       and (p_categories is null or b.category = any(p_categories))
     order by d
     limit least(greatest(p_limit, 1), 100)
  )
  select coalesce(jsonb_agg(private.business_json(b, o.g) order by p.d), '[]'::jsonb)
    from picked p join public.businesses b on b.id = p.id, o;
$$;

-- Moderação: aprovar exige documento conforme o tipo; recusar apaga o CPF cifrado.
create or replace function public.admin_review_business(p_code text, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.businesses;
  removed int;
begin
  perform private.require_moderator();
  select * into b from public.businesses where short_code = lower(p_code) and status = 'PENDING_REVIEW';
  if b.id is null then
    raise exception 'Empresa não está aguardando aprovação.' using errcode = '22023';
  end if;
  if p_approve and b.partner_kind = 'independent'
     and not exists (select 1 from public.partner_documents d where d.business_id = b.id) then
    raise exception 'Protetor sem CPF guardado: peça um novo cadastro.' using errcode = '22023';
  end if;
  if p_approve and b.partner_kind in ('company', 'ngo') and b.cnpj is null then
    raise exception 'Cadastro sem CNPJ: recuse e peça um novo envio.' using errcode = '22023';
  end if;
  update public.businesses
     set status = case when p_approve then 'APPROVED'::public.business_status else 'REJECTED'::public.business_status end,
         review_note = nullif(btrim(p_note), '')
   where id = b.id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason)
  values ((select auth.uid()), case when p_approve then 'approve' else 'reject' end, 'business', b.id, nullif(btrim(p_note), ''));
  -- Retenção: cadastro recusado não guarda CPF.
  if not p_approve then
    delete from public.partner_documents where business_id = b.id;
    get diagnostics removed = row_count;
    if removed > 0 then
      insert into public.partner_document_access_log (business_id, business_code, actor_id, action)
      values (b.id, b.short_code, (select auth.uid()), 'deleted_rejected');
    end if;
  end if;
end;
$$;

revoke all on function public.list_businesses(double precision, double precision, integer, public.business_category[], integer) from public;
grant execute on function public.list_businesses(double precision, double precision, integer, public.business_category[], integer) to anon, authenticated;
revoke all on function public.admin_review_business(text, boolean, text) from public, anon;
grant execute on function public.admin_review_business(text, boolean, text) to authenticated;
