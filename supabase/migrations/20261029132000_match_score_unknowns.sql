-- "Não sei" vale menos (relatos vagos não viram alarme). Espelho de computeMatchScore.
create or replace function private.match_score(
  l_species public.species, l_size public.pet_size, l_sex public.pet_sex, l_color text, l_colors text[], l_breed text,
  l_lat double precision, l_lng double precision, l_lost_at timestamptz,
  f_species public.species, f_size public.pet_size, f_sex public.pet_sex, f_color text, f_colors text[], f_breed text,
  f_lat double precision, f_lng double precision, f_found_at timestamptz
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  sizes constant text[] := array['mini', 'small', 'medium', 'large', 'giant'];
  -- Haversine (igual ao TypeScript, para a paridade ser exata).
  d double precision := 2 * 6371008.8 * asin(least(1, sqrt(
    sin(radians(f_lat - l_lat) / 2) ^ 2 +
    cos(radians(l_lat)) * cos(radians(f_lat)) * sin(radians(f_lng - l_lng) / 2) ^ 2)));
  days double precision := extract(epoch from (f_found_at - l_lost_at)) / 86400.0;
  score int := 0;
  r_size text; r_sex text; r_color text; r_breed text;
  diff int;
begin
  if l_species is distinct from f_species or d > 10000 or days < -1 or days > 60 then
    return null;
  end if;
  score := score + round(35 * (1 - d / 10000.0))::int;
  score := score + round(15 * greatest(0, 1 - greatest(days, 0) / 30.0))::int;

  if l_size is null or f_size is null then r_size := 'unknown'; score := score + 3;
  else
    diff := abs(array_position(sizes, l_size::text) - array_position(sizes, f_size::text));
    if diff = 0 then r_size := 'same'; score := score + 15;
    elsif diff = 1 then r_size := 'close'; score := score + 7;
    else r_size := 'different'; end if;
  end if;

  if l_sex = 'unknown' or f_sex = 'unknown' then r_sex := 'unknown'; score := score + 3;
  elsif l_sex = f_sex then r_sex := 'same'; score := score + 10;
  else r_sex := 'different'; score := score - 15; end if;

  if l_color is null or f_color is null then r_color := 'unknown'; score := score + 3;
  elsif l_color = f_color then r_color := 'same'; score := score + 15;
  elsif l_color = any(coalesce(f_colors, '{}')) or f_color = any(coalesce(l_colors, '{}')) then r_color := 'partial'; score := score + 8;
  else r_color := 'different'; end if;

  if l_breed is null or f_breed is null then r_breed := 'unknown'; score := score + 2;
  elsif lower(btrim(l_breed)) = lower(btrim(f_breed)) then r_breed := 'same'; score := score + 10;
  else r_breed := 'different'; end if;

  return jsonb_build_object(
    'score', least(100, greatest(0, score)),
    'reasons', jsonb_build_object('distance_m', round(d)::int, 'days', round(days * 10) / 10.0,
      'size', r_size, 'sex', r_sex, 'color', r_color, 'breed', r_breed));
end;
$$;

