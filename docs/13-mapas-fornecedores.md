# 13 — Mapas: fornecedores e migração futura

Launch Readiness 2B (03/11/2026). **Fornecedor ativo: MapTiler** (mapa e busca).

> **Decisão do proprietário (2026-11-05): o piloto usa o MapTiler Free.** Os termos limitam
> o Free a "non-commercial use" sem definir o termo; condição assumida: piloto sem receita,
> anúncio ou patrocínio. Se isso mudar, rever o plano (pago) ou migrar (seção 3, exige código).
Este documento prepara uma troca futura para OpenFreeMap (mapa) + Geoapify (busca),
sem executá-la. Termos e cotas consultados nas páginas oficiais em 03/11/2026;
reconfirmar antes de migrar.

## 1. Onde o fornecedor aparece no código

| Ponto | Arquivo | Acoplamento |
|---|---|---|
| Estilo do mapa (claro/escuro) | `apps/web/lib/map/maplibre.ts` (`styleUrl`) | URL `api.maptiler.com/maps/streets-v2[-dark]` + chave |
| Interface do mapa | `packages/core/src/ports` (`MapProvider`, `MapHandle`) | nenhuma: telas só usam a interface |
| Busca e endereço de um ponto | `packages/core/src/adapters/maptiler-geocoder.ts` | formato de resposta do MapTiler (`place_type`, `context`) |
| Escolha do geocoder | `apps/web/lib/geo/client.ts` (`getGeocoder`) | 1 linha |
| Variável | `NEXT_PUBLIC_MAPTILER_KEY` (`.env.example`, `lib/env.ts`, `ci.yml`) | chave pública restrita por origem |
| Referrer-Policy | `apps/web/next.config.ts` | não pode ser `no-referrer` (chave restrita por domínio) |
| E2E | `e2e/support/geo.ts`, `e2e/location.spec.ts` | rotas `api.maptiler.com` + fixtures gravadas |
| Texto de privacidade | `app/(app)/privacidade/page.tsx` | cita "MapTiler e OpenStreetMap" |

**Não dependem do fornecedor:**
- GPS (`navigator.geolocation`);
- Radar, busca por raio, aproximação de 100 m e ponto público (PostGIS);
- cartaz/QR (sem mapa);
- pinos e trajeto (desenhados no navegador pelo MapLibre);
- carregamento sob demanda (`MapView`, IntersectionObserver).

## 2. Contrato do geocoder (privacidade)

Documentado também em `GeocodeResult` (`packages/core/src/ports`).

- `label` = `lugar ou rua, bairro, cidade – UF`. **Só o 1º trecho** pode ser o lugar
  exato. O banco publica o rótulo do avistamento sem esse trecho
  (`private.public_area_from_label`, migration 30). Número em trecho próprio
  (`Rua X, 123, …`) vazaria o número.
- `neighborhood`, `city` e `state` (UF de 2 letras) são **só área**. Viram o rótulo
  público do alerta (`publicAreaFrom`) e do guardião. Rua ou lugar ali vazaria.
- Coordenadas enviadas ao fornecedor:
  - `reverse` recebe só o ponto que a própria pessoa marcou ou o GPS dela;
  - `search` recebe o ponto marcado como proximidade, ou nenhum (viés por IP);
  - nunca recebe coordenadas de terceiros (alertas e avistamentos de outros);
  - os tiles revelam só a área visível do mapa.

## 3. Migração MapTiler → OpenFreeMap + Geoapify

**Pré-requisitos:**
- conta Geoapify (Free) com chave restrita por origem;
- reler os termos (a página de preços e os Termos da Geoapify divergem sobre produção);
- confirmar com chamadas reais, gravadas como fixtures, que:
  - `state_code` vem como UF ("SP");
  - existe um campo de bairro (`suburb`/`quarter`/`district`);
  - POIs (praça, parque) aparecem.

**Código** (~1,5–2 dias):
1. `createGeoapifyGeocoder` em `packages/core/src/adapters/`:
   - autocomplete com `filter=countrycode:br`, `bias=proximity:lon,lat`, `lang=pt`;
   - reverse;
   - conversão para `GeocodeResult` respeitando o §2.
2. Teste de contrato comum aos dois adapters: rótulo sem número em trecho próprio; bairro, cidade e UF só de área.
3. Escolha por configuração: `NEXT_PUBLIC_MAP_PROVIDER` / `NEXT_PUBLIC_GEOCODER` (padrão `maptiler`).
   - Fica para a migração: hoje haveria só uma opção.
4. `styleUrl`:
   - OpenFreeMap claro `https://tiles.openfreemap.org/styles/liberty` (ou `positron`);
   - escuro `.../styles/dark`, sem chave.
5. E2E: rotas e fixtures do novo fornecedor; o teste "mapa não carrega" passa a abortar `tiles.openfreemap.org`.
6. Texto de privacidade, `.env.example`, `ci.yml` e a CSP futura (`connect-src`/`img-src` `https://tiles.openfreemap.org`, `https://api.geoapify.com`).

**Atribuições obrigatórias:**
- no mapa: "© OpenMapTiles © OpenStreetMap" (o MapLibre mostra; não esconder);
- junto da busca: link "Powered by Geoapify" + © OpenStreetMap.

**Testes:**
- unit dos adapters com fixtures reais (centro, bairro, POI, rural, sem número);
- `sighting-privacy.rls.test.ts`;
- E2E de local, alerta, avistamento, encontrado, mapa e parceiros;
- manual em celular simples (Android de entrada, 4G), claro e escuro.

**Comparação lado a lado** (mesmos 30 endereços reais de SP, BH e uma área rural):
- acerto da busca;
- bairro, cidade e UF no reverse;
- tempo de resposta;
- legibilidade do mapa.

**Rollback:** voltar as variáveis para `maptiler` e fazer redeploy (sem migration e sem dados afetados). Manter a chave MapTiler válida por 30 dias após a troca.

**Critérios para migrar:**
1. MapTiler não confirma por escrito que o piloto é "non-commercial", ou a MEL passa a ter receita ou patrocínio;
2. uso acima de 70% de qualquer cota Free do MapTiler (5 mil sessões de mapa, 1 mil sessões de busca, 100 mil requisições/mês) em 2 meses;
3. ou o custo do Flex (US$ 30/mês) não é aceito.

**Não migrar** se a comparação mostrar busca ou bairro claramente piores nas cidades do piloto.
