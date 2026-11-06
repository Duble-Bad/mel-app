-- CPF do protetor: revelação só por ADMINISTRADOR autorizado, estado de
-- leitura (ilegível/indisponível), regravação segura pelo titular, rotação de
-- chaves sem perda e auditoria de mudanças sensíveis (decisão do proprietário,
-- pendência 1, 2026-11-06). Procedimento de chaves: docs/18-chaves-pii.md.
--
--   1. pii_access_grants passa a valer SÓ para administradores (papel admin +
--      linha na tabela). Moderador comum nunca vê o CPF: vê apenas o estado
--      ("informado", "ilegível", "pendente"). Concessões antigas a moderadores
--      ficam na tabela (nada é apagado), mas deixam de funcionar: o servidor
--      exige papel admin, e o trigger recusa conceder a quem não é admin.
--   2. partner_documents.read_state: ok | unreadable (cifrado/tag/IV
--      corrompido) | key_unavailable (versão de chave ausente no servidor).
--      Marcado pelo servidor quando a abertura falha; volta a "ok" sozinho se a
--      chave reaparecer. A conta e o cadastro NUNCA são apagados por isso.
--   3. save_partner_document (só service role): grava ou REGRAVA o CPF com
--      checagem de duplicidade atômica em TODAS as versões de HMAC informadas
--      (rotação da chave do HMAC sem janela de duplicidade). Regravação de
--      parceiro aprovado volta para a análise: aprovação nunca é transferida.
--   4. reencrypt_partner_document (só service role): rotação de chave com
--      concorrência otimista (só troca se o cifrado ainda for o mesmo).
--   5. personal_data_changes: quem mudou qual dado sensível, quando e onde —
--      NUNCA o valor (nem parcial).
--   6. Trigger de businesses: troca de CNPJ/telefone exige login recente
--      (claim amr do JWT, até 10 min); aprovação de protetor exige CPF legível
--      também no UPDATE direto da moderação (não só na RPC).

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

-- Requisição feita pelo servidor da MEL com a chave secreta (role do JWT).
create or replace function private.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

revoke all on function private.is_service_role() from public, anon;
grant execute on function private.is_service_role() to authenticated, service_role;

-- Login recente: algum método do claim amr (senha, Google, link…) nos últimos
-- p_max_age_s segundos. "anonymous" e "token_refresh" não contam: renovar o
-- token não é provar quem é.
create or replace function private.has_recent_auth(p_max_age_s integer default 600)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select max((e ->> 'timestamp')::bigint)
      from jsonb_array_elements(
             case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) e
     where coalesce(e ->> 'method', '') not in ('', 'anonymous', 'token_refresh')
       and (e ->> 'timestamp') ~ '^[0-9]{1,12}$'
  ) >= extract(epoch from now())::bigint - greatest(p_max_age_s, 0), false);
$$;

revoke all on function private.has_recent_auth(integer) from public, anon;
grant execute on function private.has_recent_auth(integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Auditoria de mudanças sensíveis feitas pelo titular (nunca o valor).
-- ---------------------------------------------------------------------------
create table public.personal_data_changes (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  subject     text not null check (subject in ('account', 'partner', 'adoption_seeker', 'lost_case')),
  subject_ref text check (char_length(subject_ref) <= 40),
  field       text not null check (field in ('cpf', 'cnpj', 'phone', 'whatsapp', 'email')),
  action      text not null check (action in ('changed', 're_registered', 'removed', 'email_change_requested')),
  created_at  timestamptz not null default now()
);

create index personal_data_changes_actor_idx on public.personal_data_changes (actor_id, created_at desc);
create index personal_data_changes_created_idx on public.personal_data_changes (created_at desc);

alter table public.personal_data_changes enable row level security;
create policy "personal_data_changes: titular e admin leem" on public.personal_data_changes for select to authenticated
  using (actor_id = (select auth.uid()) or (select private.is_admin()));
revoke all on public.personal_data_changes from public, anon, authenticated;
grant select on public.personal_data_changes to authenticated;
grant select, insert on public.personal_data_changes to service_role;

-- ---------------------------------------------------------------------------
-- Documento: estado de leitura e permissões do servidor.
-- ---------------------------------------------------------------------------
alter table public.partner_documents
  add column read_state    text not null default 'ok' check (read_state in ('ok', 'unreadable', 'key_unavailable')),
  add column read_state_at timestamptz,
  add column updated_at    timestamptz not null default now();

-- Rotação e regravação atualizam a linha (o service role já lia/gravava/apagava).
grant update on public.partner_documents to service_role;

-- Índice por versão: a rotina de rotação procura as linhas de versões antigas.
create index partner_documents_versions_idx on public.partner_documents (key_version, hmac_key_version);

alter table public.partner_document_access_log drop constraint partner_document_access_log_action_check;
alter table public.partner_document_access_log add constraint partner_document_access_log_action_check
  check (action in ('stored', 'owner_view', 'moderator_view', 'admin_view', 'denied', 'duplicate_rejected', 'deleted_rejected',
                    'reregistered', 'reencrypted', 'marked_unreadable', 'marked_key_unavailable', 'state_restored'));

-- Concessão de acesso ao CPF: só para administradores.
create or replace function private.pii_access_grants_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'admin') then
    raise exception 'Só administradores podem receber acesso ao CPF.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.pii_access_grants_before_write() from public, anon, authenticated;

create trigger pii_access_grants_before_write
  before insert or update on public.pii_access_grants
  for each row execute function private.pii_access_grants_before_write();

-- ---------------------------------------------------------------------------
-- Gravar / regravar o CPF (só o servidor, que cifra com a chave do ambiente).
-- p_lookups: [{"v": versão, "h": hmac}], a PRIMEIRA é a versão atual (gravada);
-- as demais são as versões anteriores ainda configuradas (só para checar).
-- Devolve 'stored' | 'changed' | 're_registered' | 'unchanged'.
-- ---------------------------------------------------------------------------
create or replace function public.save_partner_document(
  p_business_id uuid,
  p_actor uuid,
  p_ciphertext text,
  p_iv text,
  p_auth_tag text,
  p_key_version integer,
  p_lookups jsonb,
  p_mode text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.businesses;
  cur public.partner_documents;
  v_hmac text;
  v_hver integer;
  result text;
begin
  if not private.is_service_role() then
    raise exception 'Acesso restrito ao servidor.' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('signup', 'change') or jsonb_typeof(p_lookups) is distinct from 'array'
     or jsonb_array_length(p_lookups) = 0 then
    raise exception 'Requisição inválida.' using errcode = '22023';
  end if;
  v_hmac := p_lookups -> 0 ->> 'h';
  v_hver := (p_lookups -> 0 ->> 'v')::integer;

  -- Uma gravação de CPF por vez: a checagem entre versões de HMAC fica atômica.
  perform pg_advisory_xact_lock(hashtext('mel:partner_documents:cpf'));

  select * into b from public.businesses where id = p_business_id for update;
  if b.id is null or b.partner_kind <> 'independent' or b.owner_id is distinct from p_actor then
    raise exception 'Cadastro não encontrado.' using errcode = '22023';
  end if;
  if b.status not in ('PENDING_REVIEW', 'APPROVED') then
    raise exception 'Este cadastro não aceita alterações agora.' using errcode = '22023';
  end if;

  -- Duplicidade em QUALQUER versão de HMAC informada (rotação sem brecha).
  if exists (
    select 1
      from public.partner_documents d
      join jsonb_to_recordset(p_lookups) as l(v integer, h text) on d.hmac_key_version = l.v and d.lookup_hmac = l.h
     where d.doc_type = 'CPF' and d.business_id <> p_business_id
  ) then
    raise exception 'Este CPF já está em outro cadastro de protetor.' using errcode = '23505';
  end if;

  select * into cur from public.partner_documents where business_id = p_business_id;
  if p_mode = 'signup' and cur.business_id is not null then
    raise exception 'Este cadastro já tem CPF guardado.' using errcode = '22023';
  end if;
  -- Mesmo CPF, legível: nada muda (nem volta para análise).
  if cur.business_id is not null and cur.read_state = 'ok' and exists (
    select 1 from jsonb_to_recordset(p_lookups) as l(v integer, h text)
     where l.v = cur.hmac_key_version and l.h = cur.lookup_hmac
  ) then
    return 'unchanged';
  end if;

  insert into public.partner_documents
    (business_id, owner_id, doc_type, ciphertext, iv, auth_tag, key_version, lookup_hmac, hmac_key_version, read_state, read_state_at, updated_at)
  values
    (b.id, b.owner_id, 'CPF', p_ciphertext, p_iv, p_auth_tag, p_key_version, v_hmac, v_hver, 'ok', null, now())
  on conflict (business_id) do update
    set ciphertext = excluded.ciphertext, iv = excluded.iv, auth_tag = excluded.auth_tag, key_version = excluded.key_version,
        lookup_hmac = excluded.lookup_hmac, hmac_key_version = excluded.hmac_key_version,
        read_state = 'ok', read_state_at = null, updated_at = now();

  if p_mode = 'signup' then
    result := 'stored';
  else
    result := case when cur.business_id is null or cur.read_state <> 'ok' then 're_registered' else 'changed' end;
    -- Aprovação nunca é transferida para um CPF novo: volta para a moderação.
    if b.status = 'APPROVED' then
      update public.businesses set status = 'PENDING_REVIEW', review_note = null where id = b.id;
    end if;
    insert into public.personal_data_changes (actor_id, subject, subject_ref, field, action)
    values (p_actor, 'partner', b.short_code, 'cpf', result);
  end if;
  insert into public.partner_document_access_log (business_id, business_code, actor_id, action)
  values (b.id, b.short_code, p_actor, case when result = 'stored' then 'stored' else 'reregistered' end);
  return result;
end;
$$;

revoke all on function public.save_partner_document(uuid, uuid, text, text, text, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_partner_document(uuid, uuid, text, text, text, integer, jsonb, text) to service_role;

-- Estado de leitura (marcado pelo servidor quando a abertura falha ou volta a funcionar).
create or replace function public.mark_partner_document_state(p_business_id uuid, p_state text, p_actor uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.partner_documents;
  code text;
begin
  if not private.is_service_role() then
    raise exception 'Acesso restrito ao servidor.' using errcode = '42501';
  end if;
  if p_state is null or p_state not in ('ok', 'unreadable', 'key_unavailable') then
    raise exception 'Requisição inválida.' using errcode = '22023';
  end if;
  update public.partner_documents
     set read_state = p_state, read_state_at = case when p_state = 'ok' then null else now() end
   where business_id = p_business_id and read_state <> p_state
  returning * into d;
  if d.business_id is null then
    return false;
  end if;
  select short_code into code from public.businesses where id = p_business_id;
  insert into public.partner_document_access_log (business_id, business_code, actor_id, action)
  values (p_business_id, code, p_actor,
          case p_state when 'ok' then 'state_restored' when 'unreadable' then 'marked_unreadable' else 'marked_key_unavailable' end);
  return true;
end;
$$;

revoke all on function public.mark_partner_document_state(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.mark_partner_document_state(uuid, text, uuid) to service_role;

-- Rotação: troca o cifrado/HMAC só se a linha ainda tiver o cifrado lido
-- (uma regravação concorrente do titular vence). Nunca apaga.
create or replace function public.reencrypt_partner_document(
  p_business_id uuid,
  p_expected_ciphertext text,
  p_ciphertext text,
  p_iv text,
  p_auth_tag text,
  p_key_version integer,
  p_lookup_hmac text,
  p_hmac_key_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not private.is_service_role() then
    raise exception 'Acesso restrito ao servidor.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('mel:partner_documents:cpf'));
  update public.partner_documents
     set ciphertext = p_ciphertext, iv = p_iv, auth_tag = p_auth_tag, key_version = p_key_version,
         lookup_hmac = p_lookup_hmac, hmac_key_version = p_hmac_key_version,
         read_state = 'ok', read_state_at = null, updated_at = now()
   where business_id = p_business_id and ciphertext = p_expected_ciphertext;
  if not found then
    return false;
  end if;
  select short_code into code from public.businesses where id = p_business_id;
  insert into public.partner_document_access_log (business_id, business_code, actor_id, action)
  values (p_business_id, code, null, 'reencrypted');
  return true;
end;
$$;

revoke all on function public.reencrypt_partner_document(uuid, text, text, text, text, integer, text, integer) from public, anon, authenticated;
grant execute on function public.reencrypt_partner_document(uuid, text, text, text, text, integer, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- businesses: servidor (service role) pode devolver para análise; CNPJ e
-- telefones exigem login recente; protetor só é aprovado com CPF legível.
-- ---------------------------------------------------------------------------
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
    if (new.status is distinct from old.status or new.plan_code is distinct from old.plan_code) and not trusted then
      raise exception 'Só a moderação aprova empresas e muda planos.' using errcode = '42501';
    end if;
    if not trusted then
      new.review_note := old.review_note;
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

-- ---------------------------------------------------------------------------
-- Leitura: dono e moderação veem o ESTADO do documento (nunca o CPF).
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
        'has_document', exists (select 1 from public.partner_documents d where d.business_id = b.id),
        'document_state', (select d.read_state from public.partner_documents d where d.business_id = b.id)) end,
    'offers', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description,
        'starts_at', o.starts_at, 'ends_at', o.ends_at, 'is_sponsored', o.is_sponsored) order by o.created_at desc)
      from public.business_offers o
      where o.business_id = b.id and (o.ends_at is null or o.ends_at >= current_date)), '[]'::jsonb));
$$;

revoke all on function private.business_json(public.businesses, extensions.geography) from public, anon, authenticated;

-- Moderação: aprovar protetor exige CPF legível; recusar apaga o CPF cifrado.
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
  if p_approve and b.partner_kind = 'independent'
     and not exists (select 1 from public.partner_documents d where d.business_id = b.id and d.read_state = 'ok') then
    raise exception 'CPF ilegível ou indisponível: peça ao protetor para cadastrar de novo.' using errcode = '22023';
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

revoke all on function public.admin_review_business(text, boolean, text) from public, anon;
grant execute on function public.admin_review_business(text, boolean, text) to authenticated;
