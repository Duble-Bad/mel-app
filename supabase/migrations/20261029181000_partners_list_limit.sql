-- O limite precisa valer para as empresas, não para a linha agregada.
create or replace function public.list_businesses(
  p_lat double precision, p_lng double precision, p_radius_m integer default 10000,
  p_categories public.business_category[] default null, p_limit integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with o as (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g),
  picked as (
    select b.*, extensions.st_distance(b.point, o.g) as d
      from public.businesses b, o
     where b.status = 'APPROVED'
       and extensions.st_dwithin(b.point, o.g, least(greatest(coalesce(p_radius_m, 10000), 500), 50000))
       and (p_categories is null or b.category = any(p_categories))
     order by d
     limit least(greatest(p_limit, 1), 100)
  )
  select coalesce(jsonb_agg(private.business_json(row(p.id, p.short_code, p.owner_id, p.status, p.name, p.category, p.description,
      p.address_label, p.lat, p.lng, p.point, p.phone, p.whatsapp, p.website, p.instagram, p.hours, p.helps_lost, p.logo_path,
      p.plan_code, p.review_note, p.approved_at, p.created_at, p.updated_at)::public.businesses, o.g) order by p.d), '[]'::jsonb)
    from picked p, o;
$$;
