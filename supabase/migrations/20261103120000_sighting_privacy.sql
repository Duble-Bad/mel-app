-- MEL — P0 privacidade dos avistamentos (revoga "local do avistamento é público").
--
-- Antes: get_lost_case_timeline (liberada para anon) devolvia lat/lng EXATOS de
-- cada avistamento, e o caminho da foto começava pelo UUID de quem enviou —
-- um pseudônimo estável que ligava contribuições em alertas diferentes.
--
-- Agora:
--   1. sightings.public_lat/public_lng: ponto aproximado, DERIVADO no banco com a
--      mesma grade de 250 m dos alertas e encontrados (private.fuzz_lat_lng).
--      Sem grant de escrita; o trigger sempre recalcula a partir do ponto exato.
--   2. Linha do tempo: ponto exato só para o tutor do alerta, a moderação e o
--      autor (o próprio avistamento); qualquer outra pessoa — com ou sem conta —
--      recebe o ponto aproximado. Vale para ACTIVE e FOUND; CLOSED continua só
--      do tutor; REMOVED não aparece.
--   3. Fotos novas do sighting-media com nome neutro: <uuid>.(webp|jpg|png) na
--      raiz do bucket. A posse vem de storage.objects.owner_id (gravado pelo
--      Storage a partir da sessão), não do caminho. Avistamento/encontrado só
--      aceita foto que exista e seja da própria sessão.
--      Fotos antigas (<sessão>/<uuid>.ext): a linha do tempo não devolve o
--      caminho para quem não é tutor/autor/moderação; o script
--      scripts/sighting-media-neutral-names.mjs renomeia as existentes.
--   4. Cota de fotos sem envio (migration 27) passa a contar por owner_id.
--      list_orphan_sighting_media não muda (compara o nome com os envios).

-- 1. Ponto público dos avistamentos -------------------------------------------

alter table public.sightings
  add column public_lat double precision,
  add column public_lng double precision;

create or replace function private.sightings_public_point()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sempre derivado do ponto exato (nunca vem do cliente).
  select f.fuzzed_lat, f.fuzzed_lng into new.public_lat, new.public_lng
    from private.fuzz_lat_lng(new.lat, new.lng, 250) f;
  return new;
end;
$$;

create trigger sightings_public_point
  before insert or update on public.sightings
  for each row execute function private.sightings_public_point();

-- Backfill: o trigger recalcula; lat/lng não mudam.
update public.sightings set lat = lat;

alter table public.sightings
  alter column public_lat set not null,
  alter column public_lng set not null;

-- 2. Posse da foto pelo owner_id do Storage ----------------------------------

create or replace function private.owns_sighting_media(p_path text, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from storage.objects o
     where o.bucket_id = 'sighting-media' and o.name = p_path and o.owner_id = p_owner::text);
$$;

revoke all on function private.owns_sighting_media(text, uuid) from public, anon, authenticated;

create or replace function private.sightings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_row public.lost_cases;
begin
  select * into case_row from public.lost_cases where id = new.lost_case_id;
  if case_row.id is null or case_row.status <> 'ACTIVE' then
    raise exception 'Este alerta não está mais ativo.' using errcode = '22023';
  end if;
  if new.seen_at > now() + interval '5 minutes' then
    raise exception 'O horário do avistamento não pode estar no futuro.' using errcode = '22023';
  end if;
  if new.seen_at < coalesce(case_row.lost_at, case_row.created_at) - interval '1 day' then
    raise exception 'O avistamento é de antes do desaparecimento.' using errcode = '22023';
  end if;
  if new.photo_path is not null and not private.owns_sighting_media(new.photo_path, new.reporter_id) then
    raise exception 'Foto inválida.' using errcode = '42501';
  end if;
  if (select count(*) from public.sightings
       where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Você já enviou muitos avistamentos agora. Tente de novo mais tarde.' using errcode = 'P0429';
  end if;
  if (select count(*) from public.sightings
       where reporter_id = new.reporter_id and lost_case_id = new.lost_case_id
         and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Você já enviou avistamentos para este alerta agora há pouco. Obrigado!' using errcode = 'P0429';
  end if;
  new.status := 'VISIBLE';
  new.created_at := now();
  return new;
end;
$$;

create or replace function private.found_cases_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.found_at > now() + interval '5 minutes' then
    raise exception 'A data não pode estar no futuro.' using errcode = '22023';
  end if;
  if new.found_at < now() - interval '60 days' then
    raise exception 'Use uma data dos últimos 60 dias.' using errcode = '22023';
  end if;
  if new.photo_path is not null and not private.owns_sighting_media(new.photo_path, new.reporter_id) then
    raise exception 'Foto inválida.' using errcode = '42501';
  end if;
  if (select count(*) from public.found_cases
       where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Você já publicou muitos animais encontrados agora. Tente de novo mais tarde.' using errcode = 'P0429';
  end if;
  select f.fuzzed_lat, f.fuzzed_lng into new.public_lat, new.public_lng
    from private.fuzz_lat_lng(new.lat, new.lng, 250) f;
  new.status := 'ACTIVE';
  new.short_code := private.generate_found_code();
  new.created_at := now();
  new.closed_at := null;
  return new;
end;
$$;

-- 3. Storage: nome neutro, posse pelo owner_id --------------------------------

create or replace function private.can_upload_sighting_media()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    return false;
  end if;
  if (select count(*) from storage.objects o
       where o.bucket_id = 'sighting-media' and o.owner_id = me::text
         and not exists (select 1 from public.sightings s where s.photo_path = o.name)
         and not exists (select 1 from public.found_cases f where f.photo_path = o.name)) >= 3 then
    return false;
  end if;
  if exists (select 1 from public.profiles where id = me and is_anonymous)
     and (select count(*) from storage.objects o
           join public.profiles p on p.id::text = o.owner_id and p.is_anonymous
          where o.bucket_id = 'sighting-media' and o.created_at > now() - interval '1 hour'
            and not exists (select 1 from public.sightings s where s.photo_path = o.name)
            and not exists (select 1 from public.found_cases f where f.photo_path = o.name)) >= 60 then
    return false;
  end if;
  return true;
end;
$$;

drop policy "sighting-media: sessão envia na própria pasta" on storage.objects;
create policy "sighting-media: sessão envia com nome neutro"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sighting-media'
    and name ~ '^[0-9a-f-]{36}\.(webp|jpg|png)$'
    and owner_id = (select auth.uid())::text
    and (select private.can_upload_sighting_media())
  );

drop policy "sighting-media: sessão lista a própria pasta" on storage.objects;
create policy "sighting-media: sessão vê as próprias fotos"
  on storage.objects for select to authenticated
  using (bucket_id = 'sighting-media' and owner_id = (select auth.uid())::text);

-- 4. Linha do tempo: exato só para quem precisa --------------------------------

create or replace function public.get_lost_case_timeline(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'seen_at', s.seen_at,
      'lat', case when a.exact then s.lat else s.public_lat end,
      'lng', case when a.exact then s.lng else s.public_lng end,
      'point_is_exact', a.exact,
      'place_label', s.place_label,
      'direction', s.direction, 'states', s.states, 'notes', s.notes,
      -- Caminho antigo (<sessão>/…) identifica quem enviou: só para quem já sabe.
      'photo_path', case when a.exact or strpos(s.photo_path, '/') = 0 then s.photo_path end,
      'hidden', s.status = 'HIDDEN', 'mine', s.reporter_id = (select auth.uid()),
      'can_reply', c.owner_id = (select auth.uid()) and c.status in ('ACTIVE', 'FOUND')
                   and s.reporter_id is not null and s.reporter_id <> c.owner_id)
    order by s.seen_at), '[]'::jsonb)
  from public.lost_cases c
  join public.sightings s on s.lost_case_id = c.id
  cross join lateral (
    select coalesce(c.owner_id = (select auth.uid()), false)
        or coalesce(s.reporter_id = (select auth.uid()), false)
        or private.is_moderator() as exact
  ) a
  where c.short_code = lower(p_code)
    and (c.status in ('ACTIVE', 'FOUND') or (c.status = 'CLOSED' and c.owner_id = (select auth.uid())))
    -- Ocultos só aparecem para o tutor (que pode reexibir).
    and (s.status = 'VISIBLE' or c.owner_id = (select auth.uid()));
$$;

revoke all on function public.get_lost_case_timeline(text) from public;
grant execute on function public.get_lost_case_timeline(text) to anon, authenticated;
