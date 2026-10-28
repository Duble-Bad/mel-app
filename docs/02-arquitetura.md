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
