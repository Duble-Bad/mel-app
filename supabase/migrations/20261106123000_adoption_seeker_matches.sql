-- Adoção: aviso de animal compatível (decisões do proprietário de 2026-11-05).
--
-- Quando um anúncio passa a AVAILABLE (aprovado pela moderação), avisa quem
-- está na fila de interessados e:
--   * foi APROVADO pela moderação, está dentro da validade e com avisos ligados;
--   * combina em espécie, porte e faixa de idade (lista vazia = tanto faz;
--     porte/idade não informados no anúncio não excluem ninguém);
--   * mora dentro do próprio raio, medido entre pontos APROXIMADOS (área
--     do interessado na grade de 100 m e ponto público do anúncio) — nunca
--     endereços nem o ponto exato do anúncio;
--   * recebeu menos de 3 avisos de adoção nas últimas 24 h.
-- Um aviso por pessoa e anúncio (índice único). Reaproveita notifications e
-- private.queue_push (que já tem o teto por hora de push). Sem serviço novo.
-- Também cria o tipo do lembrete "Ainda procura?" (enviado pela limpeza
-- agendada, migration 20261106124000).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('sighting_new', 'message_new', 'reunion_thanks', 'match_new', 'guardian_alert', 'guardian_resolved',
                  'adoption_match', 'adoption_seeker_expiring'));

-- Um aviso de compatível por pessoa e anúncio.
create unique index notifications_adoption_match_once_idx
  on public.notifications (user_id, (payload ->> 'listing_id')) where kind = 'adoption_match';

-- Faixa de idade do anúncio: filhote (< 1 ano), adulto (1 a 7 anos), idoso (8+).
create or replace function private.adoption_age_band(p_months smallint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_months is null then null when p_months < 12 then 'puppy' when p_months < 96 then 'adult' else 'senior' end;
$$;

revoke all on function private.adoption_age_band(smallint) from public, anon, authenticated;

create or replace function private.notify_adoption_seekers(p_listing uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.adoption_listings;
  v_point extensions.geography;
  v_band text;
  r record;
  n integer := 0;
begin
  select * into a from public.adoption_listings where id = p_listing;
  if a.id is null or a.status <> 'AVAILABLE' or a.public_lat is null or a.public_lng is null then
    return 0;
  end if;
  v_point := extensions.st_setsrid(extensions.st_makepoint(a.public_lng, a.public_lat), 4326)::extensions.geography;
  v_band := private.adoption_age_band(a.age_months);

  for r in
    insert into public.notifications (user_id, kind, payload)
    select s.user_id, 'adoption_match', jsonb_build_object(
             'listing_id', a.id, 'code', a.short_code, 'pet_name', a.name, 'species', a.species, 'area_label', a.public_area_label)
      from public.adoption_seekers s
      join public.profiles pr on pr.id = s.user_id
     where s.status = 'APPROVED' and s.notify and s.expires_at > now()
       and pr.suspended_at is null
       and s.user_id <> a.owner_id
       and not private.is_blocked_between(s.user_id, a.owner_id)
       and (s.species = 'any' or s.species = a.species::text)
       and (cardinality(s.sizes) = 0 or a.size is null or a.size = any (s.sizes))
       and (cardinality(s.ages) = 0 or v_band is null or v_band = any (s.ages))
       and extensions.st_dwithin(s.area_point, v_point, s.radius_m)
       and (select count(*) from public.notifications nn
             where nn.user_id = s.user_id and nn.kind = 'adoption_match' and nn.created_at > now() - interval '1 day') < 3
     order by extensions.st_distance(s.area_point, v_point)
     limit 500
    on conflict (user_id, (payload ->> 'listing_id')) where kind = 'adoption_match' do nothing
    returning id, user_id
  loop
    perform private.queue_push(r.id, r.user_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function private.notify_adoption_seekers(uuid) from public, anon, authenticated;

create or replace function private.adoption_after_available()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_adoption_seekers(new.id);
  return null;
end;
$$;

revoke all on function private.adoption_after_available() from public, anon, authenticated;

-- Só na passagem para AVAILABLE (aprovação, ou volta de "em processo"); o índice único evita repetir.
create trigger adoption_after_available
  after update of status on public.adoption_listings
  for each row
  when (new.status = 'AVAILABLE' and old.status is distinct from 'AVAILABLE')
  execute function private.adoption_after_available();
