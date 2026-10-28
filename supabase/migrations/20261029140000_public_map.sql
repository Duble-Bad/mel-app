-- MEL — Milestone 11: mapa/radar público e listas com filtros.
-- Só pontos APROXIMADOS (public_*), nunca o ponto exato. Leitura por função.

alter table public.found_cases
  add column public_point extensions.geography(Point, 4326) generated always as (
    case when public_lat is not null and public_lng is not null
      then extensions.st_setsrid(extensions.st_makepoint(public_lng, public_lat), 4326)::extensions.geography
    end) stored;

create index found_cases_active_public_point_idx on public.found_cases using gist (public_point) where status = 'ACTIVE';

-- kinds: 'lost' (alerta ativo), 'found' (encontrado, sob cuidado), 'sighting' (visto solto na rua).
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
           least(greatest(coalesce(p_radius_m, 5000), 500), 50000) as r
  ),
  items as (
    select 'lost'::text as kind, c.short_code as code, p.name as title, p.species, p.breed, p.size, p.color_primary,
           (select ph.thumb_path from public.pet_photos ph where ph.pet_id = p.id order by ph.is_primary desc, ph.position limit 1) as photo_path,
           'pet-photos'::text as photo_bucket,
           c.public_area_label as area_label, c.lost_at as at, c.public_lat as lat, c.public_lng as lng,
           round(extensions.st_distance(c.public_point, o.g))::int as distance_m
      from public.lost_cases c join public.pets p on p.id = c.pet_id, origin o
     where c.status = 'ACTIVE' and 'lost' = any(p_kinds)
       and extensions.st_dwithin(c.public_point, o.g, o.r)
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
       and extensions.st_dwithin(f.public_point, o.g, o.r)
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
