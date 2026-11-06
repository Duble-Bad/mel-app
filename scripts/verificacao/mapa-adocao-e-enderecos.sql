-- Verificação (mel-dev): configuração de adoção no mapa e endereço público de parceiros.
-- Tudo numa transação desfeita no final (rollback): nada fica gravado.
-- Uso: npx supabase db query --linked --output-format json -f scripts/verificacao/mapa-adocao-e-enderecos.sql
begin;
create temp table r (n serial, teste text, resultado text);
grant all on r to anon, authenticated;
grant usage on sequence r_n_seq to anon, authenticated;
create temp table u as
  select (select p.id from public.profiles p join auth.users x on x.id = p.id
           where p.role = 'user' and x.email <> 'demo.casos@exemplo.com' order by p.created_at limit 1) as usr,
         (select p.id from public.profiles p join auth.users x on x.id = p.id
           where p.role = 'user' and x.email <> 'demo.casos@exemplo.com' order by p.created_at desc limit 1) as adm;
grant select on u to anon, authenticated;
create temp table j (k text primary key, v jsonb);
grant all on j to anon, authenticated;
-- Administrador só nesta transação.
update public.profiles set role = 'admin' where id = (select adm from u);

-- 1) Padrão: desligado e nenhum anúncio no mapa; visitante não altera.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r (teste, resultado) select 'padrão da configuração (show_adoption_on_map)', public.get_map_settings()->>'show_adoption_on_map';
insert into r (teste, resultado) select 'adoção no mapa (desligada)', jsonb_array_length(public.search_adoptions_on_map(-23.56, -46.6, 50000))::text || ' anúncios';
do $$ begin perform public.admin_set_map_setting('show_adoption_on_map', true); insert into r (teste, resultado) values ('visitante liga a configuração', 'PERMITIU');
exception when others then insert into r (teste, resultado) values ('visitante liga a configuração', 'bloqueado (' || sqlstate || ')'); end $$;

-- 2) Usuário comum não altera (nem pela função nem pela tabela).
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select usr from u), 'role', 'authenticated')::text, true);
do $$ begin perform public.admin_set_map_setting('show_adoption_on_map', true); insert into r (teste, resultado) values ('usuário comum liga a configuração', 'PERMITIU');
exception when others then insert into r (teste, resultado) values ('usuário comum liga a configuração', 'bloqueado (' || sqlstate || ')'); end $$;
do $$ begin insert into public.app_settings (key, value) values ('show_adoption_on_map', 'true'); insert into r (teste, resultado) values ('usuário comum grava direto na tabela', 'PERMITIU');
exception when others then insert into r (teste, resultado) values ('usuário comum grava direto na tabela', 'bloqueado (' || sqlstate || ')'); end $$;
do $$ begin perform public.admin_set_business_public_address('xxxxxx', true); insert into r (teste, resultado) values ('usuário comum libera endereço de parceiro', 'PERMITIU');
exception when others then insert into r (teste, resultado) values ('usuário comum libera endereço de parceiro', 'bloqueado (' || sqlstate || ')'); end $$;

-- Parceiros do usuário comum: empresa com autorização, ONG sem, protetor tentando autorizar.
insert into public.businesses (owner_id, partner_kind, name, category, description, address_label, lat, lng, phone, cnpj, legal_name, city, neighborhood, address_public_consent)
values ((select usr from u), 'company', 'TESTE Clínica Verificação', 'vet', 'Clínica de teste da verificação automática (desfeita).', 'Rua Teste, 100 - Mooca', -23.558712, -46.599123,
        '1133334444', '11222333000181', 'Teste Verificação Ltda', 'São Paulo – SP', 'Mooca', true);
insert into public.businesses (owner_id, partner_kind, name, category, description, address_label, lat, lng, phone, cnpj, responsible_name, activity_area, city, neighborhood)
values ((select usr from u), 'ngo', 'TESTE ONG Verificação', 'ngo', 'ONG de teste da verificação automática (desfeita).', 'Rua Particular, 7', -23.541234, -46.576789,
        '1133334445', '11444777000161', 'Pessoa Teste', 'Resgate e lar temporário', 'São Paulo – SP', 'Tatuapé');
do $$ begin
  insert into public.businesses (owner_id, partner_kind, name, category, description, address_label, lat, lng, city, neighborhood, address_public_consent)
  values ((select usr from u), 'independent', 'TESTE Protetor', 'ngo', 'Protetor de teste da verificação automática (desfeita).', 'Minha casa, 1', -23.53, -46.55, 'São Paulo – SP', 'Penha', true);
  insert into r (teste, resultado) values ('protetor independente autoriza endereço', 'PERMITIU');
exception when others then insert into r (teste, resultado) values ('protetor independente autoriza endereço', 'bloqueado (' || sqlstate || ')'); end $$;
reset role;
create temp table c as select name, short_code from public.businesses where name like 'TESTE %';
grant select on c to anon, authenticated;
insert into r (teste, resultado) select 'ONG sem autorização: o que fica guardado', lat || ',' || lng || ' · ' || address_label from public.businesses where name = 'TESTE ONG Verificação';

-- 3) Administrador: aprova, tenta liberar a ONG sem autorização, libera a empresa e liga a adoção no mapa.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select adm from u), 'role', 'authenticated')::text, true);
select public.admin_review_business(short_code, true, null) from c where name in ('TESTE Clínica Verificação', 'TESTE ONG Verificação');
do $$ begin perform public.admin_set_business_public_address((select short_code from c where name = 'TESTE ONG Verificação'), true); insert into r (teste, resultado) values ('admin libera ONG que não autorizou', 'PERMITIU');
exception when others then insert into r (teste, resultado) values ('admin libera ONG que não autorizou', 'bloqueado (' || sqlstate || ')'); end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into j select 'empresa_antes', public.get_business((select short_code from c where name = 'TESTE Clínica Verificação'));
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select adm from u), 'role', 'authenticated')::text, true);
select public.admin_set_business_public_address((select short_code from c where name = 'TESTE Clínica Verificação'), true);
insert into r (teste, resultado) select 'admin liga adoção no mapa', public.admin_set_map_setting('show_adoption_on_map', true)->>'show_adoption_on_map';
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into j select 'empresa_depois', public.get_business((select short_code from c where name = 'TESTE Clínica Verificação'));
insert into j select 'ong', public.get_business((select short_code from c where name = 'TESTE ONG Verificação'));
insert into j select 'lista', public.list_businesses(-23.55, -46.6, 20000);
insert into j select 'mapa', public.search_adoptions_on_map(-23.56, -46.6, 50000);
reset role;
insert into r (teste, resultado) select 'empresa ANTES da validação (visitante)', (v->>'address_label') || ' · ' || (v->>'lat') || ',' || (v->>'lng') || ' · address_public=' || (v->>'address_public') || ' · private=' || coalesce(v->>'private', 'null') from j where k = 'empresa_antes';
insert into r (teste, resultado) select 'empresa validada (visitante)', (v->>'address_label') || ' · ' || (v->>'lat') || ',' || (v->>'lng') || ' · address_public=' || (v->>'address_public') from j where k = 'empresa_depois';
insert into r (teste, resultado) select 'ONG sem autorização (visitante)', (v->>'address_label') || ' · ' || (v->>'lat') || ',' || (v->>'lng') || ' · address_public=' || (v->>'address_public') from j where k = 'ong';
insert into r (teste, resultado) select 'lista de parceiros: TESTE (visitante)', (select string_agg((x->>'name') || ' ' || (x->>'lat') || ',' || (x->>'lng') || ' d=' || (x->>'distance_m'), ' | ') from jsonb_array_elements(v) x where x->>'name' like 'TESTE%') from j where k = 'lista';
insert into r (teste, resultado) select 'adoção no mapa (ligada)', (select string_agg(x->>'name', ', ' order by x->>'name') from jsonb_array_elements(v) x) from j where k = 'mapa';
insert into r (teste, resultado) select 'adoção: ponto = público aproximado, não o exato',
  (select bool_and((x->>'lat')::float8 = a.public_lat and (x->>'lng')::float8 = a.public_lng and ((x->>'lat')::float8 <> a.lat or (x->>'lng')::float8 <> a.lng))::text
     from j, jsonb_array_elements(j.v) x join public.adoption_listings a on a.short_code = x->>'code' where j.k = 'mapa');
insert into r (teste, resultado) select 'adoção: campos enviados', (select string_agg(distinct key, ',' order by key) from j, jsonb_array_elements(j.v) x, jsonb_object_keys(x) key where j.k = 'mapa');

-- 4) Desligar volta a esconder; histórico registrado.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select adm from u), 'role', 'authenticated')::text, true);
insert into r (teste, resultado) select 'admin desliga', public.admin_set_map_setting('show_adoption_on_map', false)->>'show_adoption_on_map';
insert into r (teste, resultado) select 'adoção no mapa (desligada de novo)', jsonb_array_length(public.search_adoptions_on_map(-23.56, -46.6, 50000))::text || ' anúncios';
reset role;
insert into r (teste, resultado) select 'histórico de mudanças', count(*)::text || ' registros' from public.app_setting_changes;
select teste, resultado from r order by n;
rollback;
