-- M16 — LGPD: registro de consentimentos e exportação dos próprios dados.
-- A exclusão da conta acontece no servidor (POST /api/conta/excluir): apaga os
-- arquivos da pessoa no Storage e o usuário em auth.users; o resto sai em cascata.

-- Registro (somente inclusão) de aceite dos Termos de uso + Política de privacidade.
create table public.consents (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('terms_privacy')),
  version    text not null check (char_length(version) <= 20),
  granted    boolean not null default true,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, created_at desc);

alter table public.consents enable row level security;
create policy "consents: dono lê" on public.consents for select to authenticated using (user_id = (select auth.uid()));
create policy "consents: dono registra" on public.consents for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.consents from anon;
grant select, insert on public.consents to authenticated;

-- Tudo o que a MEL guarda sobre quem chama (portabilidade, LGPD art. 18).
-- Chaves de push ficam de fora (são segredos do navegador, não dados pessoais úteis).
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Entre na sua conta para exportar seus dados.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exportado_em', now(),
    'conta', (select jsonb_build_object('id', u.id, 'email', u.email, 'criada_em', u.created_at, 'ultimo_acesso', u.last_sign_in_at, 'anonima', u.is_anonymous)
              from auth.users u where u.id = uid),
    'perfil', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'consentimentos', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.consents x where x.user_id = uid), '[]'),
    'pets', coalesce((select jsonb_agg(to_jsonb(x)) from public.pets x where x.owner_id = uid), '[]'),
    'pets_dados_privados', coalesce((select jsonb_agg(to_jsonb(x)) from public.pet_private_details x where x.owner_id = uid), '[]'),
    'pets_fotos', coalesce((select jsonb_agg(to_jsonb(x)) from public.pet_photos x where x.owner_id = uid), '[]'),
    'alertas_perdido', coalesce((select jsonb_agg(to_jsonb(x)) from public.lost_cases x where x.owner_id = uid), '[]'),
    'encontrados', coalesce((select jsonb_agg(to_jsonb(x)) from public.found_cases x where x.reporter_id = uid), '[]'),
    'avistamentos', coalesce((select jsonb_agg(to_jsonb(x)) from public.sightings x where x.reporter_id = uid), '[]'),
    'conversas', coalesce((select jsonb_agg(to_jsonb(x)) from public.conversations x where uid in (x.owner_id, x.helper_id)), '[]'),
    'mensagens_enviadas', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.messages x where x.sender_id = uid), '[]'),
    'bloqueios', coalesce((select jsonb_agg(to_jsonb(x)) from public.blocks x where x.blocker_id = uid), '[]'),
    'denuncias_feitas', coalesce((select jsonb_agg(to_jsonb(x) - 'handled_by') from public.reports x where x.reporter_id = uid), '[]'),
    'notificacoes', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.notifications x where x.user_id = uid), '[]'),
    'guardiao', (select to_jsonb(x) from public.guardian_settings x where x.user_id = uid),
    'dispositivos_push', coalesce((select jsonb_agg(jsonb_build_object('user_agent', x.user_agent, 'criado_em', x.created_at)) from public.push_subscriptions x where x.user_id = uid), '[]'),
    'adocao_anuncios', coalesce((select jsonb_agg(to_jsonb(x)) from public.adoption_listings x where x.owner_id = uid), '[]'),
    'adocao_interesses', coalesce((select jsonb_agg(to_jsonb(x)) from public.adoption_interests x where x.user_id = uid), '[]'),
    'empresas', coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object('ofertas',
                  coalesce((select jsonb_agg(to_jsonb(o)) from public.business_offers o where o.business_id = b.id), '[]')))
                from public.businesses b where b.owner_id = uid), '[]'),
    'eventos', coalesce((select jsonb_agg(to_jsonb(x)) from public.events x where x.user_id = uid), '[]')
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
