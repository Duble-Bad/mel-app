-- MEL — Área pública aproximada: grade de 250 m → 100 m (decisão do proprietário, 2026-11-05).
-- Com 250 m o ponto público ficava longe demais do real e atrapalhava avistamentos
-- e correspondências. O ponto exato continua privado; só a grade pública fica mais fina.
--
-- private.fuzz_lat_lng passa a ser a fonte única do tamanho da célula: o argumento
-- cell_m vira legado (os triggers existentes ainda passam 250) e é ignorado.
-- Espelha fuzzPoint (packages/core/src/geo/geo.ts, padrão 100); os testes conferem a paridade.

create or replace function private.fuzz_lat_lng(lat double precision, lng double precision, cell_m double precision default 100)
returns table (fuzzed_lat double precision, fuzzed_lng double precision)
language sql
immutable
set search_path = ''
as $$
  with c as (select 100.0::double precision as m),
  g as (
    select (floor(lat / (c.m / 111320.0)) + 0.5) * (c.m / 111320.0) as flat, c.m from c
  )
  select
    round(g.flat::numeric, 6)::double precision,
    round(((floor(lng / (g.m / (111320.0 * cos(radians(g.flat))))) + 0.5)
           * (g.m / (111320.0 * cos(radians(g.flat)))))::numeric, 6)::double precision
  from g;
$$;

revoke all on function private.fuzz_lat_lng(double precision, double precision, double precision) from public, anon;

-- Backfill dos pontos públicos a partir dos exatos (os triggers recalculam).
-- O recálculo do Radar fica desligado aqui: refinar a grade não é uma edição do
-- tutor e não deve gerar avisos de correspondência em massa. As correspondências
-- se atualizam na próxima edição ou no próximo caso publicado.
alter table public.lost_cases disable trigger lost_cases_after_edit;
update public.lost_cases set last_seen_lat = last_seen_lat where last_seen_lat is not null and not public_point_exact;
alter table public.lost_cases enable trigger lost_cases_after_edit;

update public.sightings set lat = lat;

update public.adoption_listings set lat = lat where lat is not null;

-- found_cases só calcula o ponto público no insert.
update public.found_cases
   set (public_lat, public_lng) = (select f.fuzzed_lat, f.fuzzed_lng from private.fuzz_lat_lng(lat, lng) f)
 where lat is not null;

-- Guardiões: o banco nunca guardou o ponto exato (só a célula de 250 m). Re-arredondar
-- o centro antigo para a grade nova mantém a área (o raio do aviso é de km).
update public.guardian_settings set area_lat = area_lat;
