-- MEL — Milestone 14: adoção básica.
-- Anúncio moderado (PENDING_REVIEW → AVAILABLE pela moderação), interesse por
-- formulário (conta real) que abre uma conversa no chat com quem doa.
-- O chat passa a aceitar conversas de alerta OU de adoção.

create type public.adoption_status as enum ('PENDING_REVIEW', 'AVAILABLE', 'IN_PROCESS', 'ADOPTED', 'REJECTED', 'REMOVED');

create table public.adoption_listings (
  id                uuid primary key default gen_random_uuid(),
  short_code        text not null unique,
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  status            public.adoption_status not null default 'PENDING_REVIEW',
  name              text not null check (char_length(btrim(name)) between 1 and 60),
  species           public.species not null,
  sex               public.pet_sex not null default 'unknown',
  size              public.pet_size,
  age_months        smallint check (age_months between 0 and 360),
  breed             text check (char_length(breed) <= 80),
  color_primary     text check (char_length(color_primary) <= 30),
  temperament       text[] not null default '{}' check (cardinality(temperament) <= 8),
  neutered          boolean,
  vaccinated        boolean,
  dewormed          boolean,
  description       text not null check (char_length(btrim(description)) between 20 and 1500),
  requirements      text check (char_length(requirements) <= 500),
  -- PRIVADO: ponto exato; público só a região aproximada.
  lat               double precision not null check (lat between -90 and 90),
  lng               double precision not null check (lng between -180 and 180),
  public_lat        double precision,
  public_lng        double precision,
  public_area_label text check (char_length(public_area_label) <= 200),
  photo_paths       text[] not null default '{}' check (cardinality(photo_paths) between 1 and 4),
  review_note       text check (char_length(review_note) <= 300),
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index adoption_listings_status_idx on public.adoption_listings (status, published_at desc);
create index adoption_listings_owner_idx on public.adoption_listings (owner_id, created_at desc);

create or replace function private.generate_adoption_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.adoption_listings where short_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- Regras: ponto público derivado; fotos na pasta de quem doa; transições de status.
create or replace function private.adoption_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status public.adoption_status := case when tg_op = 'UPDATE' then old.status end;
  p text;
begin
  if tg_op = 'INSERT' then
    if private.is_suspended(new.owner_id) then
      raise exception 'Sua conta está suspensa. Fale com a equipe da MEL.' using errcode = '42501';
    end if;
    if (select count(*) from public.adoption_listings where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 5 then
      raise exception 'Você já publicou muitos anúncios hoje. Tente amanhã.' using errcode = 'P0429';
    end if;
    new.short_code := private.generate_adoption_code();
    new.status := 'PENDING_REVIEW';
    new.created_at := now();
  end if;
  foreach p in array new.photo_paths loop
    if split_part(p, '/', 1) <> new.owner_id::text then
      raise exception 'Foto inválida.' using errcode = '42501';
    end if;
  end loop;
  select f.fuzzed_lat, f.fuzzed_lng into new.public_lat, new.public_lng from private.fuzz_lat_lng(new.lat, new.lng, 250) f;

  if tg_op = 'UPDATE' and old_status is distinct from new.status then
    -- Moderação: aprova, rejeita, remove. Dono: só alterna disponível / em processo / adotado.
    if not private.is_moderator()
       and not (old_status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED') and new.status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED')) then
      raise exception 'Mudança de status inválida.' using errcode = '22023';
    end if;
  end if;
  if new.status = 'AVAILABLE' and new.published_at is null then
    new.published_at := now();
  end if;
  -- Editar um anúncio publicado o devolve para revisão (evita trocar o conteúdo depois de aprovado).
  if tg_op = 'UPDATE' and old_status in ('AVAILABLE', 'IN_PROCESS') and new.status = old_status and not private.is_moderator()
     and (new.name, new.description, new.photo_paths, new.requirements) is distinct from (old.name, old.description, old.photo_paths, old.requirements) then
    new.status := 'PENDING_REVIEW';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger adoption_before_write
  before insert or update on public.adoption_listings
  for each row execute function private.adoption_before_write();

alter table public.adoption_listings enable row level security;
create policy "adoption: dono vê os seus" on public.adoption_listings for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "adoption: moderação vê todos" on public.adoption_listings for select to authenticated
  using ((select private.is_moderator()));
create policy "adoption: conta real publica" on public.adoption_listings for insert to authenticated
  with check ((select auth.uid()) = owner_id and not (select private.is_anonymous_session()));
create policy "adoption: dono altera" on public.adoption_listings for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "adoption: moderação altera" on public.adoption_listings for update to authenticated
  using ((select private.is_moderator())) with check ((select private.is_moderator()));

revoke all on public.adoption_listings from anon, authenticated;
grant select on public.adoption_listings to authenticated;
grant insert (owner_id, name, species, sex, size, age_months, breed, color_primary, temperament, neutered, vaccinated, dewormed,
              description, requirements, lat, lng, public_area_label, photo_paths)
  on public.adoption_listings to authenticated;
grant update (status, name, sex, size, age_months, breed, color_primary, temperament, neutered, vaccinated, dewormed,
              description, requirements, photo_paths, review_note)
  on public.adoption_listings to authenticated;

create table public.adoption_interests (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.adoption_listings (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  housing     text not null check (housing in ('house', 'apartment', 'other')),
  other_pets  boolean not null,
  children    boolean not null,
  message     text not null check (char_length(btrim(message)) between 10 and 1000),
  created_at  timestamptz not null default now(),
  unique (listing_id, user_id)
);

alter table public.adoption_interests enable row level security;
create policy "adoption_interests: quem enviou vê" on public.adoption_interests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "adoption_interests: quem doa vê" on public.adoption_interests for select to authenticated
  using (exists (select 1 from public.adoption_listings a where a.id = listing_id and a.owner_id = (select auth.uid())));
revoke all on public.adoption_interests from anon, authenticated;
grant select on public.adoption_interests to authenticated;


-- Leitura pública: só AVAILABLE/IN_PROCESS/ADOPTED (dono e moderação veem também os outros).
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
    'interests', case when a.owner_id = (select auth.uid()) then (select count(*) from public.adoption_interests i where i.listing_id = a.id) end);
$$;

create or replace function public.get_public_adoption(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.adoption_json(a) from public.adoption_listings a
   where a.short_code = lower(p_code)
     and (a.status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED') or a.owner_id = (select auth.uid()) or private.is_moderator());
$$;

create or replace function public.list_adoptions(p_species public.species[] default null, p_size public.pet_size[] default null,
                                                 p_limit integer default 24, p_offset integer default 0)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with items as (
    select a.* from public.adoption_listings a
     where a.status in ('AVAILABLE', 'IN_PROCESS')
       and (p_species is null or a.species = any(p_species))
       and (p_size is null or a.size = any(p_size))
  )
  select jsonb_build_object(
    'total', (select count(*) from items),
    'items', coalesce((select jsonb_agg(private.adoption_json(i) order by i.status = 'IN_PROCESS', i.published_at desc)
                         from (select * from items order by status = 'IN_PROCESS', published_at desc
                               limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)) i), '[]'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Interesse (conta real) → conversa no chat com quem doa
-- ---------------------------------------------------------------------------
-- Conversas: alerta OU adoção.
alter table public.conversations alter column lost_case_id drop not null;
alter table public.conversations add column adoption_listing_id uuid references public.adoption_listings (id) on delete cascade;
alter table public.conversations add constraint conversations_one_context
  check ((lost_case_id is not null)::int + (adoption_listing_id is not null)::int = 1);
create unique index conversations_adoption_helper_idx on public.conversations (adoption_listing_id, helper_id) where adoption_listing_id is not null;

create or replace function public.submit_adoption_interest(p_code text, p_housing text, p_other_pets boolean, p_children boolean, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a public.adoption_listings;
  conv_id uuid;
  housing_label text := case p_housing when 'house' then 'casa' when 'apartment' then 'apartamento' else 'outro tipo de moradia' end;
begin
  if me is null or private.is_anonymous_session() then
    raise exception 'Entre na sua conta para enviar o interesse.' using errcode = '42501';
  end if;
  select * into a from public.adoption_listings where short_code = lower(p_code);
  if a.id is null or a.status not in ('AVAILABLE', 'IN_PROCESS') then
    raise exception 'Este anúncio não está recebendo interessados.' using errcode = '22023';
  end if;
  if a.owner_id = me then
    raise exception 'Este anúncio é seu.' using errcode = '22023';
  end if;
  if private.is_blocked_between(me, a.owner_id) or private.is_suspended(me) then
    raise exception 'Não é possível enviar interesse agora.' using errcode = '42501';
  end if;
  if (select count(*) from public.adoption_interests where user_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Você enviou muitos interesses hoje. Tente amanhã.' using errcode = 'P0429';
  end if;
  insert into public.adoption_interests (listing_id, user_id, housing, other_pets, children, message)
  values (a.id, me, p_housing, p_other_pets, p_children, btrim(p_message))
  on conflict (listing_id, user_id) do update set message = excluded.message, housing = excluded.housing,
    other_pets = excluded.other_pets, children = excluded.children;

  select id into conv_id from public.conversations where adoption_listing_id = a.id and helper_id = me;
  if conv_id is null then
    insert into public.conversations (adoption_listing_id, owner_id, helper_id, created_by)
    values (a.id, a.owner_id, me, me) returning id into conv_id;
  end if;
  insert into public.messages (conversation_id, sender_id, body)
  values (conv_id, me, left(format(E'Olá! Tenho interesse em adotar %s.\n\nMoradia: %s · Outros pets: %s · Crianças em casa: %s\n\n%s',
    a.name, housing_label, case when p_other_pets then 'sim' else 'não' end, case when p_children then 'sim' else 'não' end, btrim(p_message)), 2000));
  update public.conversations set helper_last_read_at = now() where id = conv_id;
  return conv_id;
end;
$$;

revoke all on function public.submit_adoption_interest(text, text, boolean, boolean, text) from public, anon;
grant execute on function public.submit_adoption_interest(text, text, boolean, boolean, text) to authenticated;

-- Moderação: aprovar / rejeitar anúncios.
create or replace function public.admin_list_adoptions_for_review()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_moderator();
  return coalesce((select jsonb_agg(private.adoption_json(a) order by a.created_at)
                     from public.adoption_listings a where a.status = 'PENDING_REVIEW'), '[]'::jsonb);
end;
$$;

create or replace function public.admin_review_adoption(p_code text, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.adoption_listings;
begin
  perform private.require_moderator();
  select * into a from public.adoption_listings where short_code = lower(p_code) and status = 'PENDING_REVIEW';
  if a.id is null then
    raise exception 'Anúncio não está aguardando revisão.' using errcode = '22023';
  end if;
  update public.adoption_listings
     set status = case when p_approve then 'AVAILABLE'::public.adoption_status else 'REJECTED'::public.adoption_status end,
         review_note = nullif(btrim(p_note), '')
   where id = a.id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason)
  values ((select auth.uid()), case when p_approve then 'approve' else 'reject' end, 'adoption', a.id, nullif(btrim(p_note), ''));
end;
$$;

alter table public.moderation_actions drop constraint moderation_actions_action_check;
alter table public.moderation_actions add constraint moderation_actions_action_check check (action in ('hide', 'suspend', 'dismiss', 'approve', 'reject'));

revoke all on function public.get_public_adoption(text), public.list_adoptions(public.species[], public.pet_size[], integer, integer) from public;
grant execute on function public.get_public_adoption(text), public.list_adoptions(public.species[], public.pet_size[], integer, integer) to anon, authenticated;
revoke all on function public.admin_list_adoptions_for_review(), public.admin_review_adoption(text, boolean, text) from public, anon;
grant execute on function public.admin_list_adoptions_for_review(), public.admin_review_adoption(text, boolean, text) to authenticated;
revoke all on function private.adoption_json(public.adoption_listings) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Chat genérico (alerta OU adoção): regras de envio, aviso e resumo.
-- ---------------------------------------------------------------------------
create or replace function private.conversation_context(conv public.conversations)
returns table (kind text, code text, title text, thumb_path text, open boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select 'lost', lc.short_code, p.name,
         (select ph.thumb_path from public.pet_photos ph where ph.pet_id = p.id order by ph.is_primary desc, ph.position limit 1),
         lc.status in ('ACTIVE', 'FOUND')
    from public.lost_cases lc join public.pets p on p.id = lc.pet_id
   where lc.id = conv.lost_case_id
  union all
  select 'adoption', a.short_code, a.name, a.photo_paths[1], a.status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED')
    from public.adoption_listings a
   where a.id = conv.adoption_listing_id;
$$;

revoke all on function private.conversation_context(public.conversations) from public, anon, authenticated;

create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  ctx record;
  peer uuid;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if conv.id is null or new.sender_id not in (conv.owner_id, conv.helper_id) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  peer := case when new.sender_id = conv.owner_id then conv.helper_id else conv.owner_id end;
  select * into ctx from private.conversation_context(conv);
  if not coalesce(ctx.open, false)
     or private.is_blocked_between(new.sender_id, peer)
     or private.is_suspended(new.sender_id) then
    raise exception 'Esta conversa não aceita novas mensagens.' using errcode = '42501';
  end if;
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Você enviou muitas mensagens seguidas. Espere um minuto e tente de novo.' using errcode = 'P0429';
  end if;
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 500 then
    raise exception 'Você atingiu o limite de mensagens de hoje.' using errcode = 'P0429';
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  new.hidden_at := null;
  return new;
end;
$$;

create or replace function private.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  recipient uuid;
  ctx record;
begin
  update public.conversations set last_message_at = new.created_at
   where id = new.conversation_id
   returning * into conv;
  recipient := case when new.sender_id = conv.owner_id then conv.helper_id else conv.owner_id end;

  update public.notifications
     set payload = jsonb_set(payload, '{count}', to_jsonb(coalesce((payload ->> 'count')::int, 1) + 1)),
         created_at = now()
   where user_id = recipient and kind = 'message_new' and read_at is null
     and payload ->> 'conversation_id' = conv.id::text;
  if not found then
    select * into ctx from private.conversation_context(conv);
    insert into public.notifications (user_id, kind, payload)
    values (recipient, 'message_new', jsonb_build_object(
      'conversation_id', conv.id, 'code', ctx.code, 'pet_name', ctx.title, 'context', ctx.kind,
      'to_owner', recipient = conv.owner_id, 'count', 1));
  end if;
  return new;
end;
$$;

create or replace function private.conversation_json(conv public.conversations, me uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', conv.id,
    'context', ctx.kind,
    'code', ctx.code,
    'case_status', case when ctx.open then (case ctx.kind when 'lost' then (select status::text from public.lost_cases where id = conv.lost_case_id)
                                                   else (select status::text from public.adoption_listings where id = conv.adoption_listing_id) end)
                        else 'CLOSED' end,
    'pet_name', ctx.title,
    'pet_thumb_path', ctx.thumb_path,
    'my_role', case when me = conv.owner_id then 'owner' else 'helper' end,
    'peer_id', peer.id,
    'peer_name', case when me = conv.owner_id and not peer.is_anonymous then split_part(peer.display_name, ' ', 1) end,
    'peer_is_anonymous', peer.is_anonymous,
    'from_sighting', conv.sighting_id is not null,
    'from_found', conv.found_case_id is not null,
    'blocked_by_me', exists (select 1 from public.blocks b where b.blocker_id = me and b.blocked_id = peer.id),
    'can_send', ctx.open and not private.is_blocked_between(me, peer.id) and not private.is_suspended(me),
    'created_at', conv.created_at,
    'last_message', (select jsonb_build_object('body', left(m.body, 140), 'created_at', m.created_at, 'mine', m.sender_id = me)
                       from public.messages m
                      where m.conversation_id = conv.id and m.hidden_at is null
                      order by m.created_at desc limit 1),
    'unread', (select count(*) from public.messages m
                where m.conversation_id = conv.id and m.sender_id <> me and m.hidden_at is null
                  and m.created_at > coalesce(case when me = conv.owner_id then conv.owner_last_read_at
                                                   else conv.helper_last_read_at end, '-infinity'))
  )
  from private.conversation_context(conv) ctx
  join public.profiles peer on peer.id = case when me = conv.owner_id then conv.helper_id else conv.owner_id end
  where me in (conv.owner_id, conv.helper_id);
$$;
