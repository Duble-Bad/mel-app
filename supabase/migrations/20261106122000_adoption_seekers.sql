-- Adoção: fila de interessados SEM animal específico (decisões do proprietário de 2026-11-05).
--
-- Um perfil por pessoa (conta real): preferências, área APROXIMADA (grade de
-- 100 m; o ponto exato nunca é guardado), moradia, rotina e, opcionalmente,
-- um WhatsApp PRIVADO.
--   * Moderação: todo perfil novo ou editado fica PENDING_REVIEW até a
--     moderação aprovar (APPROVED) ou recusar com motivo (REJECTED), com
--     registro em moderation_actions.
--   * Privacidade: a tabela só é lida pelo dono e pela moderação (RLS). O
--     WhatsApp nunca sai por nenhuma função pública; só o dono e a moderação o
--     veem. A lista pública "Querem adotar" é opt-in e devolve só o primeiro
--     nome, o rótulo de bairro/cidade e as preferências.
--   * Validade: 90 dias, com "Renovar". Cancelar APAGA a linha.
--   * Escrita só pelas funções (nada de insert/update direto na tabela).

create table public.adoption_seekers (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references public.profiles (id) on delete cascade,
  status             text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  -- Preferências ('any' / lista vazia = tanto faz).
  species            text not null check (species in ('dog', 'cat', 'any')),
  sizes              public.pet_size[] not null default '{}' check (cardinality(sizes) <= 5),
  ages               text[] not null default '{}' check (ages <@ array['puppy', 'adult', 'senior']::text[]),
  -- Área: sempre aproximada (o trigger arredonda para a grade pública de 100 m).
  area_lat           double precision not null check (area_lat between -90 and 90),
  area_lng           double precision not null check (area_lng between -180 and 180),
  area_point         extensions.geography(Point, 4326) generated always as (
                       extensions.st_setsrid(extensions.st_makepoint(area_lng, area_lat), 4326)::extensions.geography) stored,
  area_label         text not null check (char_length(btrim(area_label)) between 2 and 120),
  radius_m           integer not null default 10000 check (radius_m in (1000, 3000, 5000, 10000)),
  housing            text not null check (housing in ('apartment', 'house_yard', 'house_no_yard', 'rural', 'other')),
  other_pets         text not null check (other_pets in ('none', 'dogs', 'cats', 'dogs_cats', 'others')),
  children           boolean,
  routine            text not null check (char_length(btrim(routine)) between 20 and 600),
  -- PRIVADO: só o dono e a moderação. Só dígitos (DDD + número, com ou sem 55).
  whatsapp_private   text check (whatsapp_private ~ '^[0-9]{10,13}$'),
  notify             boolean not null default true,
  show_public        boolean not null default false,
  consented_at       timestamptz not null,
  review_note        text check (char_length(review_note) <= 300),
  reviewed_at        timestamptz,
  expires_at         timestamptz not null,
  expiry_reminded_at timestamptz,
  edits_day          date,
  edits_count        smallint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index adoption_seekers_match_idx on public.adoption_seekers using gist (area_point)
  where status = 'APPROVED' and notify;
create index adoption_seekers_review_idx on public.adoption_seekers (created_at) where status = 'PENDING_REVIEW';
create index adoption_seekers_public_idx on public.adoption_seekers (reviewed_at desc) where status = 'APPROVED' and show_public;
create index adoption_seekers_expires_idx on public.adoption_seekers (expires_at);

create or replace function private.adoption_seekers_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select f.fuzzed_lat, f.fuzzed_lng into new.area_lat, new.area_lng
    from private.fuzz_lat_lng(new.area_lat, new.area_lng) f;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.adoption_seekers_before_write() from public, anon, authenticated;

create trigger adoption_seekers_before_write
  before insert or update on public.adoption_seekers
  for each row execute function private.adoption_seekers_before_write();

alter table public.adoption_seekers enable row level security;
create policy "adoption_seekers: dono vê o seu" on public.adoption_seekers for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "adoption_seekers: moderação vê todos" on public.adoption_seekers for select to authenticated
  using ((select private.is_moderator()));

-- Sem escrita direta: tudo passa pelas funções abaixo.
revoke all on public.adoption_seekers from anon, authenticated;
grant select on public.adoption_seekers to authenticated;

-- ---------------------------------------------------------------------------
-- Funções de quem procura
-- ---------------------------------------------------------------------------

-- Perfil do próprio usuário (inclui o WhatsApp: é dele).
create or replace function private.adoption_seeker_json(s public.adoption_seekers, p_full boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'status', s.status, 'species', s.species, 'sizes', s.sizes, 'ages', s.ages,
    'area_lat', s.area_lat, 'area_lng', s.area_lng, 'area_label', s.area_label, 'radius_m', s.radius_m,
    'housing', s.housing, 'other_pets', s.other_pets, 'children', s.children, 'routine', s.routine,
    'notify', s.notify, 'show_public', s.show_public, 'review_note', s.review_note,
    'reviewed_at', s.reviewed_at, 'expires_at', s.expires_at, 'created_at', s.created_at, 'updated_at', s.updated_at,
    'first_name', (select split_part(btrim(p.display_name), ' ', 1) from public.profiles p where p.id = s.user_id))
    || case when p_full then jsonb_build_object('whatsapp', s.whatsapp_private, 'user_id', s.user_id) else '{}'::jsonb end;
$$;

revoke all on function private.adoption_seeker_json(public.adoption_seekers, boolean) from public, anon, authenticated;

create or replace function public.get_my_adoption_seeker()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.adoption_seeker_json(s, true) from public.adoption_seekers s where s.user_id = (select auth.uid());
$$;

-- Cria ou edita o próprio perfil. Mudança de conteúdo volta para a moderação;
-- só ligar/desligar avisos ou WhatsApp não muda o status.
create or replace function public.save_my_adoption_seeker(
  p_species text,
  p_sizes public.pet_size[],
  p_ages text[],
  p_area_lat double precision,
  p_area_lng double precision,
  p_area_label text,
  p_radius_m integer,
  p_housing text,
  p_other_pets text,
  p_children boolean,
  p_routine text,
  p_whatsapp text,
  p_notify boolean,
  p_show_public boolean,
  p_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  cur public.adoption_seekers;
  digits text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g'), '');
  v_routine text := btrim(coalesce(p_routine, ''));
  v_label text := btrim(coalesce(p_area_label, ''));
  v_sizes public.pet_size[] := coalesce((select array_agg(distinct x order by x) from unnest(p_sizes) x), '{}');
  v_ages text[] := coalesce((select array_agg(distinct x order by x) from unnest(p_ages) x), '{}');
  changed boolean;
  saved public.adoption_seekers;
begin
  if me is null or private.is_anonymous_session() then
    raise exception 'Entre na sua conta para cadastrar seu interesse.' using errcode = '42501';
  end if;
  if private.is_suspended(me) then
    raise exception 'Sua conta está suspensa. Fale com a equipe da MEL.' using errcode = '42501';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Para entrar na fila, precisamos do seu consentimento.' using errcode = '22023';
  end if;
  -- Contato só no campo privado: nada de telefone, e-mail ou link na rotina (vai para a moderação e para o chat).
  if v_routine ~ '[0-9][0-9 ().-]{7,}[0-9]' or v_routine ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or v_routine ~* '(https?://|www\.)' then
    raise exception 'Não escreva telefone, e-mail nem links na rotina. O contato acontece pelo chat da MEL.' using errcode = '22023';
  end if;
  if digits is not null and digits !~ '^[0-9]{10,13}$' then
    raise exception 'WhatsApp inválido. Use DDD e número.' using errcode = '22023';
  end if;
  if p_area_lat is null or p_area_lng is null then
    raise exception 'Marque o bairro onde você mora.' using errcode = '22023';
  end if;

  select * into cur from public.adoption_seekers where user_id = me for update;
  if cur.id is null then
    insert into public.adoption_seekers (user_id, species, sizes, ages, area_lat, area_lng, area_label, radius_m, housing,
                                         other_pets, children, routine, whatsapp_private, notify, show_public, consented_at, expires_at)
    values (me, p_species, v_sizes, v_ages, p_area_lat, p_area_lng, v_label, coalesce(p_radius_m, 10000), p_housing,
            p_other_pets, p_children, v_routine, digits, coalesce(p_notify, true), coalesce(p_show_public, false), now(),
            now() + interval '90 days')
    returning * into saved;
  else
    select f.fuzzed_lat, f.fuzzed_lng into p_area_lat, p_area_lng from private.fuzz_lat_lng(p_area_lat, p_area_lng) f;
    changed := (p_species, v_sizes, v_ages, p_area_lat, p_area_lng, v_label, coalesce(p_radius_m, 10000), p_housing,
                p_other_pets, p_children, v_routine, coalesce(p_show_public, false))
               is distinct from
               (cur.species, cur.sizes, cur.ages, cur.area_lat, cur.area_lng, cur.area_label, cur.radius_m, cur.housing,
                cur.other_pets, cur.children, cur.routine, cur.show_public);
    -- Cada edição de conteúdo volta para a fila da moderação: no máximo 5 por dia.
    if changed and cur.edits_day = current_date and cur.edits_count >= 5 then
      raise exception 'Você editou seu perfil muitas vezes hoje. Tente amanhã.' using errcode = 'P0429';
    end if;
    update public.adoption_seekers
       set species = p_species, sizes = v_sizes, ages = v_ages, area_lat = p_area_lat, area_lng = p_area_lng,
           area_label = v_label, radius_m = coalesce(p_radius_m, 10000), housing = p_housing, other_pets = p_other_pets,
           children = p_children, routine = v_routine, whatsapp_private = digits, notify = coalesce(p_notify, true),
           show_public = coalesce(p_show_public, false), consented_at = now(),
           status = case when changed then 'PENDING_REVIEW' else status end,
           review_note = case when changed then null else review_note end,
           edits_count = case when not changed then edits_count when edits_day = current_date then edits_count + 1 else 1 end,
           edits_day = case when changed then current_date else edits_day end
     where id = cur.id
    returning * into saved;
  end if;
  return private.adoption_seeker_json(saved, true);
end;
$$;

-- "Pausar avisos" / "Retomar avisos".
create or replace function public.set_my_adoption_seeker_notify(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.adoption_seekers set notify = coalesce(p_enabled, false) where user_id = (select auth.uid());
  if not found then
    raise exception 'Você ainda não cadastrou seu interesse.' using errcode = '22023';
  end if;
end;
$$;

-- "Renovar": mais 90 dias a partir de hoje.
create or replace function public.renew_my_adoption_seeker()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  if private.is_suspended((select auth.uid())) then
    raise exception 'Sua conta está suspensa. Fale com a equipe da MEL.' using errcode = '42501';
  end if;
  update public.adoption_seekers set expires_at = now() + interval '90 days', expiry_reminded_at = null
   where user_id = (select auth.uid()) and status <> 'REJECTED'
  returning expires_at into v_expires;
  if v_expires is null then
    raise exception 'Não há perfil para renovar.' using errcode = '22023';
  end if;
  return v_expires;
end;
$$;

-- "Cancelar meu interesse": apaga de verdade (LGPD), não só esconde.
create or replace function public.withdraw_my_adoption_seeker()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.adoption_seekers where user_id = (select auth.uid());
  return found;
end;
$$;

-- Lista pública "Querem adotar": opt-in, aprovado e dentro da validade. Só
-- primeiro nome, rótulo de bairro/cidade e preferências.
create or replace function public.list_public_adoption_seekers(p_species text default null, p_limit integer default 24, p_offset integer default 0)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with items as (
    select s.*, split_part(btrim(p.display_name), ' ', 1) as first_name
      from public.adoption_seekers s
      join public.profiles p on p.id = s.user_id
     where s.status = 'APPROVED' and s.show_public and s.expires_at > now() and p.suspended_at is null
       and (p_species is null or s.species = p_species or s.species = 'any')
  )
  select jsonb_build_object(
    'total', (select count(*) from items),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                 'first_name', nullif(i.first_name, ''), 'area_label', i.area_label,
                 'species', i.species, 'sizes', i.sizes, 'ages', i.ages) order by i.reviewed_at desc)
               from (select * from items order by reviewed_at desc
                     limit least(greatest(coalesce(p_limit, 24), 1), 60) offset greatest(coalesce(p_offset, 0), 0)) i), '[]'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Moderação
-- ---------------------------------------------------------------------------

-- Fila: em análise primeiro (mais antigos antes). Inclui o WhatsApp: só a moderação.
create or replace function public.admin_list_adoption_seekers_for_review()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_moderator();
  return coalesce((select jsonb_agg(private.adoption_seeker_json(s, true) order by s.created_at)
                     from public.adoption_seekers s where s.status = 'PENDING_REVIEW'), '[]'::jsonb);
end;
$$;

-- Aprovar ou recusar (recusar pede motivo; vale também para tirar da fila um perfil já aprovado).
create or replace function public.admin_review_adoption_seeker(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.adoption_seekers;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform private.require_moderator();
  select * into s from public.adoption_seekers where id = p_id for update;
  if s.id is null or (p_approve and s.status <> 'PENDING_REVIEW') then
    raise exception 'Perfil não está aguardando revisão.' using errcode = '22023';
  end if;
  if not p_approve and v_note is null then
    raise exception 'Explique o motivo da recusa.' using errcode = '22023';
  end if;
  update public.adoption_seekers
     set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
         review_note = left(v_note, 300), reviewed_at = now()
   where id = s.id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason)
  values ((select auth.uid()), case when p_approve then 'approve' else 'reject' end, 'adoption_seeker', s.id, v_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke all on function public.get_my_adoption_seeker(), public.set_my_adoption_seeker_notify(boolean),
  public.renew_my_adoption_seeker(), public.withdraw_my_adoption_seeker(),
  public.save_my_adoption_seeker(text, public.pet_size[], text[], double precision, double precision, text, integer, text, text,
                                 boolean, text, text, boolean, boolean, boolean),
  public.admin_list_adoption_seekers_for_review(), public.admin_review_adoption_seeker(uuid, boolean, text)
  from public, anon;
grant execute on function public.get_my_adoption_seeker(), public.set_my_adoption_seeker_notify(boolean),
  public.renew_my_adoption_seeker(), public.withdraw_my_adoption_seeker(),
  public.save_my_adoption_seeker(text, public.pet_size[], text[], double precision, double precision, text, integer, text, text,
                                 boolean, text, text, boolean, boolean, boolean),
  public.admin_list_adoption_seekers_for_review(), public.admin_review_adoption_seeker(uuid, boolean, text)
  to authenticated;
revoke all on function public.list_public_adoption_seekers(text, integer, integer) from public;
grant execute on function public.list_public_adoption_seekers(text, integer, integer) to anon, authenticated;
