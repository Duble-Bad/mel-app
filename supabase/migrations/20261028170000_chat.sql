-- MEL — Milestone 8: chat por alerta, bloqueio e denúncia
-- Conversa de duas pessoas ligada a um alerta: o tutor e quem quer ajudar
-- (pode ser uma sessão anônima que enviou um avistamento). Ninguém vê o
-- telefone do outro. Tudo que muda estado passa por funções com regras;
-- mensagens são inseridas direto (RLS + trigger com bloqueio e limites).

-- ---------------------------------------------------------------------------
-- Bloqueios
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- Quem bloqueou vê e desfaz os próprios bloqueios; o bloqueado não fica sabendo.
create policy "blocks: quem bloqueou vê"
  on public.blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);

create policy "blocks: quem bloqueou desfaz"
  on public.blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;

create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function private.is_suspended(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select suspended_at is not null from public.profiles where id = p_user), false);
$$;

revoke all on function private.is_blocked_between(uuid, uuid), private.is_suspended(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Conversas
-- ---------------------------------------------------------------------------
create table public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  lost_case_id        uuid not null references public.lost_cases (id) on delete cascade,
  owner_id            uuid not null references public.profiles (id) on delete cascade,
  helper_id           uuid not null references public.profiles (id) on delete cascade,
  -- Avistamento que originou a conversa (tutor respondendo a quem viu).
  sighting_id         uuid references public.sightings (id) on delete set null,
  created_by          uuid not null references public.profiles (id) on delete cascade,
  created_at          timestamptz not null default now(),
  last_message_at     timestamptz,
  owner_last_read_at  timestamptz,
  helper_last_read_at timestamptz,
  unique (lost_case_id, helper_id),
  check (owner_id <> helper_id)
);

create index conversations_owner_idx on public.conversations (owner_id, last_message_at desc nulls last);
create index conversations_helper_idx on public.conversations (helper_id, last_message_at desc nulls last);

create or replace function private.is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations
     where id = p_conversation and (select auth.uid()) in (owner_id, helper_id)
  );
$$;

alter table public.conversations enable row level security;

create policy "conversations: participantes leem"
  on public.conversations for select to authenticated
  using ((select auth.uid()) in (owner_id, helper_id));

revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;

-- ---------------------------------------------------------------------------
-- Mensagens
-- ---------------------------------------------------------------------------
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now(),
  -- Ocultada pela moderação (M13).
  hidden_at       timestamptz
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  case_status public.lost_case_status;
  peer uuid;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if conv.id is null or new.sender_id not in (conv.owner_id, conv.helper_id) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  peer := case when new.sender_id = conv.owner_id then conv.helper_id else conv.owner_id end;
  select status into case_status from public.lost_cases where id = conv.lost_case_id;
  if case_status not in ('ACTIVE', 'FOUND')
     or private.is_blocked_between(new.sender_id, peer)
     or private.is_suspended(new.sender_id) then
    raise exception 'Esta conversa não aceita novas mensagens.' using errcode = '42501';
  end if;
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Você enviou muitas mensagens seguidas. Espere um minuto e tente de novo.' using errcode = 'P0429';
  end if;
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 500 then
    raise exception 'Você atingiu o limite de mensagens de hoje.' using errcode = 'P0429';
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  new.hidden_at := null;
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function private.messages_before_insert();

alter table public.messages enable row level security;

create policy "messages: participantes leem"
  on public.messages for select to authenticated
  using (hidden_at is null and (select private.is_conversation_member(conversation_id)));

create policy "messages: participante envia em seu nome"
  on public.messages for insert to authenticated
  with check ((select auth.uid()) = sender_id and (select private.is_conversation_member(conversation_id)));

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Aviso de mensagem nova: UMA notificação não lida por conversa (agrupa).
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('sighting_new', 'message_new'));

create index notifications_unread_conversation_idx
  on public.notifications (user_id, (payload ->> 'conversation_id'))
  where read_at is null and kind = 'message_new';

create or replace function private.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  recipient uuid;
  info record;
begin
  update public.conversations set last_message_at = new.created_at
   where id = new.conversation_id
   returning * into conv;
  recipient := case when new.sender_id = conv.owner_id then conv.helper_id else conv.owner_id end;

  update public.notifications
     set payload = jsonb_set(payload, '{count}', to_jsonb(coalesce((payload ->> 'count')::int, 1) + 1)),
         created_at = now()
   where user_id = recipient and kind = 'message_new' and read_at is null
     and payload ->> 'conversation_id' = conv.id::text;
  if not found then
    select lc.short_code, p.name as pet_name into info
      from public.lost_cases lc join public.pets p on p.id = lc.pet_id
     where lc.id = conv.lost_case_id;
    insert into public.notifications (user_id, kind, payload)
    values (recipient, 'message_new', jsonb_build_object(
      'conversation_id', conv.id, 'code', info.short_code, 'pet_name', info.pet_name,
      'to_owner', recipient = conv.owner_id, 'count', 1));
  end if;
  return new;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function private.messages_after_insert();

-- ---------------------------------------------------------------------------
-- Denúncias (moderação completa no M13)
-- ---------------------------------------------------------------------------
create type public.report_target as enum ('user', 'lost_case', 'found_case', 'sighting', 'adoption', 'message', 'business');
create type public.report_reason as enum ('scam', 'harassment', 'spam', 'fake', 'inappropriate', 'other');
create type public.report_status as enum ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED');

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references public.profiles (id) on delete cascade,
  target_type     public.report_target not null,
  target_id       uuid not null,
  conversation_id uuid references public.conversations (id) on delete set null,
  reason          public.report_reason not null,
  details         text check (char_length(details) <= 1000),
  status          public.report_status not null default 'OPEN',
  handled_by      uuid references public.profiles (id) on delete set null,
  handled_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);
create index reports_conversation_idx on public.reports (conversation_id);

alter table public.reports enable row level security;

create policy "reports: quem denunciou vê as suas"
  on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id);

create policy "reports: moderação vê todas"
  on public.reports for select to authenticated
  using ((select private.is_moderator()));

revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

-- Moderação lê só conversas denunciadas (não navega pelo chat de ninguém).
create or replace function private.is_reported_conversation(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reports where conversation_id = p_conversation);
$$;

create policy "messages: moderação lê conversas denunciadas"
  on public.messages for select to authenticated
  using ((select private.is_moderator()) and private.is_reported_conversation(conversation_id));

revoke all on function private.is_conversation_member(uuid), private.is_reported_conversation(uuid) from public, anon;
grant execute on function private.is_conversation_member(uuid), private.is_reported_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Funções do chat
-- ---------------------------------------------------------------------------

-- Quem quer ajudar abre (ou retoma) a conversa com o tutor e manda a 1ª mensagem.
create or replace function public.start_conversation(p_code text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.lost_cases;
  conv_id uuid;
begin
  if me is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  select * into c from public.lost_cases where short_code = lower(p_code);
  if c.id is null or c.status <> 'ACTIVE' then
    raise exception 'Este alerta não está mais ativo.' using errcode = '22023';
  end if;
  if c.owner_id = me then
    raise exception 'Este alerta é seu.' using errcode = '22023';
  end if;
  if not c.contact_chat then
    raise exception 'O tutor não está recebendo mensagens pelo chat.' using errcode = '22023';
  end if;

  select id into conv_id from public.conversations where lost_case_id = c.id and helper_id = me;
  if conv_id is null then
    if private.is_blocked_between(me, c.owner_id) or private.is_suspended(me) then
      raise exception 'Não é possível iniciar esta conversa.' using errcode = '42501';
    end if;
    if (select count(*) from public.conversations
         where created_by = me and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Você abriu muitas conversas agora. Tente de novo mais tarde.' using errcode = 'P0429';
    end if;
    insert into public.conversations (lost_case_id, owner_id, helper_id, created_by)
    values (c.id, c.owner_id, me, me)
    returning id into conv_id;
  end if;

  insert into public.messages (conversation_id, sender_id, body) values (conv_id, me, p_body);
  update public.conversations set helper_last_read_at = now() where id = conv_id;
  return conv_id;
end;
$$;

-- Tutor responde a quem enviou um avistamento (mesmo sem cadastro).
create or replace function public.open_conversation_from_sighting(p_sighting_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s record;
  conv_id uuid;
begin
  select si.reporter_id, lc.id as case_id, lc.owner_id, lc.status
    into s
    from public.sightings si join public.lost_cases lc on lc.id = si.lost_case_id
   where si.id = p_sighting_id;
  if s.case_id is null or s.owner_id is distinct from me then
    raise exception 'Avistamento não encontrado.' using errcode = '42501';
  end if;
  if s.reporter_id is null or s.reporter_id = me then
    raise exception 'Não há como responder a este avistamento.' using errcode = '22023';
  end if;
  if s.status not in ('ACTIVE', 'FOUND') then
    raise exception 'Este alerta não está mais ativo.' using errcode = '22023';
  end if;

  select id into conv_id from public.conversations where lost_case_id = s.case_id and helper_id = s.reporter_id;
  if conv_id is null then
    if private.is_blocked_between(me, s.reporter_id) or private.is_suspended(me) then
      raise exception 'Não é possível iniciar esta conversa.' using errcode = '42501';
    end if;
    insert into public.conversations (lost_case_id, owner_id, helper_id, sighting_id, created_by)
    values (s.case_id, me, s.reporter_id, p_sighting_id, me)
    returning id into conv_id;
  end if;
  return conv_id;
end;
$$;

-- Resumo de uma conversa para quem participa (null se não participa).
create or replace function private.conversation_json(conv public.conversations, me uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', conv.id,
    'code', lc.short_code,
    'case_status', lc.status,
    'pet_name', p.name,
    'pet_thumb_path', (select ph.thumb_path from public.pet_photos ph where ph.pet_id = p.id
                        order by ph.is_primary desc, ph.position limit 1),
    'my_role', case when me = conv.owner_id then 'owner' else 'helper' end,
    'peer_id', peer.id,
    -- Tutor vê o primeiro nome de quem ajuda (ou "sem cadastro"); quem ajuda vê "tutor de <pet>".
    'peer_name', case when me = conv.owner_id and not peer.is_anonymous then split_part(peer.display_name, ' ', 1) end,
    'peer_is_anonymous', peer.is_anonymous,
    'from_sighting', conv.sighting_id is not null,
    'blocked_by_me', exists (select 1 from public.blocks b where b.blocker_id = me and b.blocked_id = peer.id),
    'can_send', lc.status in ('ACTIVE', 'FOUND') and not private.is_blocked_between(me, peer.id) and not private.is_suspended(me),
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
  from public.lost_cases lc
  join public.pets p on p.id = lc.pet_id
  join public.profiles peer on peer.id = case when me = conv.owner_id then conv.helper_id else conv.owner_id end
  where lc.id = conv.lost_case_id and me in (conv.owner_id, conv.helper_id);
$$;

revoke all on function private.conversation_json(public.conversations, uuid) from public, anon;

create or replace function public.get_my_conversations()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.conversation_json(c, (select auth.uid()))
                            order by coalesce(c.last_message_at, c.created_at) desc), '[]'::jsonb)
    from public.conversations c
   where (select auth.uid()) in (c.owner_id, c.helper_id)
     -- Conversa aberta pelo outro lado e ainda vazia não aparece para mim.
     and (c.last_message_at is not null or c.created_by = (select auth.uid()));
$$;

create or replace function public.get_conversation(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.conversation_json(c, (select auth.uid())) from public.conversations c where c.id = p_id;
$$;

-- Conversa que eu (quem ajuda) já tenho com o tutor deste alerta.
create or replace function public.my_conversation_for_case(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.conversations c join public.lost_cases lc on lc.id = c.lost_case_id
   where lc.short_code = lower(p_code) and c.helper_id = (select auth.uid());
$$;

create or replace function public.mark_conversation_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  update public.conversations
     set owner_last_read_at = case when owner_id = me then now() else owner_last_read_at end,
         helper_last_read_at = case when helper_id = me then now() else helper_last_read_at end
   where id = p_id and me in (owner_id, helper_id);
  update public.notifications set read_at = now()
   where user_id = me and kind = 'message_new' and read_at is null and payload ->> 'conversation_id' = p_id::text;
end;
$$;

create or replace function public.set_conversation_block(p_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  peer uuid;
begin
  select case when owner_id = me then helper_id else owner_id end into peer
    from public.conversations where id = p_id and me in (owner_id, helper_id);
  if peer is null then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  if p_blocked then
    insert into public.blocks (blocker_id, blocked_id) values (me, peer) on conflict do nothing;
  else
    delete from public.blocks where blocker_id = me and blocked_id = peer;
  end if;
end;
$$;

-- Denúncia em 1 toque a partir da conversa (pode bloquear junto).
create or replace function public.report_conversation(
  p_id uuid,
  p_reason public.report_reason,
  p_details text default null,
  p_block boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  peer uuid;
  report_id uuid;
begin
  select case when owner_id = me then helper_id else owner_id end into peer
    from public.conversations where id = p_id and me in (owner_id, helper_id);
  if peer is null then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Você enviou muitas denúncias agora. Tente de novo mais tarde.' using errcode = 'P0429';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, conversation_id, reason, details)
  values (me, 'user', peer, p_id, p_reason, nullif(btrim(p_details), ''))
  returning id into report_id;
  if p_block then
    insert into public.blocks (blocker_id, blocked_id) values (me, peer) on conflict do nothing;
  end if;
  return report_id;
end;
$$;

revoke all on function
  public.start_conversation(text, text),
  public.open_conversation_from_sighting(uuid),
  public.get_my_conversations(),
  public.get_conversation(uuid),
  public.my_conversation_for_case(text),
  public.mark_conversation_read(uuid),
  public.set_conversation_block(uuid, boolean),
  public.report_conversation(uuid, public.report_reason, text, boolean)
from public, anon;
grant execute on function
  public.start_conversation(text, text),
  public.open_conversation_from_sighting(uuid),
  public.get_my_conversations(),
  public.get_conversation(uuid),
  public.my_conversation_for_case(text),
  public.mark_conversation_read(uuid),
  public.set_conversation_block(uuid, boolean),
  public.report_conversation(uuid, public.report_reason, text, boolean)
to authenticated;

-- ---------------------------------------------------------------------------
-- Linha do tempo: o tutor sabe se pode responder a quem enviou o avistamento.
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
      'hidden', s.status = 'HIDDEN', 'mine', s.reporter_id = (select auth.uid()),
      'can_reply', c.owner_id = (select auth.uid()) and s.reporter_id is not null and s.reporter_id <> c.owner_id)
    order by s.seen_at), '[]'::jsonb)
  from public.lost_cases c
  join public.sightings s on s.lost_case_id = c.id
  where c.short_code = lower(p_code)
    and c.status in ('ACTIVE', 'FOUND')
    -- Ocultos só aparecem para o tutor (que pode reexibir).
    and (s.status = 'VISIBLE' or c.owner_id = (select auth.uid()));
$$;
