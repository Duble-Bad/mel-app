-- MEL — Milestone 13: denúncias em todo conteúdo + painel mínimo de moderação.
-- Quem modera: profiles.role in ('moderator','admin') — definido pelo dono do
-- projeto (script grant-role). Toda ação de moderação fica no registro de auditoria.

-- ---------------------------------------------------------------------------
-- Conta suspensa não publica nada (o chat já bloqueava desde o M8).
-- ---------------------------------------------------------------------------
create or replace function private.block_suspended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_suspended((select auth.uid())) then
    raise exception 'Sua conta está suspensa. Fale com a equipe da MEL.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger lost_cases_block_suspended before insert on public.lost_cases
  for each row execute function private.block_suspended();
create trigger found_cases_block_suspended before insert on public.found_cases
  for each row execute function private.block_suspended();
create trigger sightings_block_suspended before insert on public.sightings
  for each row execute function private.block_suspended();

-- ---------------------------------------------------------------------------
-- Registro de auditoria (só moderação lê; só funções escrevem)
-- ---------------------------------------------------------------------------
create table public.moderation_actions (
  id           bigint generated always as identity primary key,
  moderator_id uuid references public.profiles (id) on delete set null,
  action       text not null check (action in ('hide', 'suspend', 'dismiss')),
  target_type  public.report_target not null,
  target_id    uuid not null,
  report_id    uuid references public.reports (id) on delete set null,
  reason       text check (char_length(reason) <= 500),
  created_at   timestamptz not null default now()
);

create index moderation_actions_created_idx on public.moderation_actions (created_at desc);
alter table public.moderation_actions enable row level security;
create policy "moderation_actions: moderação lê"
  on public.moderation_actions for select to authenticated
  using ((select private.is_moderator()));
revoke all on public.moderation_actions from anon, authenticated;
grant select on public.moderation_actions to authenticated;

-- ---------------------------------------------------------------------------
-- Denunciar conteúdo público: alerta (código), encontrado (código), avistamento (id)
-- ---------------------------------------------------------------------------
create or replace function public.report_content(
  p_target_type public.report_target,
  p_target text,
  p_reason public.report_reason,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target uuid;
  existing uuid;
  report_id uuid;
begin
  if me is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  if p_target_type = 'lost_case' then
    select id into target from public.lost_cases where short_code = lower(p_target) and status in ('ACTIVE', 'FOUND');
  elsif p_target_type = 'found_case' then
    select id into target from public.found_cases where short_code = lower(p_target) and status <> 'REMOVED';
  elsif p_target_type = 'sighting' then
    select s.id into target from public.sightings s
     where s.id::text = p_target and s.status = 'VISIBLE';
  else
    raise exception 'Tipo de denúncia não suportado aqui.' using errcode = '22023';
  end if;
  if target is null then
    raise exception 'Não encontramos esse conteúdo.' using errcode = '22023';
  end if;
  -- Mesma pessoa, mesmo conteúdo, ainda em aberto: não duplica.
  select id into existing from public.reports
   where reporter_id = me and target_type = p_target_type and target_id = target and status in ('OPEN', 'REVIEWING');
  if existing is not null then
    return existing;
  end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Você enviou muitas denúncias agora. Tente de novo mais tarde.' using errcode = 'P0429';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (me, p_target_type, target, p_reason, nullif(btrim(p_details), ''))
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.report_content(public.report_target, text, public.report_reason, text) from public, anon;
grant execute on function public.report_content(public.report_target, text, public.report_reason, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Painel (só moderação)
-- ---------------------------------------------------------------------------
create or replace function private.require_moderator()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator() then
    raise exception 'Acesso restrito à moderação.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.require_moderator() from public, anon, authenticated;

-- Contagens reais (nada inventado).
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
    'reunited', (select count(*) from public.lost_cases where status = 'FOUND'),
    'reunited_30d', (select count(*) from public.events where name = 'pet_reunited' and created_at > now() - interval '30 days'),
    'active_found', (select count(*) from public.found_cases where status = 'ACTIVE'),
    'sightings_7d', (select count(*) from public.sightings where created_at > now() - interval '7 days'),
    'users', (select count(*) from public.profiles where not is_anonymous),
    'guardians', (select count(*) from public.guardian_settings where enabled),
    'open_reports', (select count(*) from public.reports where status in ('OPEN', 'REVIEWING'))
  );
end;
$$;

-- Descrição curta do alvo para o painel (o que é, link, autor).
create or replace function private.report_target_json(p_type public.report_target, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'lost_case' then (select jsonb_build_object('title', 'Alerta: ' || p.name, 'href', '/alerta/' || c.short_code,
        'author_id', c.owner_id, 'state', c.status) from public.lost_cases c join public.pets p on p.id = c.pet_id where c.id = p_id)
    when 'found_case' then (select jsonb_build_object('title', 'Encontrado (' || f.species || ')', 'href', '/encontrado/' || f.short_code,
        'author_id', f.reporter_id, 'state', f.status) from public.found_cases f where f.id = p_id)
    when 'sighting' then (select jsonb_build_object('title', 'Avistamento: ' || coalesce(left(s.notes, 60), 'sem observação'),
        'href', '/alerta/' || c.short_code || '#linha-do-tempo', 'author_id', s.reporter_id, 'state', s.status)
        from public.sightings s join public.lost_cases c on c.id = s.lost_case_id where s.id = p_id)
    when 'user' then (select jsonb_build_object('title', 'Pessoa no chat', 'href', null, 'author_id', pr.id,
        'state', case when pr.suspended_at is null then 'ACTIVE' else 'SUSPENDED' end) from public.profiles pr where pr.id = p_id)
    else '{}'::jsonb
  end;
$$;

revoke all on function private.report_target_json(public.report_target, uuid) from public, anon, authenticated;

create or replace function public.admin_list_reports(p_open boolean default true, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_moderator();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', r.id, 'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason, 'details', r.details,
        'status', r.status, 'created_at', r.created_at, 'handled_at', r.handled_at,
        'conversation_id', r.conversation_id,
        'reports_for_target', (select count(*) from public.reports r2 where r2.target_type = r.target_type and r2.target_id = r.target_id),
        'target', private.report_target_json(r.target_type, r.target_id),
        'author_suspended', exists (select 1 from public.profiles pr
           where pr.id = (private.report_target_json(r.target_type, r.target_id) ->> 'author_id')::uuid and pr.suspended_at is not null))
      order by r.created_at desc)
      from (select * from public.reports
             where (p_open and status in ('OPEN', 'REVIEWING')) or (not p_open and status in ('ACTIONED', 'DISMISSED'))
             order by created_at desc limit least(greatest(p_limit, 1), 200)) r
  ), '[]'::jsonb);
end;
$$;

-- Ação sobre uma denúncia: ocultar o conteúdo, suspender o autor ou descartar.
create or replace function public.admin_moderate(p_report_id uuid, p_action text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  r public.reports;
  author uuid;
begin
  perform private.require_moderator();
  select * into r from public.reports where id = p_report_id;
  if r.id is null then
    raise exception 'Denúncia não encontrada.' using errcode = '22023';
  end if;
  author := (private.report_target_json(r.target_type, r.target_id) ->> 'author_id')::uuid;

  if p_action = 'hide' then
    if r.target_type = 'lost_case' then
      update public.lost_cases set status = 'REMOVED' where id = r.target_id;
    elsif r.target_type = 'found_case' then
      update public.found_cases set status = 'REMOVED', closed_at = now() where id = r.target_id;
    elsif r.target_type = 'sighting' then
      update public.sightings set status = 'HIDDEN' where id = r.target_id;
    else
      raise exception 'Este conteúdo não pode ser ocultado; use suspender.' using errcode = '22023';
    end if;
  elsif p_action = 'suspend' then
    if author is null then
      raise exception 'Não há autor identificado para suspender.' using errcode = '22023';
    end if;
    if author = me then
      raise exception 'Você não pode suspender a própria conta.' using errcode = '22023';
    end if;
    update public.profiles set suspended_at = coalesce(suspended_at, now()) where id = author;
  elsif p_action <> 'dismiss' then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;

  -- A mesma decisão vale para todas as denúncias abertas do mesmo conteúdo.
  update public.reports
     set status = case when p_action = 'dismiss' then 'DISMISSED'::public.report_status else 'ACTIONED'::public.report_status end,
         handled_by = me, handled_at = now()
   where target_type = r.target_type and target_id = r.target_id and status in ('OPEN', 'REVIEWING');

  insert into public.moderation_actions (moderator_id, action, target_type, target_id, report_id, reason)
  values (me, p_action, r.target_type, r.target_id, r.id, nullif(btrim(p_reason), ''));
end;
$$;

create or replace function public.admin_audit_log(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_moderator();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'target_type', a.target_type, 'target_id', a.target_id,
        'reason', a.reason, 'created_at', a.created_at,
        'moderator', coalesce(nullif(split_part(pr.display_name, ' ', 1), ''), 'Moderação'),
        'target', private.report_target_json(a.target_type, a.target_id)) order by a.created_at desc)
      from (select * from public.moderation_actions order by created_at desc limit least(greatest(p_limit, 1), 200)) a
      left join public.profiles pr on pr.id = a.moderator_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_overview(), public.admin_list_reports(boolean, integer), public.admin_moderate(uuid, text, text), public.admin_audit_log(integer)
  from public, anon;
grant execute on function public.admin_overview(), public.admin_list_reports(boolean, integer), public.admin_moderate(uuid, text, text), public.admin_audit_log(integer)
  to authenticated;
