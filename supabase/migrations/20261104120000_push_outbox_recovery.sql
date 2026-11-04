-- MEL — Launch Readiness 2D: recuperação de push preso em SENDING.
--
-- Causa: claim_push_batch marca o item como SENDING e só finish_push o encerra.
-- Se o despacho cair entre os dois (timeout da função, deploy, erro ao gravar
-- o resultado), o item ficava em SENDING para sempre: nenhuma rotina olhava
-- para ele de novo e o push nunca saía.
--
-- Correção mínima:
--   - a reserva passa a ter hora (claimed_at) e contador (attempts);
--   - reserva com mais de 15 min é considerada abandonada. 15 min é maior que a
--     vida máxima de uma função na Vercel (800 s no Pro, 300 s no Hobby): um
--     despacho ainda vivo nunca perde o item para outro;
--   - abandonada com menos de 3 reservas e aviso de até 6 h (o mesmo TTL do
--     push no despachante) volta a ser reservada pelo próximo despacho;
--   - abandonada pela 3ª vez, ou aviso com mais de 6 h, vira FAILED (nunca
--     mais tentada: sem laço infinito; o aviso continua no app);
--   - SENT, SKIPPED e FAILED nunca são reabertos, e finish_push não sobrescreve
--     um item já encerrado (despacho atrasado não desfaz o resultado de outro).
--
-- Não garante entrega única: se o serviço de push aceitar a mensagem e o
-- processo cair antes do finish_push, a recuperação reenvia. Atenuado pelo
-- `tag` da notificação (= id do aviso): o aparelho substitui em vez de empilhar.
--
-- Teto por hora, intervalo de 10 min e agrupamento contam linhas da fila por
-- created_at: a recuperação não cria linhas, então não muda nenhum limite.

alter table public.push_outbox
  add column claimed_at timestamptz,
  add column attempts smallint not null default 0;

create index push_outbox_sending_idx on public.push_outbox (claimed_at) where status = 'SENDING';

-- Prazo da reserva e limites num lugar só (usados pelo claim e pelos testes).
create or replace function private.push_claim_policy(out lease interval, out max_attempts smallint, out max_age interval)
language sql
immutable
set search_path = ''
as $$ select interval '15 minutes', 3::smallint, interval '6 hours' $$;

revoke all on function private.push_claim_policy() from public, anon, authenticated;

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
  with policy as (select * from private.push_claim_policy()),
  -- Reserva abandonada sem direito a nova tentativa: encerra como FAILED (o
  -- Postgres executa um WITH que altera dados mesmo sem ser lido).
  given_up as (
    update public.push_outbox o
       set status = 'FAILED', reason = 'reserva expirou sem confirmação de envio', processed_at = now()
     where o.id in (
       select x.id from public.push_outbox x, policy p2
        where x.status = 'SENDING'
          and coalesce(x.claimed_at, x.created_at) < now() - p2.lease
          and (x.attempts >= p2.max_attempts or x.created_at < now() - p2.max_age)
        for update of x skip locked)
    returning o.id
  ),
  claimed as (
    update public.push_outbox o
       set status = 'SENDING', claimed_at = now(), attempts = o.attempts + 1
     where o.id in (
       select x.id from public.push_outbox x, policy p
        where x.status = 'PENDING'
           or (x.status = 'SENDING'
               and coalesce(x.claimed_at, x.created_at) < now() - p.lease
               and x.attempts < p.max_attempts
               and x.created_at >= now() - p.max_age)
        order by x.created_at limit least(greatest(p_limit, 1), 200)
        for update of x skip locked)
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

-- Só encerra o que ainda está em SENDING: um despacho atrasado (reserva já
-- expirada e retomada por outro) não sobrescreve SENT/FAILED/SKIPPED.
create or replace function public.finish_push(p_outbox_id bigint, p_status text, p_reason text default null, p_dead_subscriptions uuid[] default '{}', p_ok_subscriptions uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_outbox set status = p_status, reason = left(p_reason, 200), processed_at = now()
   where id = p_outbox_id and status = 'SENDING';
  delete from public.push_subscriptions where id = any(p_dead_subscriptions);
  update public.push_subscriptions set last_success_at = now() where id = any(p_ok_subscriptions);
end;
$$;

revoke all on function public.claim_push_batch(integer), public.finish_push(bigint, text, text, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer), public.finish_push(bigint, text, text, uuid[], uuid[]) to service_role;
