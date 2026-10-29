-- Reencontros (total e 30 dias) vêm do mesmo histórico (eventos pet_reunited),
-- para os dois números serem coerentes entre si.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_moderator();
  return jsonb_build_object(
    'active_lost', (select count(*) from public.lost_cases where status = 'ACTIVE'),
    'reunited', (select count(*) from public.events where name = 'pet_reunited'),
    'reunited_30d', (select count(*) from public.events where name = 'pet_reunited' and created_at > now() - interval '30 days'),
    'active_found', (select count(*) from public.found_cases where status = 'ACTIVE'),
    'sightings_7d', (select count(*) from public.sightings where created_at > now() - interval '7 days'),
    'users', (select count(*) from public.profiles where not is_anonymous),
    'guardians', (select count(*) from public.guardian_settings where enabled),
    'open_reports', (select count(*) from public.reports where status in ('OPEN', 'REVIEWING'))
  );
end;
$$;
