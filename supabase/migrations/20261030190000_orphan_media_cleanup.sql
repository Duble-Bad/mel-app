-- Limpeza de fotos órfãs do sighting-media (complemento do anti-abuso, migration 27).
--
-- A 27 limita QUANTAS fotos sem envio cada sessão e o conjunto das anônimas
-- podem ter; sem limpeza, porém, o acúmulo ao longo dos dias não tem teto.
-- Arquivo não se apaga por SQL (o Storage guarda o binário fora do banco):
-- esta função só LISTA as órfãs antigas; o servidor do app apaga pelo Storage
-- API com a chave secreta, no mesmo agendador do push.
--
-- Órfã = foto em sighting-media, com mais de 24 h, que nenhum avistamento nem
-- encontrado usa. As 24 h cobrem quem subiu a foto e ainda vai enviar.

create or replace function public.list_orphan_sighting_media(p_limit integer default 100, p_min_age interval default interval '24 hours')
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'sighting-media'
     and o.created_at < now() - coalesce(p_min_age, interval '24 hours')
     and not exists (select 1 from public.sightings s where s.photo_path = o.name)
     and not exists (select 1 from public.found_cases f where f.photo_path = o.name)
   order by o.created_at
   limit least(greatest(coalesce(p_limit, 100), 1), 1000);
$$;

revoke all on function public.list_orphan_sighting_media(integer, interval) from public, anon, authenticated;
grant execute on function public.list_orphan_sighting_media(integer, interval) to service_role;
