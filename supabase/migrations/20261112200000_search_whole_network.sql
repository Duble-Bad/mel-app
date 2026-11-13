-- MEL — "Toda a rede" no mapa e no mural (pedido do proprietário, 2026-11-12).
-- p_radius_m <= 0 = sem limite de distância (continua ordenado pelo mais perto). Com raio
-- informado, o limite segue o mesmo: 500 m a 50 km. Nada mais muda: só pontos APROXIMADOS
-- (public_*), mesmos filtros, mesma paginação e os mesmos grants.

create or replace function public.search_public_cases(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 5000,
  p_kinds text[] default array['lost', 'found', 'sighting'],
  p_species public.species[] default null,
  p_since timestamptz default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g,
           case when coalesce(p_radius_m, 5000) <= 0 then null
                else least(greatest(coalesce(p_radius_m, 5000), 500), 50000) end as r
  ),
  items as (
    select 'lost'::text as kind, c.short_code as code, p.name as title, p.species, p.breed, p.size, p.color_primary,
           (select ph.thumb_path from public.pet_photos ph where ph.pet_id = p.id order by ph.is_primary desc, ph.position limit 1) as photo_path,
           'pet-photos'::text as photo_bucket,
           c.public_area_label as area_label, c.lost_at as at, c.public_lat as lat, c.public_lng as lng,
           round(extensions.st_distance(c.public_point, o.g))::int as distance_m
      from public.lost_cases c join public.pets p on p.id = c.pet_id, origin o
     where c.status = 'ACTIVE' and 'lost' = any(p_kinds)
       and c.public_point is not null
       and (o.r is null or extensions.st_dwithin(c.public_point, o.g, o.r))
       and (p_species is null or p.species = any(p_species))
       and (p_since is null or c.lost_at >= p_since)
    union all
    select case when f.custody = 'street' then 'sighting' else 'found' end, f.short_code, null, f.species, f.breed_guess, f.size, f.color_primary,
           f.photo_path, 'sighting-media',
           f.public_area_label, f.found_at, f.public_lat, f.public_lng,
           round(extensions.st_distance(f.public_point, o.g))::int
      from public.found_cases f, origin o
     where f.status = 'ACTIVE'
       and (case when f.custody = 'street' then 'sighting' else 'found' end) = any(p_kinds)
       and f.public_point is not null
       and (o.r is null or extensions.st_dwithin(f.public_point, o.g, o.r))
       and (p_species is null or f.species = any(p_species))
       and (p_since is null or f.found_at >= p_since)
  )
  select jsonb_build_object(
    'total', (select count(*) from items),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.distance_m, i.at desc)
        from (select * from items order by distance_m, at desc
              limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) i
    ), '[]'::jsonb));
$$;

revoke all on function public.search_public_cases(double precision, double precision, integer, text[], public.species[], timestamptz, integer, integer) from public;
grant execute on function public.search_public_cases(double precision, double precision, integer, text[], public.species[], timestamptz, integer, integer) to anon, authenticated;

create or replace function public.search_adoptions_on_map(
  p_lat double precision, p_lng double precision, p_radius_m integer default 5000,
  p_species public.species[] default null, p_limit integer default 60
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g,
           case when coalesce(p_radius_m, 5000) <= 0 then null
                else least(greatest(coalesce(p_radius_m, 5000), 500), 50000) end as r
  ),
  picked as (
    select a.*, extensions.st_distance(extensions.st_setsrid(extensions.st_makepoint(a.public_lng, a.public_lat), 4326)::extensions.geography, o.g) as d
      from public.adoption_listings a, o
     where private.setting_on('show_adoption_on_map')
       and a.status = 'AVAILABLE'
       and a.public_lat is not null and a.public_lng is not null
       and (o.r is null or extensions.st_dwithin(extensions.st_setsrid(extensions.st_makepoint(a.public_lng, a.public_lat), 4326)::extensions.geography, o.g, o.r))
       and (p_species is null or a.species = any(p_species))
     order by d
     limit least(greatest(coalesce(p_limit, 60), 1), 100)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.short_code, 'name', p.name, 'species', p.species, 'size', p.size, 'sex', p.sex, 'age_months', p.age_months,
      'area_label', p.public_area_label, 'photo_path', p.photo_paths[1], 'published_at', p.published_at,
      -- Ponto público aproximado do anúncio (célula de 100 m), o mesmo critério dos casos.
      'lat', p.public_lat, 'lng', p.public_lng, 'distance_m', round(p.d)::int,
      'institution', private.adoption_institution(p.owner_id)) order by p.d), '[]'::jsonb)
    from picked p;
$$;
revoke all on function public.search_adoptions_on_map(double precision, double precision, integer, public.species[], integer) from public;
grant execute on function public.search_adoptions_on_map(double precision, double precision, integer, public.species[], integer) to anon, authenticated;
