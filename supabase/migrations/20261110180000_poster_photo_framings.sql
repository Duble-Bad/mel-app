-- MEL — Enquadramento de cada foto do cartaz salvo (autorizado pelo proprietário, 2026-11-10).
-- Antes só a foto principal tinha enquadramento (focus_x/focus_y/zoom). Agora cada foto
-- escolhida (a principal e as complementares) pode ter o seu: ponto central e tamanho.
-- O tamanho pode ser menor que o espaço do cartaz (zoom < 1: a foto inteira cabe e a sobra
-- fica com o fundo do cartaz). As colunas antigas continuam com o da principal.

-- Uma posição por foto, na mesma ordem de photo_ids: {"x": 0–100, "y": 0–100, "zoom": 0.2–3} ou null.
alter table public.poster_designs
  add column framings jsonb,
  add constraint poster_designs_framings_shape check (
    framings is null or (jsonb_typeof(framings) = 'array' and jsonb_array_length(framings) <= 6)
  );

comment on column public.poster_designs.framings is
  'Enquadramento por foto, na ordem de photo_ids: {x, y, zoom} (x/y 0–100, zoom 0.2–3) ou null (padrão do modelo).';

-- A principal também pode ficar menor que o espaço.
alter table public.poster_designs drop constraint poster_designs_zoom_check;
alter table public.poster_designs add constraint poster_designs_zoom_check check (zoom between 0.2 and 3);

-- Confere um enquadramento: objeto com x, y (0–100) e zoom (0,2–3), ou null.
create or replace function private.poster_framing_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or jsonb_typeof(p) = 'null' or (
    jsonb_typeof(p) = 'object'
    and jsonb_typeof(p -> 'x') = 'number' and (p ->> 'x')::numeric between 0 and 100
    and jsonb_typeof(p -> 'y') = 'number' and (p ->> 'y')::numeric between 0 and 100
    and jsonb_typeof(p -> 'zoom') = 'number' and (p ->> 'zoom')::numeric between 0.2 and 3
  );
$$;

-- A assinatura muda (novo parâmetro): a anterior sai para não haver duas versões.
drop function public.save_poster_design(text, text, smallint, uuid[], smallint, smallint, numeric);

-- Grava (ou substitui) o cartaz de um formato. Só o tutor, só com o alerta ativo, só fotos do pet.
create function public.save_poster_design(
  p_code text,
  p_format text,
  p_model smallint,
  p_photo_ids uuid[],
  p_focus_x smallint default null,
  p_focus_y smallint default null,
  p_zoom numeric default null,
  p_framings jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.lost_cases;
  v_owned int;
  v_item jsonb;
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
  if p_framings is not null then
    if jsonb_typeof(p_framings) <> 'array' or jsonb_array_length(p_framings) <> cardinality(p_photo_ids) then
      raise exception 'Enquadramento inválido.' using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(p_framings) loop
      if not private.poster_framing_valid(v_item) then
        raise exception 'Enquadramento inválido.' using errcode = '22023';
      end if;
    end loop;
  end if;

  insert into public.poster_designs as d (lost_case_id, format, model, photo_ids, focus_x, focus_y, zoom, framings, updated_at)
  values (v_case.id, p_format, p_model, p_photo_ids, p_focus_x, p_focus_y, p_zoom, p_framings, now())
  on conflict (lost_case_id, format) do update
    set model = excluded.model, photo_ids = excluded.photo_ids, focus_x = excluded.focus_x,
        focus_y = excluded.focus_y, zoom = excluded.zoom, framings = excluded.framings, updated_at = now();
end;
$$;

-- O retorno muda (nova coluna): recria a leitura.
drop function public.get_poster_designs(text);

-- Cartazes salvos de um alerta publicado (o mesmo que a página pública já mostra; encerrado: nada).
create function public.get_poster_designs(p_code text)
returns table (format text, model smallint, photo_ids uuid[], focus_x smallint, focus_y smallint, zoom numeric, framings jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.format, d.model, d.photo_ids, d.focus_x, d.focus_y, d.zoom, d.framings, d.updated_at
    from public.poster_designs d
    join public.lost_cases c on c.id = d.lost_case_id
   where c.short_code = lower(p_code)
     and c.status in ('ACTIVE', 'FOUND');
$$;

revoke all on function private.poster_framing_valid(jsonb) from public, anon, authenticated;
revoke all on function public.save_poster_design(text, text, smallint, uuid[], smallint, smallint, numeric, jsonb) from public, anon;
grant execute on function public.save_poster_design(text, text, smallint, uuid[], smallint, smallint, numeric, jsonb) to authenticated;
grant execute on function public.get_poster_designs(text) to anon, authenticated;
