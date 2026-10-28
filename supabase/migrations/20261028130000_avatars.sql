-- MEL — Milestone 2: fotos de perfil
-- Bucket público (as fotos aparecem em perfis e conversas), escrita só na
-- própria pasta `<user_id>/…` e só por contas reais (não anônimas).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2 * 1024 * 1024, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sessão anônima? (avistamentos sem cadastro usam sessão anônima)
create or replace function private.is_anonymous_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

revoke all on function private.is_anonymous_session() from public, anon;
grant execute on function private.is_anonymous_session() to authenticated;

create policy "avatars: dono envia na própria pasta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select private.is_anonymous_session())
  );

create policy "avatars: dono substitui na própria pasta"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select private.is_anonymous_session())
  );

create policy "avatars: dono remove da própria pasta"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- upsert exige SELECT na linha existente; leitura pública já é feita pela URL pública.
create policy "avatars: dono lista a própria pasta"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
