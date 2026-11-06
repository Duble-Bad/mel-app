-- MEL — Adoção no mapa da rede (configuração de administrador) e endereço público
-- de parceiros (decisão do proprietário, 2026-11-06).
--
-- 1. "Mostrar animais disponíveis para adoção no mapa da rede": configuração
--    persistente, padrão DESLIGADA (sem linha = desligada). Só administradores
--    mudam (validado aqui, não só na tela); cada mudança fica registrada.
-- 2. Mapa: anúncios de adoção pelo ponto público APROXIMADO do anúncio (célula de
--    100 m), nunca o endereço de quem doa nem de lar temporário. Anúncio de quem
--    tem ONG/empresa aprovada leva o nome da instituição, sem afirmar que o animal
--    está na sede.
-- 3. Parceiros: endereço exato só quando (a) é empresa ou ONG, (b) o parceiro
--    declarou que é comercial/institucional e autorizou a divulgação e (c) um
--    administrador validou. Fora disso, em público: bairro/cidade e ponto
--    arredondado (~1 km), também na distância e no filtro de raio. Protetor
--    independente nunca. ONG sem autorização continua sem guardar o ponto exato.

-- ---------------------------------------------------------------------------
-- 1. Configurações do app
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key        text primary key check (key in ('show_adoption_on_map')),
  value      jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from public, anon, authenticated;

create table public.app_setting_changes (
  id         bigint generated always as identity primary key,
  key        text not null,
  value      jsonb not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index app_setting_changes_changed_idx on public.app_setting_changes (changed_at desc);
alter table public.app_setting_changes enable row level security;
create policy "app_setting_changes: administradores leem"
  on public.app_setting_changes for select to authenticated
  using ((select private.is_admin()));
revoke all on public.app_setting_changes from public, anon, authenticated;
grant select on public.app_setting_changes to authenticated;

create or replace function private.setting_on(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.value = 'true'::jsonb from public.app_settings s where s.key = p_key), false);
$$;
revoke all on function private.setting_on(text) from public, anon, authenticated;

-- Leitura pública só do que a tela precisa (nada de quem mudou).
create or replace function public.get_map_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('show_adoption_on_map', private.setting_on('show_adoption_on_map'));
$$;
revoke all on function public.get_map_settings() from public;
grant execute on function public.get_map_settings() to anon, authenticated;

create or replace function public.admin_set_map_setting(p_key text, p_value boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Só administradores mudam esta configuração.' using errcode = '42501';
  end if;
  if p_key is distinct from 'show_adoption_on_map' or p_value is null then
    raise exception 'Configuração desconhecida.' using errcode = '22023';
  end if;
  insert into public.app_settings (key, value, updated_by, updated_at)
  values (p_key, to_jsonb(p_value), (select auth.uid()), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  insert into public.app_setting_changes (key, value, changed_by) values (p_key, to_jsonb(p_value), (select auth.uid()));
  return public.get_map_settings();
end;
$$;
revoke all on function public.admin_set_map_setting(text, boolean) from public, anon;
grant execute on function public.admin_set_map_setting(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Parceiros: autorização do endereço público
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column address_public_consent     boolean not null default false,
  add column address_public_verified_at timestamptz,
  add column address_public_verified_by uuid references public.profiles (id) on delete set null;
alter table public.businesses add constraint businesses_address_public_kind
  check (partner_kind <> 'independent' or (not address_public_consent and address_public_verified_at is null));
alter table public.businesses add constraint businesses_address_public_needs_consent
  check (address_public_verified_at is null or address_public_consent);

-- Endereço exato é público?
create or replace function private.business_address_public(b public.businesses)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select b.partner_kind <> 'independent' and b.status = 'APPROVED' and b.address_public_consent
     and b.address_public_verified_at is not null;
$$;
revoke all on function private.business_address_public(public.businesses) from public, anon, authenticated;

-- Ponto mostrado em público: exato só com endereço público; senão ~1 km (0,01°).
create or replace function private.business_public_point(b public.businesses)
returns extensions.geography
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.business_address_public(b) then b.point
    else extensions.st_setsrid(extensions.st_makepoint(round(b.lng::numeric, 2)::double precision, round(b.lat::numeric, 2)::double precision), 4326)::extensions.geography end;
$$;
revoke all on function private.business_public_point(public.businesses) from public, anon, authenticated;

create or replace function private.businesses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Moderação ou o próprio servidor da MEL (regravação de CPF devolve para análise).
  trusted boolean := private.is_moderator() or private.is_service_role();
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
    -- Validação do endereço público é só do administrador (função própria).
    new.address_public_verified_at := null;
    new.address_public_verified_by := null;
    -- Empresa e ONG precisam de ao menos um contato público.
    if new.partner_kind <> 'independent'
       and new.phone is null and new.whatsapp is null and new.website is null and new.instagram is null then
      raise exception 'Informe ao menos um contato: telefone, WhatsApp, site ou Instagram.' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.partner_kind is distinct from old.partner_kind then
    raise exception 'O tipo de parceiro não muda depois do cadastro.' using errcode = '42501';
  end if;

  -- Documento ou telefone trocado pelo titular: exige login recente (até 10 min).
  if tg_op = 'UPDATE' and not trusted
     and (new.cnpj is distinct from old.cnpj or new.phone is distinct from old.phone or new.whatsapp is distinct from old.whatsapp)
     and not private.has_recent_auth(600) then
    raise exception 'Para alterar este dado, confirme sua identidade de novo.' using errcode = '42501';
  end if;

  -- Documentos por tipo.
  if new.partner_kind = 'independent' then
    if new.cnpj is not null or new.legal_name is not null then
      raise exception 'Protetor independente não informa CNPJ nem razão social.' using errcode = '22023';
    end if;
    if new.address_public_consent then
      raise exception 'Protetor independente não divulga endereço: só a região aproximada.' using errcode = '22023';
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

  -- Protetor (sempre) e ONG sem endereço institucional autorizado: só bairro/cidade em
  -- público e um ponto arredondado em ~1 km (0,01°). O ponto exato não é guardado.
  if new.partner_kind = 'independent' or (new.partner_kind = 'ngo' and not new.address_public_consent) then
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
    if (new.status is distinct from old.status or new.plan_code is distinct from old.plan_code) and not trusted then
      raise exception 'Só a moderação aprova empresas e muda planos.' using errcode = '42501';
    end if;
    if not trusted then
      new.review_note := old.review_note;
    end if;
    -- Validação do endereço: só administrador (pela função própria).
    if (new.address_public_verified_at, new.address_public_verified_by) is distinct from (old.address_public_verified_at, old.address_public_verified_by)
       and not (private.is_admin() or private.is_service_role()) then
      new.address_public_verified_at := old.address_public_verified_at;
      new.address_public_verified_by := old.address_public_verified_by;
    end if;
    -- Endereço, ponto ou autorização mudou: a validação anterior não vale mais.
    if (new.address_label, new.lat, new.lng, new.address_public_consent) is distinct from (old.address_label, old.lat, old.lng, old.address_public_consent)
       or not new.address_public_consent then
      new.address_public_verified_at := null;
      new.address_public_verified_by := null;
    end if;
    -- Protetor: aprovação exige CPF guardado e legível (vale também para UPDATE direto).
    if new.status = 'APPROVED' and old.status <> 'APPROVED' and new.partner_kind = 'independent'
       and not exists (select 1 from public.partner_documents d where d.business_id = new.id and d.read_state = 'ok') then
      raise exception 'CPF ausente, ilegível ou indisponível: peça ao protetor para cadastrar de novo.' using errcode = '22023';
    end if;
    if new.status = 'APPROVED' and old.status <> 'APPROVED' then
      new.approved_at := now();
    end if;
    -- Parceiro aprovado mudou qualquer informação pública ou documento: volta para análise.
    if old.status = 'APPROVED' and new.status = 'APPROVED' and not private.is_moderator()
       and (new.name, new.category, new.description, new.address_label, new.lat, new.lng, new.phone, new.whatsapp,
            new.website, new.instagram, new.hours, new.helps_lost, new.logo_path, new.cnpj, new.legal_name,
            new.responsible_name, new.activity_area, new.city, new.neighborhood, new.address_public_consent)
           is distinct from
           (old.name, old.category, old.description, old.address_label, old.lat, old.lng, old.phone, old.whatsapp,
            old.website, old.instagram, old.hours, old.helps_lost, old.logo_path, old.cnpj, old.legal_name,
            old.responsible_name, old.activity_area, old.city, old.neighborhood, old.address_public_consent) then
      new.status := 'PENDING_REVIEW';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Leitura: endereço e ponto exatos só com endereço público validado (ou para o
-- próprio parceiro e a moderação). Distância calculada do ponto público.
create or replace function private.business_json(b public.businesses, p_origin extensions.geography default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select private.business_address_public(b) as pub,
           (b.owner_id = (select auth.uid()) or private.is_moderator()) as insider,
           private.business_public_point(b) as pt
  )
  select jsonb_build_object(
    'code', b.short_code, 'status', b.status, 'kind', b.partner_kind, 'name', b.name, 'category', b.category,
    'description', b.description,
    'address_label', case when v.pub or v.insider then b.address_label
                          else coalesce(nullif(concat_ws(', ', nullif(btrim(b.neighborhood), ''), nullif(btrim(b.city), '')), ''), 'Região aproximada') end,
    'address_public', v.pub,
    'city', b.city, 'neighborhood', b.neighborhood,
    'activity_area', b.activity_area,
    'lat', case when v.pub or v.insider then b.lat else extensions.st_y(v.pt::extensions.geometry) end,
    'lng', case when v.pub or v.insider then b.lng else extensions.st_x(v.pt::extensions.geometry) end,
    'phone', b.phone, 'whatsapp', b.whatsapp,
    'website', b.website, 'instagram', b.instagram, 'hours', b.hours, 'helps_lost', b.helps_lost,
    'logo_path', b.logo_path, 'plan_code', b.plan_code,
    'cnpj_verified', b.status = 'APPROVED'
      and exists (select 1 from public.business_cnpj_checks c where c.business_id = b.id and c.status = 'VERIFIED' and c.cnpj = b.cnpj),
    'distance_m', case when p_origin is not null then round(extensions.st_distance(v.pt, p_origin))::int end,
    'is_owner', coalesce(b.owner_id = (select auth.uid()), false),
    'review_note', case when v.insider then b.review_note end,
    'private', case when v.insider then jsonb_build_object(
        'cnpj', b.cnpj, 'legal_name', b.legal_name, 'responsible_name', b.responsible_name,
        'cnpj_status', (select c.status from public.business_cnpj_checks c where c.business_id = b.id),
        'has_document', exists (select 1 from public.partner_documents d where d.business_id = b.id),
        'document_state', (select d.read_state from public.partner_documents d where d.business_id = b.id),
        'address_public_consent', b.address_public_consent,
        'address_public_verified', b.address_public_verified_at is not null) end,
    'offers', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description,
        'starts_at', o.starts_at, 'ends_at', o.ends_at, 'is_sponsored', o.is_sponsored) order by o.created_at desc)
      from public.business_offers o
      where o.business_id = b.id and (o.ends_at is null or o.ends_at >= current_date)), '[]'::jsonb))
  from v;
$$;
revoke all on function private.business_json(public.businesses, extensions.geography) from public, anon, authenticated;

-- Raio pelo ponto público (o exato não decide quem entra no resultado).
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
    select b.id, extensions.st_distance(private.business_public_point(b), o.g) as d
      from public.businesses b, o
     where b.status = 'APPROVED'
       and extensions.st_dwithin(private.business_public_point(b), o.g, least(greatest(coalesce(p_radius_m, 10000), 500), 50000))
       and (p_categories is null or b.category = any(p_categories))
     order by d
     limit least(greatest(p_limit, 1), 100)
  )
  select coalesce(jsonb_agg(private.business_json(b, o.g) order by p.d), '[]'::jsonb)
    from picked p join public.businesses b on b.id = p.id, o;
$$;

-- Administrador libera (ou retira) o endereço exato de empresa/ONG aprovada que autorizou.
create or replace function public.admin_set_business_public_address(p_code text, p_public boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.businesses;
begin
  if not private.is_admin() then
    raise exception 'Só administradores validam endereços públicos.' using errcode = '42501';
  end if;
  select * into b from public.businesses where short_code = lower(p_code);
  if b.id is null then
    raise exception 'Parceiro não encontrado.' using errcode = '22023';
  end if;
  if p_public and (b.partner_kind = 'independent' or not b.address_public_consent or b.status <> 'APPROVED') then
    raise exception 'Só empresa ou ONG aprovada que autorizou a divulgação do endereço.' using errcode = '22023';
  end if;
  update public.businesses
     set address_public_verified_at = case when p_public then now() end,
         address_public_verified_by = case when p_public then (select auth.uid()) end
   where id = b.id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason)
  values ((select auth.uid()), case when p_public then 'approve' else 'reject' end, 'business', b.id,
          case when p_public then 'endereço público liberado no mapa' else 'endereço público retirado do mapa' end);
end;
$$;
revoke all on function public.admin_set_business_public_address(text, boolean) from public, anon;
grant execute on function public.admin_set_business_public_address(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Adoção no mapa (só com a configuração ligada)
-- ---------------------------------------------------------------------------
-- Instituição (ONG/empresa aprovada) de quem anuncia: nome e perfil, nunca o endereço
-- de quem doa. Não diz onde o animal está.
create or replace function private.adoption_institution(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('code', b.short_code, 'name', b.name, 'kind', b.partner_kind,
                            'address_public', private.business_address_public(b))
    from public.businesses b
   where b.owner_id = p_owner and b.status = 'APPROVED' and b.partner_kind in ('ngo', 'company')
   order by b.partner_kind = 'ngo' desc, b.approved_at
   limit 1;
$$;
revoke all on function private.adoption_institution(uuid) from public, anon, authenticated;

create or replace function public.search_adoptions_on_map(
  p_lat double precision, p_lng double precision, p_radius_m integer default 5000,
  p_species public.species[] default null, p_limit integer default 60
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with o as (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g),
  picked as (
    select a.*, extensions.st_distance(extensions.st_setsrid(extensions.st_makepoint(a.public_lng, a.public_lat), 4326)::extensions.geography, o.g) as d
      from public.adoption_listings a, o
     where private.setting_on('show_adoption_on_map')
       and a.status = 'AVAILABLE'
       and a.public_lat is not null and a.public_lng is not null
       and extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(a.public_lng, a.public_lat), 4326)::extensions.geography,
                                 o.g, least(greatest(coalesce(p_radius_m, 5000), 500), 50000))
       and (p_species is null or a.species = any(p_species))
     order by d
     limit least(greatest(coalesce(p_limit, 60), 1), 100)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.short_code, 'name', p.name, 'species', p.species, 'size', p.size, 'sex', p.sex, 'age_months', p.age_months,
      'area_label', p.public_area_label, 'photo_path', p.photo_paths[1], 'published_at', p.published_at,
      -- Ponto público aproximado do anúncio (célula de 100 m), o mesmo critério dos casos.
      'lat', p.public_lat, 'lng', p.public_lng, 'distance_m', round(p.d)::int,
      'institution', private.adoption_institution(p.owner_id)) order by p.d), '[]'::jsonb)
    from picked p;
$$;
revoke all on function public.search_adoptions_on_map(double precision, double precision, integer, public.species[], integer) from public;
grant execute on function public.search_adoptions_on_map(double precision, double precision, integer, public.species[], integer) to anon, authenticated;

-- Página do anúncio também mostra a instituição (mesmo critério).
create or replace function private.adoption_json(a public.adoption_listings)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', a.short_code, 'status', a.status, 'name', a.name, 'species', a.species, 'sex', a.sex, 'size', a.size,
    'age_months', a.age_months, 'breed', a.breed, 'color_primary', a.color_primary, 'temperament', a.temperament,
    'neutered', a.neutered, 'vaccinated', a.vaccinated, 'dewormed', a.dewormed, 'description', a.description,
    'requirements', a.requirements, 'area_label', a.public_area_label, 'photo_paths', a.photo_paths,
    'published_at', a.published_at, 'created_at', a.created_at,
    'institution', private.adoption_institution(a.owner_id),
    'is_owner', coalesce(a.owner_id = (select auth.uid()), false),
    'review_note', case when a.owner_id = (select auth.uid()) or private.is_moderator() then a.review_note end,
    'interests', case when a.owner_id = (select auth.uid()) then (select count(*) from public.adoption_interests i where i.listing_id = a.id) end,
    'my_interest', coalesce((select auth.uid()) is not null
                            and exists (select 1 from public.adoption_interests i where i.listing_id = a.id and i.user_id = (select auth.uid())), false));
$$;
revoke all on function private.adoption_json(public.adoption_listings) from public, anon, authenticated;
