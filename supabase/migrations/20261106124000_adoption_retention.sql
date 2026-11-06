-- Adoção: retenção (decisões do proprietário de 2026-11-05). Roda no mesmo
-- agendador do push (/api/push/dispatch, chave secreta), sem serviço novo.
--
--   1. Interesses em anúncios ENCERRADOS (ADOPTED, REJECTED, REMOVED) são
--      apagados 30 dias depois do encerramento (adoption_listings.closed_at).
--   2. Perfil da fila de interessados: vence em 90 dias (sai da lista pública e
--      dos avisos no vencimento) e, sem renovação, é APAGADO 30 dias depois.
--   3. Lembrete "Ainda procura?" uma vez, na última semana de validade.
-- Pedidos de exclusão continuam imediatos: cancelar o interesse
-- (withdraw_adoption_interest / withdraw_my_adoption_seeker) e excluir a conta
-- apagam na hora; esta rotina só cuida do que ficou para trás.

create or replace function public.run_adoption_retention(p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 5000);
  interests_removed integer;
  seekers_removed integer;
  reminded integer;
begin
  with doomed as (
    select i.id from public.adoption_interests i
      join public.adoption_listings a on a.id = i.listing_id
     where a.status in ('ADOPTED', 'REJECTED', 'REMOVED') and a.closed_at < now() - interval '30 days'
     limit v_limit
  )
  delete from public.adoption_interests i using doomed d where i.id = d.id;
  get diagnostics interests_removed = row_count;

  with doomed as (
    select s.id from public.adoption_seekers s where s.expires_at < now() - interval '30 days' limit v_limit
  )
  delete from public.adoption_seekers s using doomed d where s.id = d.id;
  get diagnostics seekers_removed = row_count;

  with due as (
    update public.adoption_seekers s set expiry_reminded_at = now()
     where s.id in (select x.id from public.adoption_seekers x
                     where x.status = 'APPROVED' and x.expiry_reminded_at is null
                       and x.expires_at > now() and x.expires_at < now() + interval '7 days'
                     limit v_limit)
    returning s.user_id, s.expires_at
  ),
  inserted as (
    insert into public.notifications (user_id, kind, payload)
    select d.user_id, 'adoption_seeker_expiring', jsonb_build_object('expires_at', d.expires_at) from due d
    returning id, user_id
  )
  select count(*) into reminded from inserted;

  return jsonb_build_object('interests_removed', interests_removed, 'seekers_removed', seekers_removed, 'reminded', reminded);
end;
$$;

revoke all on function public.run_adoption_retention(integer) from public, anon, authenticated;
grant execute on function public.run_adoption_retention(integer) to service_role;
