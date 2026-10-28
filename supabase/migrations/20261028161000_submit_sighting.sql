-- Quem envia um avistamento não lê lost_cases (RLS). submit_sighting resolve o
-- código público do alerta e grava COM AS PERMISSÕES DE QUEM ENVIA (security
-- invoker): RLS, trigger de regras e limite de envios continuam valendo.

create or replace function private.active_lost_case_id(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.lost_cases where short_code = lower(p_code) and status = 'ACTIVE';
$$;

revoke all on function private.active_lost_case_id(text) from public, anon;
grant execute on function private.active_lost_case_id(text) to authenticated;

create or replace function public.submit_sighting(
  p_code text,
  p_lat double precision,
  p_lng double precision,
  p_seen_at timestamptz,
  p_direction public.sighting_direction default 'unknown',
  p_states public.sighting_state[] default '{}',
  p_place_label text default null,
  p_notes text default null,
  p_photo_path text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  case_id uuid := private.active_lost_case_id(p_code);
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  if case_id is null then
    raise exception 'Este alerta não está mais ativo.' using errcode = '22023';
  end if;
  insert into public.sightings (lost_case_id, reporter_id, lat, lng, place_label, seen_at, direction, states, notes, photo_path)
  values (case_id, (select auth.uid()), p_lat, p_lng, p_place_label, p_seen_at, p_direction, p_states, p_notes, p_photo_path)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.submit_sighting(text, double precision, double precision, timestamptz, public.sighting_direction, public.sighting_state[], text, text, text) from public, anon;
grant execute on function public.submit_sighting(text, double precision, double precision, timestamptz, public.sighting_direction, public.sighting_state[], text, text, text) to authenticated;
