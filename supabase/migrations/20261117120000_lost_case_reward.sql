-- Bonificação opcional oferecida pelo tutor a quem encontrar o pet (decisão do proprietário,
-- 2026-11-17; itens 8 e 8a de docs/decisoes-pendentes.md).
-- A MEL só exibe o valor: não intermedeia pagamento nem garante a bonificação.
-- Valor em centavos, de R$ 0,01 a R$ 100.000,00 (o mesmo limite de parseRewardBRL); null = sem bonificação.
-- Só o tutor grava (RLS de update do alerta, já restrita ao dono); o público só vê com o alerta ATIVO.

alter table public.lost_cases
  add column reward_cents integer
    constraint lost_cases_reward_cents_check check (reward_cents is null or reward_cents between 1 and 10000000);

comment on column public.lost_cases.reward_cents is
  'Bonificação oferecida pelo tutor, em centavos (null = nenhuma). Pública só com o alerta ACTIVE.';

grant update (reward_cents) on public.lost_cases to authenticated;

-- Página pública: mesma definição da migration 20261030140000, com a bonificação.
create or replace function public.get_public_lost_case(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', c.short_code,
    'status', c.status,
    'lost_at', case when c.status <> 'CLOSED' then c.lost_at end,
    'lost_at_uncertain', c.lost_at_uncertain,
    'published_at', c.published_at,
    'closed_at', c.closed_at,
    'found_at', c.found_at,
    'found_how', c.found_how,
    'found_area_label', c.found_area_label,
    'reunion_story', c.reunion_story,
    'helpful_sighting_id', c.helpful_sighting_id,
    'helpers_count', case when c.status = 'FOUND' then (select count(*) from private.lost_case_helpers(c.id)) end,
    'public_lat', case when c.status <> 'CLOSED' then c.public_lat end,
    'public_lng', case when c.status <> 'CLOSED' then c.public_lng end,
    'public_point_exact', c.public_point_exact,
    'area_label', case when c.status <> 'CLOSED' then c.public_area_label end,
    'city', case when c.status <> 'CLOSED' then c.city end,
    'state', case when c.status <> 'CLOSED' then c.state end,
    'wearing', case when c.status <> 'CLOSED' then c.wearing end,
    'notes', case when c.status <> 'CLOSED' then c.notes end,
    'contact_chat', c.contact_chat and c.status <> 'CLOSED',
    'contact_whatsapp', case when c.contact_whatsapp_public and c.status <> 'CLOSED' then c.contact_phone end,
    'contact_phone', case when c.contact_phone_public and c.status <> 'CLOSED' then c.contact_phone end,
    'indexable', c.indexable and c.status <> 'CLOSED',
    -- Bonificação oferecida pelo tutor: só com o alerta ativo (reencontrado ou encerrado não mostra oferta).
    'reward_cents', case when c.status = 'ACTIVE' then c.reward_cents end,
    'is_owner', coalesce(c.owner_id = (select auth.uid()), false),
    'pet', private.pet_public_json(c.pet_id)
  )
  from public.lost_cases c
  where c.short_code = lower(p_code) and c.status in ('ACTIVE', 'FOUND', 'CLOSED');
$$;
