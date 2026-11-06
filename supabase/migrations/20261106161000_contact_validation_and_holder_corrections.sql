-- Telefones: mesma regra no app e no banco; correção de dados pelo titular
-- (/perfil/dados) com auditoria sem valores (requisitos 2–4 do proprietário,
-- 2026-11-06).
--
--   1. private.is_valid_br_phone: forma canônica = DDD + número, só dígitos
--      (o E.164 é "+55" + isso). DDD da lista da Anatel; celular com 11
--      dígitos e 9 depois do DDD; fixo com 10 dígitos começando em 2–5.
--      Espelha packages/core/src/contact/phone.ts.
--   2. Triggers validam o telefone só quando ele é GRAVADO ou MUDA: linhas
--      antigas fora do padrão continuam como estão (nada é reescrito nem
--      apagado) e podem ter outras colunas editadas normalmente.
--   3. Auditoria (personal_data_changes) de CNPJ e telefones trocados, em
--      qualquer caminho (app, API, SQL de cliente): quem, qual campo, quando.
--   4. my_personal_data(): os dados de contato e documentos do PRÓPRIO
--      titular, para a página /perfil/dados (o servidor mascara antes de
--      mandar ao navegador). E-mail vem de auth.users (fonte única; profiles
--      não guarda e-mail), com a troca pendente (email_change).
--   5. set_my_adoption_seeker_whatsapp: trocar só o WhatsApp da fila de adoção
--      (não muda o status, como em save_my_adoption_seeker).

create or replace function private.is_valid_br_phone(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
     and p ~ '^[0-9]{10,11}$'
     and substr(p, 1, 2)::int = any ('{11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99}'::int[])
     and ((char_length(p) = 11 and substr(p, 3, 1) = '9') or (char_length(p) = 10 and substr(p, 3, 1) between '2' and '5'));
$$;

revoke all on function private.is_valid_br_phone(text) from public, anon;
grant execute on function private.is_valid_br_phone(text) to authenticated, service_role;

-- Valida as colunas de telefone passadas em tg_argv, só se gravadas/alteradas.
create or replace function private.validate_phone_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
  v text;
begin
  foreach col in array tg_argv loop
    v := to_jsonb(new) ->> col;
    if v is not null and (tg_op = 'INSERT' or v is distinct from (to_jsonb(old) ->> col)) and not private.is_valid_br_phone(v) then
      raise exception 'Telefone inválido. Use DDD e número (celular com 9 na frente).' using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.validate_phone_columns() from public, anon, authenticated;

create trigger businesses_validate_phones
  before insert or update of phone, whatsapp on public.businesses
  for each row execute function private.validate_phone_columns('phone', 'whatsapp');

create trigger lost_cases_validate_phones
  before insert or update of contact_phone on public.lost_cases
  for each row execute function private.validate_phone_columns('contact_phone');

create trigger adoption_seekers_validate_phones
  before insert or update of whatsapp_private on public.adoption_seekers
  for each row execute function private.validate_phone_columns('whatsapp_private');

create trigger profiles_validate_phones
  before insert or update of phone_private, whatsapp_private on public.profiles
  for each row execute function private.validate_phone_columns('phone_private', 'whatsapp_private');

-- ---------------------------------------------------------------------------
-- Auditoria de troca de documento/telefone (nunca o valor).
-- ---------------------------------------------------------------------------
create or replace function private.audit_contact_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  subj text := tg_argv[0];
  ref_col text := tg_argv[1];
  i int;
  col text;
  field text;
  v_new text;
  v_old text;
begin
  -- Pares coluna:campo a partir do 3º argumento (ex.: 'contact_phone:phone').
  for i in 2 .. coalesce(array_length(tg_argv, 1), 0) - 1 loop
    col := split_part(tg_argv[i], ':', 1);
    field := split_part(tg_argv[i], ':', 2);
    v_new := to_jsonb(new) ->> col;
    v_old := to_jsonb(old) ->> col;
    if v_new is distinct from v_old then
      insert into public.personal_data_changes (actor_id, subject, subject_ref, field, action)
      values ((select auth.uid()), subj, case when ref_col <> '' then to_jsonb(new) ->> ref_col end, field,
              case when v_new is null then 'removed' else 'changed' end);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function private.audit_contact_changes() from public, anon, authenticated;

create trigger businesses_audit_contact
  after update of cnpj, phone, whatsapp on public.businesses
  for each row execute function private.audit_contact_changes('partner', 'short_code', 'cnpj:cnpj', 'phone:phone', 'whatsapp:whatsapp');

create trigger lost_cases_audit_contact
  after update of contact_phone on public.lost_cases
  for each row execute function private.audit_contact_changes('lost_case', 'short_code', 'contact_phone:phone');

create trigger adoption_seekers_audit_contact
  after update of whatsapp_private on public.adoption_seekers
  for each row execute function private.audit_contact_changes('adoption_seeker', '', 'whatsapp_private:whatsapp');

create trigger profiles_audit_contact
  after update of phone_private, whatsapp_private on public.profiles
  for each row execute function private.audit_contact_changes('account', '', 'phone_private:phone', 'whatsapp_private:whatsapp');

-- ---------------------------------------------------------------------------
-- WhatsApp da fila de adoção (só ele; o status não muda).
-- ---------------------------------------------------------------------------
create or replace function public.set_my_adoption_seeker_whatsapp(p_whatsapp text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  digits text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g'), '');
begin
  if me is null or private.is_anonymous_session() then
    raise exception 'Entre na sua conta para cadastrar seu interesse.' using errcode = '42501';
  end if;
  if digits is not null and not private.is_valid_br_phone(digits) then
    raise exception 'Telefone inválido. Use DDD e número (celular com 9 na frente).' using errcode = '22023';
  end if;
  if not private.has_recent_auth(600) then
    raise exception 'Para alterar este dado, confirme sua identidade de novo.' using errcode = '42501';
  end if;
  update public.adoption_seekers set whatsapp_private = digits where user_id = me;
  if not found then
    raise exception 'Você ainda não cadastrou seu interesse.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.set_my_adoption_seeker_whatsapp(text) from public, anon;
grant execute on function public.set_my_adoption_seeker_whatsapp(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Dados pessoais do PRÓPRIO titular (página /perfil/dados).
-- ---------------------------------------------------------------------------
create or replace function public.my_personal_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or private.is_anonymous_session() then
    raise exception 'Entre na sua conta.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'account', (select jsonb_build_object(
        'email', u.email,
        'email_pending', nullif(u.email_change, ''),
        'email_confirmed', u.email_confirmed_at is not null,
        'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb))
      from auth.users u where u.id = uid),
    'partners', coalesce((select jsonb_agg(jsonb_build_object(
        'code', b.short_code, 'kind', b.partner_kind, 'name', b.name, 'status', b.status,
        'phone', b.phone, 'whatsapp', b.whatsapp, 'cnpj', b.cnpj,
        'cnpj_status', (select c.status from public.business_cnpj_checks c where c.business_id = b.id),
        'document_state', (select d.read_state from public.partner_documents d where d.business_id = b.id))
        order by b.created_at)
      from public.businesses b where b.owner_id = uid), '[]'::jsonb),
    'seeker', (select jsonb_build_object('status', s.status, 'whatsapp', s.whatsapp_private)
      from public.adoption_seekers s where s.user_id = uid),
    'lost_cases', coalesce((select jsonb_agg(jsonb_build_object(
        'code', c.short_code, 'status', c.status, 'pet_name', p.name, 'contact_phone', c.contact_phone,
        'whatsapp_public', c.contact_whatsapp_public, 'phone_public', c.contact_phone_public)
        order by c.created_at desc)
      from public.lost_cases c join public.pets p on p.id = c.pet_id
      where c.owner_id = uid and c.status in ('DRAFT', 'ACTIVE')), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.my_personal_data() from public, anon;
grant execute on function public.my_personal_data() to authenticated;
