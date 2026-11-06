-- Adoção: interesse num anúncio (decisões do proprietário de 2026-11-05).
--
--   1. "Tem crianças em casa?" passa a ser OPCIONAL (null = não informado).
--   2. withdraw_adoption_interest: quem enviou cancela o próprio interesse; a
--      linha é APAGADA (não escondida) e, se a conversa ainda aceita mensagens,
--      quem doa recebe um aviso nela.
--   3. adoption_listings.closed_at: quando o anúncio foi encerrado (ADOPTED,
--      REJECTED ou REMOVED). A limpeza agendada (20261106124000) apaga os
--      interesses 30 dias depois desse momento.

-- 1. Crianças: opcional -------------------------------------------------------

alter table public.adoption_interests alter column children drop not null;

-- Mesma assinatura (o app já chama assim); p_children aceita null.
create or replace function public.submit_adoption_interest(p_code text, p_housing text, p_other_pets boolean, p_children boolean, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a public.adoption_listings;
  conv_id uuid;
  housing_label text := case p_housing when 'house' then 'casa' when 'apartment' then 'apartamento' else 'outro tipo de moradia' end;
begin
  if me is null or private.is_anonymous_session() then
    raise exception 'Entre na sua conta para enviar o interesse.' using errcode = '42501';
  end if;
  select * into a from public.adoption_listings where short_code = lower(p_code);
  if a.id is null or a.status not in ('AVAILABLE', 'IN_PROCESS') then
    raise exception 'Este anúncio não está recebendo interessados.' using errcode = '22023';
  end if;
  if a.owner_id = me then
    raise exception 'Este anúncio é seu.' using errcode = '22023';
  end if;
  if private.is_blocked_between(me, a.owner_id) or private.is_suspended(me) then
    raise exception 'Não é possível enviar interesse agora.' using errcode = '42501';
  end if;
  if (select count(*) from public.adoption_interests where user_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Você enviou muitos interesses hoje. Tente amanhã.' using errcode = 'P0429';
  end if;
  insert into public.adoption_interests (listing_id, user_id, housing, other_pets, children, message)
  values (a.id, me, p_housing, p_other_pets, p_children, btrim(p_message))
  on conflict (listing_id, user_id) do update set message = excluded.message, housing = excluded.housing,
    other_pets = excluded.other_pets, children = excluded.children;

  select id into conv_id from public.conversations where adoption_listing_id = a.id and helper_id = me;
  if conv_id is null then
    insert into public.conversations (adoption_listing_id, owner_id, helper_id, created_by)
    values (a.id, a.owner_id, me, me) returning id into conv_id;
  end if;
  insert into public.messages (conversation_id, sender_id, body)
  values (conv_id, me, left(format(E'Olá! Tenho interesse em adotar %s.\n\nMoradia: %s · Outros pets: %s · Crianças em casa: %s\n\n%s',
    a.name, housing_label, case when p_other_pets then 'sim' else 'não' end,
    case when p_children then 'sim' when not p_children then 'não' else 'não informado' end, btrim(p_message)), 2000));
  update public.conversations set helper_last_read_at = now() where id = conv_id;
  return conv_id;
end;
$$;

-- 2. Cancelar o próprio interesse ---------------------------------------------

create or replace function public.withdraw_adoption_interest(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a public.adoption_listings;
  conv_id uuid;
begin
  if me is null then
    raise exception 'Entre na sua conta para cancelar o interesse.' using errcode = '42501';
  end if;
  select * into a from public.adoption_listings where short_code = lower(p_code);
  if a.id is null then
    return false;
  end if;
  -- Só a própria linha: o filtro por user_id é a regra de posse.
  delete from public.adoption_interests where listing_id = a.id and user_id = me;
  if not found then
    return false;
  end if;
  -- Aviso na conversa, se ela ainda aceita mensagens (anúncio encerrado ou
  -- bloqueio recusam o envio, e o cancelamento vale do mesmo jeito).
  select id into conv_id from public.conversations where adoption_listing_id = a.id and helper_id = me;
  if conv_id is not null then
    begin
      insert into public.messages (conversation_id, sender_id, body)
      values (conv_id, me, format('Cancelei meu interesse em adotar %s. Obrigado pela atenção!', a.name));
    exception when others then
      null;
    end;
  end if;
  return true;
end;
$$;

revoke all on function public.withdraw_adoption_interest(text) from public, anon;
grant execute on function public.withdraw_adoption_interest(text) to authenticated;

-- 3. Momento do encerramento do anúncio -----------------------------------------

alter table public.adoption_listings add column closed_at timestamptz;

-- Roda depois de adoption_before_write (gatilhos BEFORE disparam em ordem
-- alfabética), quando o status final da gravação já está decidido.
create or replace function private.adoption_track_closed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('ADOPTED', 'REJECTED', 'REMOVED') then
    if tg_op = 'INSERT' or old.status not in ('ADOPTED', 'REJECTED', 'REMOVED') or new.closed_at is null then
      new.closed_at := coalesce(case when tg_op = 'UPDATE' and old.status in ('ADOPTED', 'REJECTED', 'REMOVED') then old.closed_at end, now());
    end if;
  else
    -- Reaberto (ex.: adotado → disponível): o prazo de retenção recomeça no próximo encerramento.
    new.closed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.adoption_track_closed() from public, anon, authenticated;

create trigger adoption_track_closed
  before insert or update on public.adoption_listings
  for each row execute function private.adoption_track_closed();

-- Encerrados antes desta migration: a última gravação é a melhor aproximação.
update public.adoption_listings set closed_at = updated_at
 where status in ('ADOPTED', 'REJECTED', 'REMOVED') and closed_at is null;

create index adoption_listings_closed_idx on public.adoption_listings (closed_at) where closed_at is not null;
