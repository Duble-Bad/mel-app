-- is_owner era null para visitantes sem sessão (auth.uid() nulo); agora é false.
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
    'lost_at', c.lost_at,
    'lost_at_uncertain', c.lost_at_uncertain,
    'published_at', c.published_at,
    'found_at', c.found_at,
    'public_lat', c.public_lat,
    'public_lng', c.public_lng,
    'public_point_exact', c.public_point_exact,
    'area_label', c.public_area_label,
    'city', c.city,
    'state', c.state,
    'wearing', c.wearing,
    'notes', c.notes,
    'contact_chat', c.contact_chat,
    'contact_whatsapp', case when c.contact_whatsapp_public then c.contact_phone end,
    'contact_phone', case when c.contact_phone_public then c.contact_phone end,
    'indexable', c.indexable,
    'is_owner', coalesce(c.owner_id = (select auth.uid()), false),
    'pet', private.pet_public_json(c.pet_id)
  )
  from public.lost_cases c
  where c.short_code = lower(p_code) and c.status in ('ACTIVE', 'FOUND');
$$;

