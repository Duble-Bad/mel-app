# MEL — Arquitetura e Stack

## 1. Stack final recomendada

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend | **Next.js 16 (App Router, Cache Components) + React 19 + TypeScript strict** | SSR para páginas públicas (SEO/OG), Server Actions, rotas de imagem (`next/og`) |
| Estilo | **Tailwind CSS v4** com tokens em CSS variables | Tokens trocáveis (identidade pode mudar) |
| Componentes base | Radix primitives (só Dialog, Popover, Tabs) | Acessibilidade pronta sem "cara de SaaS" |
| Formulários | React Hook Form + **Zod** | Schemas Zod em `packages/core` reaproveitados no app Expo |
| Backend | **Supabase**: Postgres 15 + **PostGIS**, Auth, Storage, Realtime, Edge Functions | Pedido do doc; RLS cobre segurança de dados |
| Mapas | **MapLibre GL JS** + tiles OpenStreetMap (MapTiler free tier) atrás de `MapProvider` | Sem custo inicial, sem lock-in; Mapbox/Google trocáveis pelo adapter |
| Geocoding | Adapter `Geocoder` → Nominatim/MapTiler no MVP | Mesma lógica de abstração |
| Imagens | Supabase Storage + transformação (resize/webp) + compressão no cliente antes do upload | Conexões móveis |
| Cartaz / OG | `next/og` (Satori) → PNG 1:1, 9:16, 16:9; A4 via página `print` CSS (salvar como PDF) | Zero dependência pesada |
| Modelos de cartaz (DEV) | `lib/poster/models.ts` (caixas das fotos, código puro usado no servidor e no editor), `compose.ts` (recorte com `sharp`, sem laterais desfocadas), `PosterModels.tsx` / `PosterV2.tsx` / `PosterCollage.tsx` (modelos 1–4), `@mel/core` `collageExtras` (dados do modelo 4) | Mesmo cálculo de layout na prévia e no PNG final |
| QR Code | `qrcode` (lib pequena, gera SVG) | — |
| Push | Web Push (VAPID) via Edge Function | Grátis, padrão |
| Antiabuso | Cloudflare Turnstile + rate limit em Postgres (tabela de buckets) | Sem Redis no MVP |
| Testes | **Vitest** (unit), **pgTAP** via `supabase test db` (RLS), **Playwright** (E2E mobile viewport) | — |
| Deploy | **Vercel** (web) + **Supabase Cloud** (região São Paulo `sa-east-1`) | LGPD: dados no Brasil |
| Analytics | Tabela `events` própria (first-party), sem PII | KPI real, sem terceiros |

> **Decisão (2026-10-27)** — Ambiente de desenvolvimento: **projeto Supabase Cloud dedicado a dev** (sem Docker local). Migrations aplicadas com `supabase db push` no projeto dev; testes RLS (pgTAP) rodam contra ele. Produção será outro projeto.
>
> **Decisão (2026-10-27)** — Mapas: **MapLibre GL JS + MapTiler (plano gratuito)** para tiles e geocoding, atrás de `MapProvider`/`Geocoder`. Fallback sem chave: tiles OpenFreeMap + geocoding Photon.

## 2. Estrutura do repositório (monorepo leve, npm workspaces)

```
mel/
├─ apps/
│  └─ web/                     # Next.js (UI + rotas)
│     ├─ app/                  # rotas (ver 04-telas.md)
│     ├─ components/           # UI pura (PetCard, AlertCard…)
│     └─ features/             # composição por fluxo (lost-flow, sighting-flow…)
├─ packages/
│  ├─ core/                    # REGRAS DE NEGÓCIO — sem React, sem Next
│  │  ├─ domain/               # tipos, enums, status machine dos casos
│  │  ├─ schemas/              # Zod (validação compartilhada web/Expo)
│  │  ├─ services/             # lostCases, sightings, matching, sharing…
│  │  ├─ geo/                  # distância, fuzzing de localização, bbox
│  │  └─ ports/                # interfaces: MapProvider, Geocoder, Notifier, Analytics, Storage
│  ├─ data/                    # adapters Supabase (repositórios) — implementam os ports
│  └─ ui-tokens/               # tokens de design (CSS vars + TS)
├─ supabase/
│  ├─ migrations/              # SQL versionado
│  ├─ functions/               # Edge Functions (notify-guardians, run-matching, push)
│  ├─ tests/                   # pgTAP (RLS)
│  └─ seed.sql                 # dados fictícios (Mel demonstrativa)
├─ e2e/                        # Playwright
└─ docs/
```

Regra: **componentes nunca chamam Supabase diretamente**. UI → hooks/actions → `core/services` → `ports` → `data` (Supabase). O futuro app Expo reaproveita `core` + `data`.

### Dependências entre camadas (verificadas no CI)

Desde 2026-11-17 o **Dependency Cruiser** (`.dependency-cruiser.cjs`, `npm run deps:check`, também no `npm run check` e no CI) confere quem pode importar quem. Camadas, de baixo para cima: `packages/core` → `packages/data` → `apps/web/lib` → `apps/web/components` → `apps/web/app` (e `packages/ui-tokens`, isolado).

| Regra | O que proíbe |
|---|---|
| `sem-ciclos` | Dependência circular entre módulos (A → B → A ou mais longa); import só de tipo não conta |
| `core-puro` | `core` importar `data`, `ui-tokens`, o app, Supabase, React, Next, lucide ou motion |
| `core-sem-node` | `core` (fora dos testes) usar módulos do Node (`fs`, `path`, `crypto`…): ele roda também no navegador |
| `ui-tokens-isolado` | Tokens do tema importarem outra parte do projeto |
| `data-nao-depende-do-app` | `data` (fora dos testes) importar o app |
| `testes-do-data-so-com-a-cripto-do-app` | Testes do `data` importarem do app algo além de `apps/web/lib/pii` (exceção documentada: testam a criptografia de dados pessoais) |
| `lib-nao-depende-de-telas` | `apps/web/lib` importar componentes ou páginas |
| `telas-nao-dependem-de-rotas` | Componentes importarem páginas/rotas de `app/` (exceção: CSS compartilhado que mora lá, ex.: `app/map.css`) |
| `ui-base-sem-telas` | `components/ui` importar telas de assunto (só `ui` e `brand`) |
| `producao-sem-prototipos` | Código de produção importar protótipos internos (`components/dev`, `app/(app)/dev`) |

Cada regra tem um teste que planta a violação e confere que ela é acusada (`scripts/deps/rules.test.mjs`, em `npm run test:guards`). No dia da adoção: 0 ciclos e 0 violações em cerca de 400 módulos.

**Complexidade ciclomática** (regra `complexity` do ESLint, só **aviso**): acima de 15 por função no `core` e no `data` (lógica pura) e acima de 25 no app (no JSX, cada bloco condicional conta). Não trava o build; serve de guia para quebrar funções ao mexer nelas. Na adoção: 22 avisos no app, 5 no `core`, 2 no `data` (maiores: `PetForm` 68, página do alerta 56, exportação de dados 53, `classifyError` 36, `toAppNotification` 34).

### Resiliência e desempenho (2026-11-17)

- **Tempo limite em toda chamada externa** com `fetchWithTimeout` (`packages/core/src/adapters/http.ts`): MapTiler e ViaCEP 5 s + 1 nova tentativa com espera crescente (leituras); Cloudflare Turnstile 5 s **sem** nova tentativa (token vale uma vez); Web Push 10 s (a fila já repete); clientes do Supabase **no servidor** 15 s. O cliente do navegador fica sem tempo curto (uploads de foto em rede lenta). O erro de tempo esgotado vira a mensagem de conexão de `userErrorMessage`.
- **Busca de endereço** (`LocationPicker`, `PlaceSearch`): espera 350 ms sem digitar e cancela a requisição anterior (`AbortController` até o `fetch`; o `Geocoder` aceita `{ signal }`).
- **Esqueletos de página** (`components/ui/Skeletons.tsx`): `DetailSkeleton`, `ListSkeleton`, `FormSkeleton`, `ProfileSkeleton`, `CardGridSkeleton`, `MapSkeleton` como `fallback` do `<Suspense>`; não mudam a busca de dados.
- **Imagens:** fotos convertidas para WebP no envio (pet até 2048 px + miniatura de 400 px); abaixo da dobra `loading="lazy"`; primeira fileira de cartões (Mural, Adoção) e foto principal da galeria com `fetchPriority="high"`.
- **Verificação contínua:** `e2e/perf.spec.ts` (celular lento) e `e2e/resilience.spec.ts` (busca e serviço fora do ar).

## 3. Fluxo de dados

```
[Browser/PWA] ──Server Actions/Route Handlers──▶ [core services] ──▶ [Supabase Postgres + RLS]
      │                                                                   │
      │◀──────────── Realtime (mensagens, avistamentos novos) ───────────┘
      │                                                                   │
      │                                    triggers ──▶ fila `job_queue` ──▶ Edge Functions
      │                                                   (matching, notify-guardians, web push)
```

- Leitura pública (alerta, mapa): via **views públicas** (`public_lost_cases_v`, etc.) que só expõem colunas seguras e o ponto **aproximado**.
- Escrita: sempre com usuário autenticado (incluindo anônimo) + RLS.
- Chave `service_role` só em Edge Functions / server, nunca no cliente.

## 4. Auth

- E-mail (magic link e senha) + Google OAuth no MVP; Apple e telefone na Fase 2.
- **Anonymous sign-in** para avistamento/encontrei sem cadastro; conversão para conta real via `linkIdentity`/`updateUser`.
- Tabela `profiles` criada por trigger em `auth.users`.
- Roles: `user` (padrão), `moderator`, `admin` em `profiles.role`; checagem em RLS via função `is_admin()` (`security definer`).
- Middleware Next protege `/perfil`, `/publicar/*` (exceto avistamento), `/empresa`, `/admin`.

## 5. Storage

Buckets:
- `pet-photos` (público, caminhos com UUID, sem EXIF — removido no cliente para não vazar GPS da foto).
- `sighting-media` (público após moderação automática simples).
- `posters` (público, gerado sob demanda e cacheado).
- `private-docs` (privado; prova de posse, documentos de ONG).

Limites: 8 MB por arquivo, apenas `image/jpeg|png|webp` (vídeo na Fase 2 — custo/moderação).

## 6. Mapas

```ts
interface MapProvider {
  mount(el: HTMLElement, opts: MapOptions): MapHandle
}
interface MapHandle {
  setCenter(p: LatLng, zoom?: number): void
  setPins(pins: MapPin[]): void            // pin = {id, kind: 'lost'|'found'|'sighting'|'adoption'|'business', latLng}
  drawPath(points: LatLng[]): void         // timeline cronológica
  onMove(cb: (bbox: BBox) => void): Unsubscribe
  onPinClick(cb: (id: string) => void): Unsubscribe
  enablePicker(cb: (p: LatLng) => void): void
  destroy(): void
}
```
Implementação `MapLibreProvider` no MVP. Consultas por bbox/raio feitas no Postgres (`ST_DWithin`, índice GiST) — nada de regra de negócio no provider.

## 7. Notificações

1. Insert em `lost_cases` (status `ACTIVE`) → trigger enfileira `notify_guardians`.
2. Edge Function busca `guardian_settings` com `ST_DWithin(home_area, case.point, radius)`.
   - `home_area` = ponto **aproximado** escolhido pelo Guardião (não GPS contínuo).
3. Antispam: máx. N alertas/dia por Guardião (configurável), deduplicação por caso, silêncio noturno opcional.
4. Cria `notifications` (in-app, via Realtime) + envia Web Push se houver `push_subscriptions`.

## 8. Radar MEL (matching)

- Função SQL `compute_match_score(lost, found_or_sighting)` → 0–100:
  espécie (gate), distância (decay até 10 km), janela de tempo, porte, sexo, cor principal/secundárias, raça (fuzzy, peso baixo).
- Executada por trigger (via fila) ao criar `found_cases`/`sightings` e ao criar `lost_cases`.
- Resultados ≥ limiar em `case_matches` com `score`, `reasons jsonb`, `algorithm_version`.
- Coluna `image_embedding vector` reservada (pgvector) para IA visual na Fase 2.
- UI sempre: **"Possível correspondência — 82%"**.

## 9. Segurança

- RLS em **todas** as tabelas; testes pgTAP por tabela.
- Views públicas com colunas whitelisted; contato (telefone/WhatsApp) só se `contact_*_public = true`.
- Rate limit por usuário/IP em ações de escrita (função `check_rate_limit`).
- Turnstile em sessão anônima.
- Remoção de EXIF; nenhum endereço residencial em seed ou UI.
- `audit_logs` para toda ação de moderação/admin.

## 10. LGPD

- Consentimentos registrados (`consents`: tipo, versão, data, revogado_em).
- `/perfil/privacidade`: exportar dados (JSON gerado por Edge Function), excluir conta (anonimiza casos públicos resolvidos, remove PII), revogar consentimentos, preferências de comunicação.
- Sem rastreamento contínuo de localização; Guardião usa área fixa aproximada.
- Retenção: avistamentos anônimos de casos encerrados têm mídia removida após 180 dias (job `pg_cron`).

## 11. Deploy

- `main` → Vercel production; PRs → preview deploys.
- Migrations aplicadas por `supabase db push` no CI (GitHub Actions) após testes.
- Ambientes: `dev` (local/cloud dev), `prod`.
- `.env.example` com: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `NEXT_PUBLIC_MAPTILER_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `NEXT_PUBLIC_SITE_URL`.
