-- Anti-abuso com sessões anônimas descartáveis (P1 da auditoria de 2026-10-30).
--
-- Problema: os limites eram todos POR SESSÃO (uuid). Quem cria sessões anônimas
-- em série e chama as RPCs direto passa por cima deles. Sem novas proteções,
-- com isso dava para: encher o sino do tutor (1 aviso por avistamento ou por
-- correspondência do Radar), abrir dezenas de conversas com o mesmo tutor,
-- gastar a cota diária de push dos Guardiões com encontrados falsos, inundar a
-- moderação com denúncias repetidas e usar o bucket sighting-media como
-- hospedagem de imagens (sem limite de arquivos nem vínculo com envio).
--
-- Princípio (MEL é emergência): a CONTRIBUIÇÃO é aceita; o que se contém é o
-- efeito em massa sobre outras pessoas. Avistamento e encontrado nunca são
-- recusados por volume do alerta. Contas não entram nos tetos de anônimos.
--
--   1. Sino do tutor agrupado: um aviso não lido de avistamento por alerta e um
--      de correspondência do Radar por alerta, com contador (como já era nas
--      mensagens). Nada se perde: a linha do tempo e o Radar têm tudo.
--   2. Conversas novas abertas por sessões anônimas no mesmo alerta: até 20/h.
--      O avistamento continua sempre aberto.
--   3. Mensagem idêntica repetida na mesma conversa em 10 min: recusada.
--   4. Push de Guardião vindo de autor anônimo: até 2 por Guardião por dia
--      (o resto da cota diária fica para alertas de contas).
--   5. Denúncias: a partir de 5 denúncias anônimas abertas sobre o mesmo
--      conteúdo, as seguintes de sessões anônimas são agrupadas (sem erro).
--   6. sighting-media: arquivo de até 2 MB, nome <sessão>/<uuid>.(webp|jpg|png),
--      no máximo 3 arquivos ainda sem avistamento/encontrado por sessão e 60 por
--      hora somando todas as sessões anônimas. Se a foto falhar, o envio segue
--      sem foto (o formulário já faz isso).
--   7. Inscrições de push: no máximo as 10 mais recentes por pessoa.
--   8. Observabilidade: contenções silenciosas viram eventos 'abuse_guard'
--      (regra, alvo, autor; sem conteúdo, sem IP), guardados por 30 dias.
-- Criação de sessões: limite do Supabase Auth por IP + captcha no lançamento.

-- Apoio ao vínculo foto ↔ envio (contagem de arquivos órfãos).
create index sightings_photo_path_idx on public.sightings (photo_path) where photo_path is not null;
create index found_cases_photo_path_idx on public.found_cases (photo_path) where photo_path is not null;

-- 8. Registro de contenção (eventos da moderação; retenção de 30 dias). -------

create or replace function private.log_abuse(p_rule text, p_subject uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.events where name = 'abuse_guard' and created_at < now() - interval '30 days';
  insert into public.events (name, subject_id, user_id, props)
  values ('abuse_guard', p_subject, p_actor, jsonb_build_object('rule', p_rule));
end;
$$;

revoke all on function private.log_abuse(text, uuid, uuid) from public, anon, authenticated;

-- 1a. Avistamento novo: um aviso não lido por alerta, com contador. ----------

create or replace function private.notify_sighting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
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
       and payload ->> 'code' = c.short_code;
    if not found then
      insert into public.notifications (user_id, kind, payload)
      values (c.owner_id, 'sighting_new', jsonb_build_object(
        'code', c.short_code, 'pet_name', c.pet_name, 'sighting_id', new.id,
        'place_label', new.place_label, 'seen_at', new.seen_at, 'count', 1));
    end if;
  end if;
  return new;
end;
$$;

-- 1b. Radar: um aviso não lido de correspondência por alerta (lado do tutor). --

create or replace function private.record_match(p_lost_id uuid, p_found_id uuid, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid;
  info record;
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
     and payload ->> 'to' = 'owner' and payload ->> 'lost_code' = info.lost_code;
  if not found then
    insert into public.notifications (user_id, kind, payload)
    values (info.owner_id, 'match_new', jsonb_build_object('to', 'owner', 'pet_name', info.pet_name, 'lost_code', info.lost_code, 'count', 1));
  end if;
  insert into public.notifications (user_id, kind, payload)
  values (info.reporter_id, 'match_new', jsonb_build_object('to', 'finder', 'pet_name', info.pet_name, 'found_code', info.found_code));
end;
$$;

-- 2. Conversas novas por sessões anônimas no mesmo alerta. ------------------

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
    -- Teto somado de todas as sessões anônimas para o mesmo alerta.
    if exists (select 1 from public.profiles where id = me and is_anonymous)
       and (select count(*) from public.conversations cv join public.profiles p on p.id = cv.created_by
             where cv.lost_case_id = c.id and p.is_anonymous
               and cv.created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Muitas pessoas estão escrevendo para este tutor agora. Envie um avistamento (ele sempre chega) ou tente de novo em alguns minutos.' using errcode = 'P0429';
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

-- 3. Mensagem idêntica repetida na mesma conversa. ----------------------------

create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  ctx record;
  peer uuid;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if conv.id is null or new.sender_id not in (conv.owner_id, conv.helper_id) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  peer := case when new.sender_id = conv.owner_id then conv.helper_id else conv.owner_id end;
  select * into ctx from private.conversation_context(conv);
  if not coalesce(ctx.open, false)
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
  if exists (select 1 from public.messages
              where conversation_id = new.conversation_id and sender_id = new.sender_id
                and body = new.body and created_at > now() - interval '10 minutes') then
    raise exception 'Você acabou de enviar esta mesma mensagem.' using errcode = 'P0429';
  end if;
  new.created_at := now();
  new.hidden_at := null;
  return new;
end;
$$;

-- 4. Push de Guardião vindo de autor anônimo: até 2 por Guardião por dia. ----

create or replace function private.notify_guardians(
  p_kind text,              -- 'lost' | 'found'
  p_case_key text,
  p_point extensions.geography,
  p_author uuid,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  author_anon boolean := exists (select 1 from public.profiles where id = p_author and is_anonymous);
  v_payload jsonb := p_payload || jsonb_build_object('case_key', p_case_key, 'case_kind', p_kind)
                     || case when author_anon then jsonb_build_object('via', 'anon') else '{}'::jsonb end;
  n integer;
  held integer;
begin
  if p_point is null then
    return 0;
  end if;
  with targets as (
    select g.user_id,
           author_anon and (select count(*) from public.notifications na
                             where na.user_id = g.user_id and na.kind = 'guardian_alert'
                               and na.payload ->> 'via' = 'anon' and na.created_at >= today_start) >= 2 as over_anon_budget
      from public.guardian_settings g
      join public.profiles pr on pr.id = g.user_id
     where g.enabled and pr.suspended_at is null
       and g.user_id is distinct from p_author
       and ((p_kind = 'lost' and g.alert_lost) or (p_kind = 'found' and g.alert_found))
       and extensions.st_dwithin(g.area_point, p_point, g.radius_m)
       and (select count(*) from public.notifications nn
             where nn.user_id = g.user_id and nn.kind = 'guardian_alert' and nn.created_at >= today_start) < g.max_per_day
  ),
  inserted as (
    insert into public.notifications (user_id, kind, payload)
    select t.user_id, 'guardian_alert', v_payload from targets t where not t.over_anon_budget
    on conflict (user_id, (payload ->> 'case_key')) where kind = 'guardian_alert' do nothing
    returning id, user_id
  ),
  queued as (
    insert into public.push_outbox (notification_id, user_id)
    select i.id, i.user_id from inserted i
    returning 1
  )
  select (select count(*) from queued), (select count(*) from targets where over_anon_budget) into n, held;
  if held > 0 then
    perform private.log_abuse('guardian_anon_budget', null, p_author);
  end if;
  return n;
end;
$$;

revoke all on function private.notify_guardians(text, text, extensions.geography, uuid, jsonb) from public, anon, authenticated;

-- 5. Denúncias anônimas repetidas sobre o mesmo conteúdo: agrupadas. ----------

create or replace function public.report_content(
  p_target_type public.report_target,
  p_target text,
  p_reason public.report_reason,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target uuid;
  existing uuid;
  report_id uuid;
begin
  if me is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  if p_target_type = 'lost_case' then
    select id into target from public.lost_cases where short_code = lower(p_target) and status in ('ACTIVE', 'FOUND');
  elsif p_target_type = 'found_case' then
    select id into target from public.found_cases where short_code = lower(p_target) and status <> 'REMOVED';
  elsif p_target_type = 'sighting' then
    select s.id into target from public.sightings s
     where s.id::text = p_target and s.status = 'VISIBLE';
  elsif p_target_type = 'adoption' then
    select id into target from public.adoption_listings where short_code = lower(p_target) and status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED');
  elsif p_target_type = 'business' then
    select id into target from public.businesses where short_code = lower(p_target) and status = 'APPROVED';
  else
    raise exception 'Tipo de denúncia não suportado aqui.' using errcode = '22023';
  end if;
  if target is null then
    raise exception 'Não encontramos esse conteúdo.' using errcode = '22023';
  end if;
  -- Mesma pessoa, mesmo conteúdo, ainda em aberto: não duplica.
  select id into existing from public.reports
   where reporter_id = me and target_type = p_target_type and target_id = target and status in ('OPEN', 'REVIEWING');
  if existing is not null then
    return existing;
  end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Você enviou muitas denúncias agora. Tente de novo mais tarde.' using errcode = 'P0429';
  end if;
  -- Já há 5 denúncias anônimas em aberto sobre este conteúdo: a moderação já
  -- foi avisada; outra sessão anônima não acrescenta nada. Agrupa sem erro.
  if exists (select 1 from public.profiles where id = me and is_anonymous) then
    select r.id into existing
      from public.reports r join public.profiles p on p.id = r.reporter_id
     where r.target_type = p_target_type and r.target_id = target and r.status in ('OPEN', 'REVIEWING') and p.is_anonymous
     order by r.created_at desc
    offset 4 limit 1;
    if existing is not null then
      perform private.log_abuse('report_folded', target, me);
      return existing;
    end if;
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (me, p_target_type, target, p_reason, nullif(btrim(p_details), ''))
  returning id into report_id;
  return report_id;
end;
$$;

-- 6. Fotos de avistamento/encontrado: tamanho, nome, vínculo com envio. -------

update storage.buckets set file_size_limit = 2 * 1024 * 1024 where id = 'sighting-media';

-- Pode enviar mais uma foto? Até 3 arquivos da sessão ainda sem avistamento ou
-- encontrado; e, somando todas as sessões anônimas, até 60 arquivos sem envio
-- na última hora. Roda como definer: a política do Storage só enxerga a pasta
-- da própria sessão.
create or replace function private.can_upload_sighting_media()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    return false;
  end if;
  if (select count(*) from storage.objects o
       where o.bucket_id = 'sighting-media' and o.name like me::text || '/%'
         and not exists (select 1 from public.sightings s where s.photo_path = o.name)
         and not exists (select 1 from public.found_cases f where f.photo_path = o.name)) >= 3 then
    return false;
  end if;
  if exists (select 1 from public.profiles where id = me and is_anonymous)
     and (select count(*) from storage.objects o
           join public.profiles p on p.id::text = split_part(o.name, '/', 1) and p.is_anonymous
          where o.bucket_id = 'sighting-media' and o.created_at > now() - interval '1 hour'
            and not exists (select 1 from public.sightings s where s.photo_path = o.name)
            and not exists (select 1 from public.found_cases f where f.photo_path = o.name)) >= 60 then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function private.can_upload_sighting_media() from public, anon;
grant execute on function private.can_upload_sighting_media() to authenticated;

drop policy "sighting-media: sessão envia na própria pasta" on storage.objects;
create policy "sighting-media: sessão envia na própria pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sighting-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
    and (select private.can_upload_sighting_media())
  );

-- 7. Inscrições de push: guarda as 10 mais recentes por pessoa. --------------

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception 'Inscrição inválida.' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (me, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = me, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, created_at = now();
  delete from public.push_subscriptions
   where user_id = me
     and id not in (select id from public.push_subscriptions where user_id = me order by created_at desc limit 10);
end;
$$;
