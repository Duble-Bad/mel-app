-- MEL — Foto dos casos no mapa, mural e listas (proprietário, 2026-11-13).
-- search_public_cases passa a devolver, além da miniatura (photo_path), a foto em tamanho normal
-- (photo_full_path, para a gaveta do mapa) e o ponto de foco que o tutor ajustou no cartaz
-- (focus_x/focus_y, 0–100, para o recorte das fotos em pé não cortar o rosto). A capa é escolhida
-- uma vez por caso (lateral). Encontrados/vistos têm uma foto só e não têm foco (null).
-- Resto idêntico à migration 49: só pontos APROXIMADOS, mesmos filtros, "toda a rede" (raio <= 0),
-- mesma paginação e os mesmos grants.

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
           cover.thumb_path as photo_path,
           cover.storage_path as photo_full_path,
           cover.focus_x, cover.focus_y,
           'pet-photos'::text as photo_bucket,
           c.public_area_label as area_label, c.lost_at as at, c.public_lat as lat, c.public_lng as lng,
           round(extensions.st_distance(c.public_point, o.g))::int as distance_m
      from public.lost_cases c
      join public.pets p on p.id = c.pet_id
      cross join origin o
      left join lateral (
        select ph.thumb_path, ph.storage_path, ph.focus_x, ph.focus_y
          from public.pet_photos ph
         where ph.pet_id = p.id
         order by ph.is_primary desc, ph.position
         limit 1
      ) cover on true
     where c.status = 'ACTIVE' and 'lost' = any(p_kinds)
       and c.public_point is not null
       and (o.r is null or extensions.st_dwithin(c.public_point, o.g, o.r))
       and (p_species is null or p.species = any(p_species))
       and (p_since is null or c.lost_at >= p_since)
    union all
    select case when f.custody = 'street' then 'sighting' else 'found' end, f.short_code, null, f.species, f.breed_guess, f.size, f.color_primary,
           f.photo_path, f.photo_path, null::smallint, null::smallint, 'sighting-media',
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
