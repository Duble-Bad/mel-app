-- MEL — Enquadramento das fotos nos cartazes (pedido do proprietário, 2026-11-09).
-- O tutor escolhe o ponto da foto que deve ficar visível quando o cartaz recorta
-- (rosto, marca). null = automático (como antes). Só o dono altera (política
-- "pet_photos: dono gerencia"); o ponto é público como a própria foto.

alter table public.pet_photos
  add column focus_x smallint check (focus_x between 0 and 100),
  add column focus_y smallint check (focus_y between 0 and 100);
alter table public.pet_photos add constraint pet_photos_focus_pair
  check ((focus_x is null) = (focus_y is null));

create or replace function private.pet_public_json(p_pet_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.name, 'species', p.species, 'breed', p.breed, 'sex', p.sex, 'size', p.size,
    'color_primary', p.color_primary, 'colors_secondary', p.colors_secondary,
    'unique_marks', p.unique_marks, 'description', p.description, 'mel_id', p.mel_id,
    'birth_date', p.birth_date, 'age_estimate_months', p.age_estimate_months, 'weight_kg', p.weight_kg,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('path', ph.storage_path, 'thumb_path', ph.thumb_path, 'is_primary', ph.is_primary,
                                          'focus_x', ph.focus_x, 'focus_y', ph.focus_y)
                       order by ph.is_primary desc, ph.position)
        from public.pet_photos ph where ph.pet_id = p.id), '[]'::jsonb)
  )
  from public.pets p where p.id = p_pet_id;
$$;
