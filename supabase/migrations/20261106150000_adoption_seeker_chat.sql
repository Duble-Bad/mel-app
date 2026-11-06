-- Adoção: chat com a fila "Querem adotar" (decisão do proprietário de 2026-11-06).
--
-- Quem anuncia um animal DISPONÍVEL (anúncio aprovado pela moderação: doador,
-- ONG ou protetor) pode iniciar uma conversa PRIVADA com uma pessoa da fila.
-- Reaproveita o chat que já existe (conversations/messages, bloqueios,
-- denúncias, avisos e push): a conversa é a mesma da "Quero adotar" de um
-- anúncio — adoption_listing_id + owner_id (quem anuncia) + helper_id (quem
-- quer adotar) — só que aberta por quem anuncia (created_by = owner_id).
-- Por isso o par (anúncio, pessoa) continua com UMA conversa só: se a pessoa já
-- tinha mandado interesse, a conversa é retomada.
--
-- Consentimento (LGPD, opt-in explícito e revogável):
--   * adoption_seekers.contact_ok, DESLIGADO por padrão. A pessoa liga em
--     "Aceito ser contatado por quem anuncia", no próprio perfil da fila. Ligar
--     ou desligar não volta para a moderação.
--   * Só vale junto com a lista pública (show_public): quem não aparece na lista
--     não é encontrado, e desligar a lista também encerra novos contatos.
--   * contact_ref: referência opaca e aleatória (não é o id do perfil nem da
--     conta), entregue só a quem pode iniciar. Desligar o contato troca a
--     referência: links antigos deixam de funcionar.
--
-- Quem pode iniciar: dono de um anúncio AVAILABLE, conta real (não anônima) e
-- não suspensa. Moderação não ganha atalho: a conversa é sempre entre quem
-- anuncia e quem quer adotar (a moderação lê só conversas denunciadas).
-- Alvo: perfil APPROVED, dentro da validade, com show_public e contact_ok,
-- conta não suspensa, nunca a própria pessoa e sem bloqueio entre os dois.
--
-- Dados mínimos: quem anuncia vê só o que a lista pública já mostra (primeiro
-- nome, bairro/cidade e preferências) + a referência; a conversa não leva
-- e-mail, WhatsApp, área exata nem o id do perfil (peer_id sai nulo). Quem
-- quer adotar vê o contexto do anúncio (nome, foto e código do animal).
--
-- Anti-abuso:
--   * por quem anuncia: até 10 conversas novas com a fila por dia;
--   * por anúncio: até 5 conversas novas com a fila por dia;
--   * o teto geral de 10 conversas novas por hora (start_conversation) vale aqui;
--   * 1ª mensagem: sem link, telefone nem e-mail (quem recebe não pediu o
--     contato; golpe e captação de dados começam por aí);
--   * aviso no sino (agrupado por conversa) + push pela fila de sempre
--     (private.queue_push: no máximo um toque a cada 10 min por aviso e
--     teto de 12/h por pessoa).

-- ---------------------------------------------------------------------------
-- 1. Consentimento e referência opaca na fila
-- ---------------------------------------------------------------------------
alter table public.adoption_seekers add column contact_ok boolean not null default false;
alter table public.adoption_seekers add column contact_ref uuid not null default gen_random_uuid();
alter table public.adoption_seekers add constraint adoption_seekers_contact_ref_key unique (contact_ref);

-- Perfil do próprio usuário: inclui o consentimento de contato.
create or replace function private.adoption_seeker_json(s public.adoption_seekers, p_full boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'status', s.status, 'species', s.species, 'sizes', s.sizes, 'ages', s.ages,
    'area_lat', s.area_lat, 'area_lng', s.area_lng, 'area_label', s.area_label, 'radius_m', s.radius_m,
    'housing', s.housing, 'other_pets', s.other_pets, 'children', s.children, 'routine', s.routine,
    'notify', s.notify, 'show_public', s.show_public, 'contact_ok', s.contact_ok, 'review_note', s.review_note,
    'reviewed_at', s.reviewed_at, 'expires_at', s.expires_at, 'created_at', s.created_at, 'updated_at', s.updated_at,
    'first_name', (select split_part(btrim(p.display_name), ' ', 1) from public.profiles p where p.id = s.user_id))
    || case when p_full then jsonb_build_object('whatsapp', s.whatsapp_private, 'user_id', s.user_id) else '{}'::jsonb end;
$$;

-- "Aceito ser contatado por quem anuncia" (não volta para a moderação).
create or replace function public.set_my_adoption_seeker_contact(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.adoption_seekers
     set contact_ok = coalesce(p_enabled, false),
         -- Desligar invalida a referência que já circulou.
         contact_ref = case when coalesce(p_enabled, false) then contact_ref else gen_random_uuid() end
   where user_id = (select auth.uid());
  if not found then
    raise exception 'Você ainda não cadastrou seu interesse.' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Quem pode iniciar
-- ---------------------------------------------------------------------------
create or replace function private.can_contact_seekers(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null
     and exists (select 1 from public.profiles p where p.id = p_user and not p.is_anonymous and p.suspended_at is null)
     and exists (select 1 from public.adoption_listings a where a.owner_id = p_user and a.status = 'AVAILABLE');
$$;

revoke all on function private.can_contact_seekers(uuid) from public, anon, authenticated;

-- Lista pública "Querem adotar": a mesma de antes; quem pode iniciar recebe
-- também a referência opaca de quem aceitou contato (e nada mais).
create or replace function public.list_public_adoption_seekers(p_species text default null, p_limit integer default 24, p_offset integer default 0)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id, private.can_contact_seekers((select auth.uid())) as can_contact
  ),
  items as (
    select s.*, split_part(btrim(p.display_name), ' ', 1) as first_name
      from public.adoption_seekers s
      join public.profiles p on p.id = s.user_id
     where s.status = 'APPROVED' and s.show_public and s.expires_at > now() and p.suspended_at is null
       and (p_species is null or s.species = p_species or s.species = 'any')
  )
  select jsonb_build_object(
    'total', (select count(*) from items),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                 'first_name', nullif(i.first_name, ''), 'area_label', i.area_label,
                 'species', i.species, 'sizes', i.sizes, 'ages', i.ages)
                 || case when me.can_contact and i.contact_ok and i.user_id <> me.id
                         then jsonb_build_object('contact_ref', i.contact_ref) else '{}'::jsonb end
                 order by i.reviewed_at desc)
               from (select * from items order by reviewed_at desc
                     limit least(greatest(coalesce(p_limit, 24), 1), 60) offset greatest(coalesce(p_offset, 0), 0)) i
               cross join me), '[]'::jsonb));
$$;

-- Anúncios de onde a pessoa pode iniciar (para escolher sobre qual animal conversar).
create or replace function public.list_my_listings_for_seeker_contact()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', a.short_code, 'name', a.name, 'photo_path', a.photo_paths[1])
                            order by a.published_at desc nulls last, a.created_at desc), '[]'::jsonb)
    from public.adoption_listings a
   where a.owner_id = (select auth.uid()) and a.status = 'AVAILABLE'
     and private.can_contact_seekers((select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- 3. Conversas: origem e limites
-- ---------------------------------------------------------------------------
-- Perfil da fila de onde a conversa saiu (a conversa fica se o perfil for apagado).
alter table public.conversations add column adoption_seeker_id uuid references public.adoption_seekers (id) on delete set null;
create index conversations_adoption_seeker_idx on public.conversations (adoption_seeker_id) where adoption_seeker_id is not null;
-- Limites por dia: conversas de adoção abertas por quem anuncia (created_by = owner_id).
create index conversations_adoption_created_idx on public.conversations (created_by, created_at)
  where adoption_listing_id is not null;
create index conversations_adoption_listing_created_idx on public.conversations (adoption_listing_id, created_at)
  where adoption_listing_id is not null;

-- Quem anuncia abre (ou retoma) a conversa com uma pessoa da fila, já com a 1ª mensagem.
create or replace function public.start_adoption_seeker_conversation(p_listing_code text, p_seeker_ref uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a public.adoption_listings;
  s public.adoption_seekers;
  v_body text := btrim(coalesce(p_body, ''));
  conv_id uuid;
begin
  if me is null or private.is_anonymous_session() then
    raise exception 'Entre na sua conta para conversar com quem quer adotar.' using errcode = '42501';
  end if;
  if private.is_suspended(me) then
    raise exception 'Não é possível iniciar esta conversa.' using errcode = '42501';
  end if;
  select * into a from public.adoption_listings where short_code = lower(p_listing_code);
  if a.id is null or a.owner_id <> me or a.status <> 'AVAILABLE' then
    raise exception 'Só quem anuncia um animal disponível pode iniciar esta conversa.' using errcode = '42501';
  end if;
  -- Mesma resposta para todo motivo (sem consentimento, vencido, recusado,
  -- suspenso, bloqueio): não revela o estado do perfil de ninguém.
  select s0.* into s
    from public.adoption_seekers s0
    join public.profiles p on p.id = s0.user_id
   where s0.contact_ref = p_seeker_ref
     and s0.status = 'APPROVED' and s0.expires_at > now() and s0.show_public and s0.contact_ok
     and p.suspended_at is null and s0.user_id <> me
     and not private.is_blocked_between(me, s0.user_id);
  if s.id is null then
    raise exception 'Esta pessoa não está recebendo contatos agora.' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'Escreva uma mensagem de até 2000 caracteres.' using errcode = '22023';
  end if;

  -- Um par (anúncio, pessoa) = uma conversa: retoma a que já existe.
  select id into conv_id from public.conversations where adoption_listing_id = a.id and helper_id = s.user_id;
  if conv_id is null then
    -- 1ª mensagem para quem não pediu o contato: sem link, telefone nem e-mail.
    if v_body ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|br|io|me|ly)\M)'
       or v_body ~ '[0-9][0-9 ().-]{7,}[0-9]'
       or v_body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
      raise exception 'Na primeira mensagem, não envie links, telefone nem e-mail. Apresente-se e conte sobre o animal; o contato continua pelo chat da MEL.' using errcode = '22023';
    end if;
    -- Pares simultâneos não furam os tetos.
    perform pg_advisory_xact_lock(hashtextextended('seeker_chat:' || me::text, 0));
    if (select count(*) from public.conversations
         where created_by = me and adoption_listing_id is not null and owner_id = me
           and created_at > now() - interval '1 day') >= 10 then
      raise exception 'Você já iniciou muitas conversas com a fila hoje. Tente amanhã.' using errcode = 'P0429';
    end if;
    if (select count(*) from public.conversations
         where adoption_listing_id = a.id and created_by = me
           and created_at > now() - interval '1 day') >= 5 then
      raise exception 'Este anúncio já iniciou muitas conversas hoje. Tente amanhã.' using errcode = 'P0429';
    end if;
    if (select count(*) from public.conversations
         where created_by = me and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Você abriu muitas conversas agora. Tente de novo mais tarde.' using errcode = 'P0429';
    end if;
    insert into public.conversations (adoption_listing_id, owner_id, helper_id, created_by, adoption_seeker_id)
    values (a.id, me, s.user_id, me, s.id)
    returning id into conv_id;
  end if;

  -- O gatilho das mensagens aplica bloqueio, limites e mensagem repetida.
  insert into public.messages (conversation_id, sender_id, body) values (conv_id, me, v_body);
  update public.conversations set owner_last_read_at = now() where id = conv_id;
  return conv_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Resumo da conversa: origem "fila" e sem id da outra pessoa
-- ---------------------------------------------------------------------------
create or replace function private.conversation_json(conv public.conversations, me uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', conv.id,
    'context', ctx.kind,
    'code', ctx.code,
    'case_status', case when ctx.open then (case ctx.kind when 'lost' then (select status::text from public.lost_cases where id = conv.lost_case_id)
                                                   else (select status::text from public.adoption_listings where id = conv.adoption_listing_id) end)
                        else 'CLOSED' end,
    'pet_name', ctx.title,
    'pet_thumb_path', ctx.thumb_path,
    'my_role', case when me = conv.owner_id then 'owner' else 'helper' end,
    -- Conversa com a fila: nenhum id de perfil sai (dados mínimos).
    'peer_id', case when from_queue then null else peer.id end,
    'peer_name', case when me = conv.owner_id and not peer.is_anonymous then split_part(peer.display_name, ' ', 1) end,
    'peer_is_anonymous', peer.is_anonymous,
    'from_sighting', conv.sighting_id is not null,
    'from_found', conv.found_case_id is not null,
    'from_seeker_queue', from_queue,
    'blocked_by_me', exists (select 1 from public.blocks b where b.blocker_id = me and b.blocked_id = peer.id),
    'can_send', ctx.open and not private.is_blocked_between(me, peer.id) and not private.is_suspended(me),
    'created_at', conv.created_at,
    'last_message', (select jsonb_build_object('body', left(m.body, 140), 'created_at', m.created_at, 'mine', m.sender_id = me)
                       from public.messages m
                      where m.conversation_id = conv.id and m.hidden_at is null
                      order by m.created_at desc limit 1),
    'unread', (select count(*) from public.messages m
                where m.conversation_id = conv.id and m.sender_id <> me and m.hidden_at is null
                  and m.created_at > coalesce(case when me = conv.owner_id then conv.owner_last_read_at
                                                   else conv.helper_last_read_at end, '-infinity'))
  )
  from private.conversation_context(conv) ctx
  cross join lateral (select conv.adoption_listing_id is not null and conv.created_by = conv.owner_id as from_queue) q
  join public.profiles peer on peer.id = case when me = conv.owner_id then conv.helper_id else conv.owner_id end
  where me in (conv.owner_id, conv.helper_id);
$$;

-- ---------------------------------------------------------------------------
-- 5. Aviso + push: alerta (como antes) e conversa aberta a partir da fila
-- ---------------------------------------------------------------------------
create or replace function private.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  recipient uuid;
  ctx record;
  nid uuid;
begin
  update public.conversations set last_message_at = new.created_at
   where id = new.conversation_id
   returning * into conv;
  recipient := case when new.sender_id = conv.owner_id then conv.helper_id else conv.owner_id end;
  select * into ctx from private.conversation_context(conv);

  update public.notifications
     set payload = jsonb_set(payload, '{count}', to_jsonb(coalesce((payload ->> 'count')::int, 1) + 1)),
         created_at = now()
   where user_id = recipient and kind = 'message_new' and read_at is null
     and payload ->> 'conversation_id' = conv.id::text
  returning id into nid;
  if not found then
    insert into public.notifications (user_id, kind, payload)
    values (recipient, 'message_new', jsonb_build_object(
      'conversation_id', conv.id, 'code', ctx.code, 'pet_name', ctx.title, 'context', ctx.kind,
      'to_owner', recipient = conv.owner_id, 'count', 1))
    returning id into nid;
  end if;
  -- Quem escreve nunca é o destinatário. Push: alerta, e adoção só quando quem
  -- anuncia abriu a conversa pela fila (quem quer adotar não está com o app aberto).
  if ctx.kind = 'lost' or (conv.adoption_listing_id is not null and conv.created_by = conv.owner_id) then
    perform private.queue_push(nid, recipient);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke all on function public.set_my_adoption_seeker_contact(boolean),
  public.list_my_listings_for_seeker_contact(),
  public.start_adoption_seeker_conversation(text, uuid, text)
  from public, anon;
grant execute on function public.set_my_adoption_seeker_contact(boolean),
  public.list_my_listings_for_seeker_contact(),
  public.start_adoption_seeker_conversation(text, uuid, text)
  to authenticated;
revoke all on function public.list_public_adoption_seekers(text, integer, integer) from public;
grant execute on function public.list_public_adoption_seekers(text, integer, integer) to anon, authenticated;
