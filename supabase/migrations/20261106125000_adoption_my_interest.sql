-- Adoção: o anúncio diz a quem está vendo se ELE já enviou interesse
-- ('my_interest'), para a tela oferecer "Cancelar meu interesse"
-- (withdraw_adoption_interest, migration 20261106121000). Só a própria pessoa:
-- visitante e outros usuários recebem false; quem doa continua vendo apenas a
-- contagem dos interessados do próprio anúncio.

create or replace function private.adoption_json(a public.adoption_listings)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', a.short_code, 'status', a.status, 'name', a.name, 'species', a.species, 'sex', a.sex, 'size', a.size,
    'age_months', a.age_months, 'breed', a.breed, 'color_primary', a.color_primary, 'temperament', a.temperament,
    'neutered', a.neutered, 'vaccinated', a.vaccinated, 'dewormed', a.dewormed, 'description', a.description,
    'requirements', a.requirements, 'area_label', a.public_area_label, 'photo_paths', a.photo_paths,
    'published_at', a.published_at, 'created_at', a.created_at,
    'is_owner', coalesce(a.owner_id = (select auth.uid()), false),
    'review_note', case when a.owner_id = (select auth.uid()) or private.is_moderator() then a.review_note end,
    'interests', case when a.owner_id = (select auth.uid()) then (select count(*) from public.adoption_interests i where i.listing_id = a.id) end,
    'my_interest', coalesce((select auth.uid()) is not null
                            and exists (select 1 from public.adoption_interests i where i.listing_id = a.id and i.user_id = (select auth.uid())), false));
$$;

revoke all on function private.adoption_json(public.adoption_listings) from public, anon, authenticated;
