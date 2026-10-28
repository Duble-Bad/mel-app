# MEL — Movimento de Encontro e Localização

> **Uma rede inteira procurando com você.**
> Começou por uma Mel. Agora é por todos eles.

Plataforma geolocalizada de proteção animal: alertas de pets perdidos, animais encontrados, avistamentos, adoção e parceiros locais. KPI principal: **pets reencontrados**.

## Documentação

| | |
|---|---|
| [Product spec](docs/01-product-spec.md) | personas, jornadas, fases, decisões revisadas |
| [Arquitetura](docs/02-arquitetura.md) | stack, camadas, auth, mapas, notificações, LGPD |
| [Banco de dados](docs/03-database.md) | schema planejado, índices, RLS |
| [Telas](docs/04-telas.md) | todas as rotas |
| [Fluxos](docs/05-fluxos.md) | Perdi / Encontrei / Avistamento / Reencontro |
| [Milestones](docs/06-milestones.md) | plano de implementação e status |
| [Decisões](docs/decisoes.md) | registro de decisões arquitetônicas |

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · Tailwind CSS 4 · Supabase (Postgres 17 + PostGIS, Auth, Storage, Realtime) · MapLibre + MapTiler · Vitest · Playwright · npm workspaces.

## Estrutura

```
apps/web/            Next.js — só UI e rotas
  app/               rotas (App Router)
  components/        componentes de interface
  lib/               adaptadores do app (env, clientes Supabase)
packages/core/       regras de negócio puras (geo, ports, schemas) — reaproveitável no Expo
packages/data/       acesso a dados (Supabase) + testes de RLS
packages/ui-tokens/  design tokens (única fonte de cores)
supabase/            config, migrations, seed
e2e/                 testes Playwright (viewport mobile)
scripts/             utilitários (env:pull)
docs/                especificação e decisões
```

Regra: componentes nunca falam com o Supabase diretamente — passam por `@mel/data`, que implementa contratos de `@mel/core`.

## Setup local

Pré-requisitos: Node ≥ 20.9 (testado no 24), conta Supabase com acesso ao projeto `mel-dev`.

```bash
npm install
npx supabase login            # em um terminal interativo (PowerShell/Terminal)
npx supabase link --project-ref <ref-do-mel-dev>
npm run env:pull              # grava URL e chaves do Supabase em .env.local, sem exibi-las
# adicione NEXT_PUBLIC_MAPTILER_KEY ao .env.local (veja .env.example)
npm run dev                   # http://localhost:3000
```

Existe **um único `.env.local`, na raiz** — usado pelo app e pelos testes de banco.

### Variáveis de ambiente

Veja [.env.example](.env.example). `SUPABASE_SECRET_KEY` ignora RLS: só servidor e testes, nunca no navegador.

## Autenticação

- **E-mail + senha** (sem confirmação de e-mail por enquanto — ver `docs/decisoes.md`).
- **Sessão anônima** para quem só quer ajudar (avistamento, "encontrei", 1ª mensagem ao tutor): `ensureSession()` em `@mel/data`. Antes de publicar, ative o captcha do Supabase Auth (ver `docs/decisoes.md`).
- **Google**: aparece quando `NEXT_PUBLIC_AUTH_GOOGLE=on`. Para ativar:
  1. Google Cloud Console → APIs e serviços → Credenciais → *Criar ID do cliente OAuth* (Aplicativo da Web).
  2. URI de redirecionamento autorizado: `https://<project-ref>.supabase.co/auth/v1/callback`.
  3. Supabase → Authentication → Sign In / Providers → Google: cole Client ID e Client Secret.
  4. `NEXT_PUBLIC_AUTH_GOOGLE=on` no `.env.local`.
- Configuração de Auth versionada em `supabase/config.toml`; aplique com `npx supabase config diff` (revisar) e `npx supabase config push`.

## Mapas e localização

- **MapLibre GL + MapTiler** atrás de `MapProvider` (`apps/web/lib/map/maplibre.ts`) e `Geocoder` (`packages/core/src/adapters/maptiler-geocoder.ts`). Trocar de fornecedor = escrever outro adaptador.
- O worker do MapLibre é copiado para `apps/web/public/vendor/` automaticamente antes de `dev`/`build`.
- Restrinja a chave do MapTiler às suas origens (painel MapTiler → API keys → Allowed HTTP origins).
- Páginas internas de verificação (ex.: `/dev/local`, seletor de local) só existem com `MEL_DEV_ROUTES=1` no build — os testes E2E definem a variável; produção não.

## Banco de dados (Supabase)

Desenvolvimento usa um projeto Supabase Cloud dedicado (`mel-dev`, região São Paulo) — sem Docker local.

```bash
npx supabase migration new <nome>   # cria supabase/migrations/<timestamp>_<nome>.sql
npm run db:push                     # aplica migrations pendentes no projeto linkado
npm run db:types                    # regenera packages/data/src/database.types.ts
```

Nunca edite uma migration já aplicada — crie outra.

```bash
npm run db:seed                     # dados de demonstração FICTÍCIOS (recria os pets das contas demo)
```

O seed cria as contas `demo.tutora@exemplo.com` (Mel — Yorkshire, pública; Thor — privado) e `demo.vizinho@exemplo.com` (Nina — gata). Os MEL IDs mudam a cada execução; o script os imprime.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `start` | build e servidor de produção |
| `npm run typecheck` | TypeScript em todos os pacotes |
| `npm run lint` | ESLint |
| `npm run test` | testes unitários (Vitest) |
| `npm run test:db` | testes de RLS/RPC contra o `mel-dev` (cria e remove usuários de teste) |
| `npm run test:e2e` | E2E Playwright (Pixel 7) — sobe o servidor sozinho |
| `npm run check` | typecheck + lint + unit |
| `npm run env:pull` | atualiza chaves do Supabase no `.env.local` |
| `npm run db:seed` | dados de demonstração fictícios |

## Deploy

Planejado: Vercel (web) + Supabase Cloud (produção em projeto separado, região `sa-east-1`). CI no GitHub Actions (`.github/workflows/ci.yml`) roda typecheck, lint, unit, RLS e E2E; requer os secrets listados no workflow.

## Privacidade

Dados de demonstração são fictícios. Nunca use telefones, endereços ou dados pessoais reais (inclusive da família da Mel) em seed, testes ou capturas.
