-- Auditoria de segurança (2026-11-17), achados L3 e L4.
--
-- L3. Inscrição de push:
--   a) o endereço tinha só de começar com https://, então qualquer sessão
--      (inclusive anônima) podia fazer o servidor do MEL enviar requisições
--      a um site qualquer. Agora só os serviços oficiais de push dos
--      navegadores: Google (Chrome, Edge Android, Samsung, Opera, Brave),
--      Mozilla (Firefox), Apple (Safari) e Microsoft (Edge no Windows).
--   b) `on conflict (endpoint)` passava a inscrição de outra pessoa para quem
--      soubesse o endereço. Agora uma inscrição de outra conta só muda de dono
--      se vier com as MESMAS chaves (p256dh e auth): é o mesmo navegador
--      trocando de conta. Sem as chaves, nada muda (sem erro, para não revelar
--      se o endereço existe).
--
-- L4. `consents` mantinha os privilégios padrão de `authenticated` (UPDATE,
--     DELETE, TRUNCATE...). O RLS já bloqueava; agora o grant também fica
--     só no que o app usa (SELECT e INSERT).

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
  if p_endpoint is null
     or length(p_endpoint) > 1000
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' then
    raise exception 'Inscrição inválida.' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (me, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = me, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, created_at = now()
    where public.push_subscriptions.user_id = me
       or (public.push_subscriptions.p256dh = excluded.p256dh and public.push_subscriptions.auth = excluded.auth);
  delete from public.push_subscriptions
   where user_id = me
     and id not in (select id from public.push_subscriptions where user_id = me order by created_at desc limit 10);
end;
$$;

revoke all on public.consents from anon, authenticated;
grant select, insert on public.consents to authenticated;
