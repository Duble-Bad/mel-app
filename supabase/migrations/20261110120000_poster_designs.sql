-- MEL — Cartaz salvo na conta do tutor (decisão do proprietário, 2026-11-10).
-- No fluxo "Criar cartaz" o tutor escolhe, por formato, o modelo (1–4), as fotos (a
-- principal primeiro) e o enquadramento da principal. Um registro por alerta e formato.
-- Escrita só pelas funções abaixo (o tutor do alerta ATIVO, com fotos do próprio pet);
-- leitura por qualquer pessoa: são só escolhas de layout sobre fotos já públicas.

create table public.poster_designs (
  lost_case_id  uuid not null references public.lost_cases (id) on delete cascade,
  format        text not null check (format in ('impressao', 'square', 'portrait', 'story', 'landscape')),
  model         smallint not null check (model between 1 and 4),
  photo_ids     uuid[] not null default '{}' check (cardinality(photo_ids) <= 6),
  focus_x       smallint check (focus_x between 0 and 100),
  focus_y       smallint check (focus_y between 0 and 100),
  zoom          numeric(3, 2) check (zoom between 1 and 3),
  updated_at    timestamptz not null default now(),
  primary key (lost_case_id, format),
  -- Enquadramento é tudo ou nada (ponto + aproximação).
  constraint poster_designs_framing_all_or_none check (
    (focus_x is null) = (focus_y is null) and (focus_x is null) = (zoom is null)
  )
);

comment on table public.poster_designs is
  'Cartaz escolhido pelo tutor no fluxo "Criar cartaz" (por alerta e formato). Escrita só via save_poster_design/reset_poster_design.';

-- Sem políticas: nenhum acesso direto pela API (só pelas funções security definer).
alter table public.poster_designs enable row level security;
revoke all on public.poster_designs from anon, authenticated;

-- Ids das fotos no JSON público do pet (o cartaz salvo guarda as fotos por id, não pela posição).
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
      select jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.storage_path, 'thumb_path', ph.thumb_path, 'is_primary', ph.is_primary,
                                          'focus_x', ph.focus_x, 'focus_y', ph.focus_y)
                       order by ph.is_primary desc, ph.position)
        from public.pet_photos ph where ph.pet_id = p.id), '[]'::jsonb)
  )
  from public.pets p where p.id = p_pet_id;
$$;

-- Grava (ou substitui) o cartaz de um formato. Só o tutor, só com o alerta ativo, só fotos do pet.
create or replace function public.save_poster_design(
  p_code text,
  p_format text,
  p_model smallint,
  p_photo_ids uuid[],
  p_focus_x smallint default null,
  p_focus_y smallint default null,
  p_zoom numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.lost_cases;
  v_owned int;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para salvar o cartaz.' using errcode = '42501';
  end if;
  select * into v_case from public.lost_cases where short_code = lower(p_code);
  if v_case.id is null or v_case.owner_id <> auth.uid() then
    raise exception 'Só o tutor do alerta pode salvar o cartaz.' using errcode = '42501';
  end if;
  if v_case.status <> 'ACTIVE' then
    raise exception 'O cartaz só pode ser salvo com o alerta ativo.' using errcode = '22023';
  end if;
  p_photo_ids := coalesce(p_photo_ids, '{}');
  if cardinality(p_photo_ids) <> cardinality(array(select distinct unnest(p_photo_ids))) then
    raise exception 'Foto repetida no cartaz.' using errcode = '22023';
  end if;
  select count(*) into v_owned from public.pet_photos where pet_id = v_case.pet_id and id = any (p_photo_ids);
  if v_owned <> cardinality(p_photo_ids) then
    raise exception 'Use só fotos deste pet.' using errcode = '22023';
  end if;

  insert into public.poster_designs as d (lost_case_id, format, model, photo_ids, focus_x, focus_y, zoom, updated_at)
  values (v_case.id, p_format, p_model, p_photo_ids, p_focus_x, p_focus_y, p_zoom, now())
  on conflict (lost_case_id, format) do update
    set model = excluded.model, photo_ids = excluded.photo_ids, focus_x = excluded.focus_x,
        focus_y = excluded.focus_y, zoom = excluded.zoom, updated_at = now();
end;
$$;

-- Volta o formato ao padrão (apaga o que foi salvo). Mesmas regras de quem pode.
create or replace function public.reset_poster_design(p_code text, p_format text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.lost_cases;
begin
  select * into v_case from public.lost_cases where short_code = lower(p_code);
  if auth.uid() is null or v_case.id is null or v_case.owner_id <> auth.uid() then
    raise exception 'Só o tutor do alerta pode alterar o cartaz salvo.' using errcode = '42501';
  end if;
  delete from public.poster_designs where lost_case_id = v_case.id and format = p_format;
end;
$$;

-- Cartazes salvos de um alerta publicado (o mesmo que a página pública já mostra; encerrado: nada).
create or replace function public.get_poster_designs(p_code text)
returns table (format text, model smallint, photo_ids uuid[], focus_x smallint, focus_y smallint, zoom numeric, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.format, d.model, d.photo_ids, d.focus_x, d.focus_y, d.zoom, d.updated_at
    from public.poster_designs d
    join public.lost_cases c on c.id = d.lost_case_id
   where c.short_code = lower(p_code)
     and c.status in ('ACTIVE', 'FOUND');
$$;

revoke all on function public.save_poster_design(text, text, smallint, uuid[], smallint, smallint, numeric) from public, anon;
revoke all on function public.reset_poster_design(text, text) from public, anon;
grant execute on function public.save_poster_design(text, text, smallint, uuid[], smallint, smallint, numeric) to authenticated;
grant execute on function public.reset_poster_design(text, text) to authenticated;
grant execute on function public.get_poster_designs(text) to anon, authenticated;
