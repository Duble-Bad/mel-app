-- MEL — Pacote final pré-Feature-Freeze: push para o tutor + rótulo público do avistamento.
--
-- 1. Push para quem procura o pet (antes só o Guardião recebia push):
--      - avistamento novo                      → tutor
--      - mensagem nova em conversa de alerta   → o outro participante
--      - Radar: correspondência nova           → tutor (lado "owner"; quem
--        publicou o encontrado continua só no app)
--    Mesma fila (push_outbox) e mesmo despachante do Guardião. O aviso no app já
--    é agrupado (um não lido por alerta/conversa, com contador); o push reusa a
--    mesma notificação e, por ela, toca no máximo uma vez a cada 10 minutos
--    (o despacho manda o contador atualizado). Teto de 12 pushes/hora por pessoa
--    fora do Guardião. Silêncio noturno continua só para o Guardião: tutor
--    procurando o próprio pet recebe a pista a qualquer hora.
--    Texto do push: sem coordenada, sem endereço, sem texto livre (pushPayload).
--
-- 2. Rótulo público do avistamento: `place_label` vem do ponto EXATO (rua ou
--    nome de lugar/condomínio escolhido na busca) e anulava parte da grade de
--    250 m para quem não é tutor/autor/moderação. Agora o público recebe só
--    bairro e cidade (mesma regra dos alertas: publicAreaFrom), derivado no banco
--    do rótulo, que o app sempre monta como "lugar ou rua, bairro, cidade – UF".
--    Tutor, autor e moderação continuam com o rótulo completo.
--
-- O Radar (pontuação, distância, pontos usados) não muda: record_match só ganha
-- o enfileiramento do push no aviso que já existia.

-- 1. Push: fila com teto e intervalo -----------------------------------------

create index push_outbox_notification_idx on public.push_outbox (notification_id, created_at);
create index push_outbox_user_created_idx on public.push_outbox (user_id, created_at);

create or replace function private.queue_push(p_notification uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_notification is null or p_user is null then
    return;
  end if;
  -- O mesmo aviso (agrupado) toca no máximo a cada 10 minutos.
  if exists (select 1 from public.push_outbox
              where notification_id = p_notification and created_at > now() - interval '10 minutes') then
    return;
  end if;
  -- Teto por pessoa, fora do Guardião (que tem a cota própria).
  if (select count(*) from public.push_outbox o join public.notifications n on n.id = o.notification_id
       where o.user_id = p_user and o.created_at > now() - interval '1 hour' and n.kind <> 'guardian_alert') >= 12 then
    perform private.log_abuse('tutor_push_budget', p_notification, null);
    return;
  end if;
  insert into public.push_outbox (notification_id, user_id) values (p_notification, p_user);
end;
$$;

revoke all on function private.queue_push(uuid, uuid) from public, anon, authenticated;

-- Avistamento novo (agrupado por alerta, como na migration 27) + push.
create or replace function private.notify_sighting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  nid uuid;
begin
  select lc.owner_id, lc.short_code, p.name as pet_name
    into c
    from public.lost_cases lc join public.pets p on p.id = lc.pet_id
   where lc.id = new.lost_case_id;
  -- O próprio tutor registrando não gera aviso para si.
  if c.owner_id is distinct from new.reporter_id then
    -- Avistamentos simultâneos não criam dois avisos: um por vez por alerta.
    perform pg_advisory_xact_lock(hashtextextended('sighting_new:' || c.short_code, 0));
    update public.notifications
       set payload = payload || jsonb_build_object(
             'count', coalesce((payload ->> 'count')::int, 1) + 1,
             'sighting_id', new.id, 'place_label', new.place_label, 'seen_at', new.seen_at),
           created_at = now()
     where user_id = c.owner_id and kind = 'sighting_new' and read_at is null
       and payload ->> 'code' = c.short_code
    returning id into nid;
    if not found then
      insert into public.notifications (user_id, kind, payload)
      values (c.owner_id, 'sighting_new', jsonb_build_object(
        'code', c.short_code, 'pet_name', c.pet_name, 'sighting_id', new.id,
        'place_label', new.place_label, 'seen_at', new.seen_at, 'count', 1))
      returning id into nid;
    end if;
    perform private.queue_push(nid, c.owner_id);
  end if;
  return new;
end;
$$;

-- Mensagem nova (agrupada por conversa, como na migration 20) + push só em conversa de alerta.
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
  -- Quem escreve nunca é o destinatário. Adoção fica só no app.
  if ctx.kind = 'lost' then
    perform private.queue_push(nid, recipient);
  end if;
  return new;
end;
$$;

-- Radar: mesma regra da migration 27 + push só para o tutor.
create or replace function private.record_match(p_lost_id uuid, p_found_id uuid, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid;
  info record;
  nid uuid;
begin
  if p_result is null or (p_result ->> 'score')::int < 50 then
    return;
  end if;
  insert into public.case_matches (lost_case_id, found_case_id, score, reasons)
  values (p_lost_id, p_found_id, (p_result ->> 'score')::int, p_result -> 'reasons')
  on conflict (lost_case_id, found_case_id) do nothing
  returning id into match_id;
  if match_id is null then
    return; -- já existia: não notifica de novo
  end if;

  select lc.owner_id, lc.short_code as lost_code, p.name as pet_name, fc.reporter_id, fc.short_code as found_code
    into info
    from public.lost_cases lc join public.pets p on p.id = lc.pet_id, public.found_cases fc
   where lc.id = p_lost_id and fc.id = p_found_id;

  -- Sem pontuação no aviso (fica na correspondência, vista no Radar).
  perform pg_advisory_xact_lock(hashtextextended('match_new:' || info.lost_code, 0));
  update public.notifications
     set payload = jsonb_set(payload, '{count}', to_jsonb(coalesce((payload ->> 'count')::int, 1) + 1)),
         created_at = now()
   where user_id = info.owner_id and kind = 'match_new' and read_at is null
     and payload ->> 'to' = 'owner' and payload ->> 'lost_code' = info.lost_code
  returning id into nid;
  if not found then
    insert into public.notifications (user_id, kind, payload)
    values (info.owner_id, 'match_new', jsonb_build_object('to', 'owner', 'pet_name', info.pet_name, 'lost_code', info.lost_code, 'count', 1))
    returning id into nid;
  end if;
  perform private.queue_push(nid, info.owner_id);
  insert into public.notifications (user_id, kind, payload)
  values (info.reporter_id, 'match_new', jsonb_build_object('to', 'finder', 'pet_name', info.pet_name, 'found_code', info.found_code));
end;
$$;

-- Silêncio noturno só para o Guardião (preferência dele); o tutor recebe a pista a qualquer hora.
create or replace function public.claim_push_batch(p_limit integer default 50)
returns table (
  outbox_id bigint,
  user_id uuid,
  kind text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz,
  notification_id uuid,
  quiet_night boolean,
  subscriptions jsonb
)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.push_outbox o set status = 'SENDING'
     where o.id in (
       select id from public.push_outbox where status = 'PENDING'
        order by created_at limit least(greatest(p_limit, 1), 200)
        for update skip locked)
    returning o.id, o.notification_id, o.user_id
  )
  select c.id, c.user_id, n.kind, n.payload, n.read_at, n.created_at, n.id,
         case when n.kind = 'guardian_alert' then coalesce(g.quiet_night, true) else false end,
         coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                     from public.push_subscriptions s where s.user_id = c.user_id), '[]'::jsonb)
    from claimed c
    join public.notifications n on n.id = c.notification_id
    left join public.guardian_settings g on g.user_id = c.user_id;
$$;

-- 2. Rótulo público do avistamento -------------------------------------------

alter table public.sightings add column public_place_label text;

-- "Lugar ou rua, Bairro, Cidade – UF" → "Bairro, Cidade – UF". Sem bairro →
-- só a cidade. "Cidade, UF" já é uma região e fica igual. Um nome solto (sem
-- vírgula) pode ser um lugar exato: não sai.
create or replace function private.public_area_from_label(p_label text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when x.parts is null or btrim(p_label) = '' then null
    when array_length(x.parts, 1) >= 3 then array_to_string(x.parts[2:], ', ')
    when array_length(x.parts, 1) = 2 and x.parts[2] ~ '^[A-Z]{2}$' then btrim(p_label)
    when array_length(x.parts, 1) = 2 then x.parts[2]
    else null
  end
  from (select regexp_split_to_array(btrim(p_label), '\s*,\s*') as parts) x;
$$;

revoke all on function private.public_area_from_label(text) from public, anon, authenticated;

-- O trigger do ponto público (migration 29) passa a derivar também o rótulo público.
create or replace function private.sightings_public_point()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sempre derivados do dado exato (nunca vêm do cliente).
  select f.fuzzed_lat, f.fuzzed_lng into new.public_lat, new.public_lng
    from private.fuzz_lat_lng(new.lat, new.lng, 250) f;
  new.public_place_label := private.public_area_from_label(new.place_label);
  return new;
end;
$$;

-- Backfill: o trigger recalcula; lat/lng e place_label não mudam.
update public.sightings set lat = lat;

create or replace function public.get_lost_case_timeline(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'seen_at', s.seen_at,
      'lat', case when a.exact then s.lat else s.public_lat end,
      'lng', case when a.exact then s.lng else s.public_lng end,
      'point_is_exact', a.exact,
      -- Rua/lugar exato só para quem tem o ponto exato; os demais, bairro e cidade.
      'place_label', case when a.exact then s.place_label else s.public_place_label end,
      'direction', s.direction, 'states', s.states, 'notes', s.notes,
      -- Caminho antigo (<sessão>/…) identifica quem enviou: só para quem já sabe.
      'photo_path', case when a.exact or strpos(s.photo_path, '/') = 0 then s.photo_path end,
      'hidden', s.status = 'HIDDEN', 'mine', s.reporter_id = (select auth.uid()),
      'can_reply', c.owner_id = (select auth.uid()) and c.status in ('ACTIVE', 'FOUND')
                   and s.reporter_id is not null and s.reporter_id <> c.owner_id)
    order by s.seen_at), '[]'::jsonb)
  from public.lost_cases c
  join public.sightings s on s.lost_case_id = c.id
  cross join lateral (
    select coalesce(c.owner_id = (select auth.uid()), false)
        or coalesce(s.reporter_id = (select auth.uid()), false)
        or private.is_moderator() as exact
  ) a
  where c.short_code = lower(p_code)
    and (c.status in ('ACTIVE', 'FOUND') or (c.status = 'CLOSED' and c.owner_id = (select auth.uid())))
    -- Ocultos só aparecem para o tutor (que pode reexibir).
    and (s.status = 'VISIBLE' or c.owner_id = (select auth.uid()));
$$;

revoke all on function public.get_lost_case_timeline(text) from public;
grant execute on function public.get_lost_case_timeline(text) to anon, authenticated;
