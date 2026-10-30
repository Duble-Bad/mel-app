-- Moderação de adoção e parceiros (P1 da auditoria funcional de 2026-10-30).
--
-- Antes: (1) num anúncio de adoção aprovado, mudar o conteúdo JUNTO com o
-- status (AVAILABLE → IN_PROCESS) pulava a revisão; (2) numa empresa aprovada,
-- descrição, telefone, WhatsApp, site, Instagram, horário e logo mudavam sem
-- revisão; (3) o dono conseguia gravar a nota da moderação (review_note);
-- (4) não havia como denunciar nem tirar do ar um anúncio/empresa aprovado.
--
-- Agora:
--   1. Qualquer mudança de conteúdo feita pelo dono num anúncio publicado
--      (AVAILABLE/IN_PROCESS/ADOPTED) o devolve para PENDING_REVIEW,
--      independentemente do status pedido;
--   2. Empresa APPROVED: mudança em qualquer campo público volta para revisão;
--   3. review_note (e, em empresas, status/plan_code) só pela moderação (RPCs);
--   4. report_content aceita 'adoption' e 'business'; "ocultar" no painel tira
--      o anúncio do ar (REMOVED) ou suspende a empresa (SUSPENDED), com auditoria.

create or replace function private.adoption_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status public.adoption_status := case when tg_op = 'UPDATE' then old.status end;
  p text;
  content_changed boolean := false;
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
    if not private.is_moderator() then
      new.review_note := null;
    end if;
  end if;
  foreach p in array new.photo_paths loop
    if split_part(p, '/', 1) <> new.owner_id::text then
      raise exception 'Foto inválida.' using errcode = '42501';
    end if;
  end loop;
  select f.fuzzed_lat, f.fuzzed_lng into new.public_lat, new.public_lng from private.fuzz_lat_lng(new.lat, new.lng, 250) f;

  if tg_op = 'UPDATE' then
    -- A nota é da moderação.
    if not private.is_moderator() then
      new.review_note := old.review_note;
    end if;
    content_changed := (new.name, new.sex, new.size, new.age_months, new.breed, new.color_primary, new.temperament,
                        new.neutered, new.vaccinated, new.dewormed, new.description, new.requirements, new.photo_paths)
      is distinct from (old.name, old.sex, old.size, old.age_months, old.breed, old.color_primary, old.temperament,
                        old.neutered, old.vaccinated, old.dewormed, old.description, old.requirements, old.photo_paths);
  end if;

  if tg_op = 'UPDATE' and old_status is distinct from new.status then
    -- Moderação: aprova, rejeita, remove. Dono: só alterna disponível / em processo / adotado.
    if not private.is_moderator()
       and not (old_status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED') and new.status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED')) then
      raise exception 'Mudança de status inválida.' using errcode = '22023';
    end if;
  end if;
  -- Conteúdo de um anúncio publicado mudou: volta para revisão, mesmo que o
  -- status também tenha sido alterado na mesma gravação.
  if tg_op = 'UPDATE' and content_changed and not private.is_moderator() and old_status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED') then
    new.status := 'PENDING_REVIEW';
  end if;
  if new.status = 'AVAILABLE' and new.published_at is null then
    new.published_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.businesses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if private.is_suspended(new.owner_id) then
      raise exception 'Sua conta está suspensa. Fale com a equipe da MEL.' using errcode = '42501';
    end if;
    if (select count(*) from public.businesses where owner_id = new.owner_id) >= 5 then
      raise exception 'Limite de 5 empresas por conta.' using errcode = 'P0429';
    end if;
    new.short_code := private.generate_business_code();
    new.status := 'PENDING_REVIEW';
    new.plan_code := 'FREE';
    new.created_at := now();
    if not private.is_moderator() then
      new.review_note := null;
    end if;
  end if;
  if new.logo_path is not null and split_part(new.logo_path, '/', 1) <> new.owner_id::text then
    raise exception 'Logo inválido.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if (new.status is distinct from old.status or new.plan_code is distinct from old.plan_code) and not private.is_moderator() then
      raise exception 'Só a moderação aprova empresas e muda planos.' using errcode = '42501';
    end if;
    if not private.is_moderator() then
      new.review_note := old.review_note;
    end if;
    if new.status = 'APPROVED' and old.status <> 'APPROVED' then
      new.approved_at := now();
    end if;
    -- Empresa aprovada mudou qualquer informação pública: volta para análise.
    if old.status = 'APPROVED' and new.status = 'APPROVED' and not private.is_moderator()
       and (new.name, new.category, new.description, new.address_label, new.lat, new.lng, new.phone, new.whatsapp,
            new.website, new.instagram, new.hours, new.helps_lost, new.logo_path)
           is distinct from
           (old.name, old.category, old.description, old.address_label, old.lat, old.lng, old.phone, old.whatsapp,
            old.website, old.instagram, old.hours, old.helps_lost, old.logo_path) then
      new.status := 'PENDING_REVIEW';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Colunas da moderação saem do alcance do usuário (a moderação usa as RPCs admin_*).
revoke update (review_note) on public.adoption_listings from authenticated;
revoke update (review_note, status, plan_code) on public.businesses from authenticated;

-- ---------------------------------------------------------------------------
-- Denúncia de anúncio de adoção e de empresa parceira
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
  elsif p_target_type = 'adoption' then
    select id into target from public.adoption_listings where short_code = lower(p_target) and status in ('AVAILABLE', 'IN_PROCESS', 'ADOPTED');
  elsif p_target_type = 'business' then
    select id into target from public.businesses where short_code = lower(p_target) and status = 'APPROVED';
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
    when 'adoption' then (select jsonb_build_object('title', 'Adoção: ' || a.name, 'href', '/adocao/' || a.short_code,
        'author_id', a.owner_id, 'state', a.status) from public.adoption_listings a where a.id = p_id)
    when 'business' then (select jsonb_build_object('title', 'Parceiro: ' || b.name, 'href', '/parceiros/' || b.short_code,
        'author_id', b.owner_id, 'state', b.status) from public.businesses b where b.id = p_id)
    when 'user' then (select jsonb_build_object('title', 'Pessoa no chat', 'href', null, 'author_id', pr.id,
        'state', case when pr.suspended_at is null then 'ACTIVE' else 'SUSPENDED' end) from public.profiles pr where pr.id = p_id)
    else '{}'::jsonb
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
    elsif r.target_type = 'adoption' then
      update public.adoption_listings set status = 'REMOVED', review_note = coalesce(nullif(btrim(p_reason), ''), review_note) where id = r.target_id;
    elsif r.target_type = 'business' then
      update public.businesses set status = 'SUSPENDED', review_note = coalesce(nullif(btrim(p_reason), ''), review_note) where id = r.target_id;
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
