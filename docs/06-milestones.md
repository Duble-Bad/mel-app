# MEL — Milestones de implementação

Cada milestone termina com: `tsc --noEmit` ✔ · `lint` ✔ · testes ✔ · fluxo verificado no navegador (viewport mobile) ✔.

| # | Milestone | Entregável testável | Testes |
|---|---|---|---|
| **M1** ✅ | Fundação | Monorepo (pnpm), Next.js + Tailwind + tokens, `packages/core` e `data`, Supabase ligado, migration base (extensões, profiles, enums), `.env.example`, README, CI | build + lint + 1 E2E "home carrega" |
| **M2** ✅ (Google pendente de credenciais) | Auth + onboarding + perfil | Entrar com e-mail/Google, sessão anônima, onboarding de 1 tela, página de perfil, middleware de rotas | E2E cadastro/login; pgTAP RLS profiles |
| **M3** ✅ | Pets + MEL ID + fotos | CRUD de pet, upload com compressão e remoção de EXIF, campos privados separados, `/pet/[melId]` | unit (schemas), pgTAP pets/private, E2E criar pet |
| **M4** ✅ (`nearby_cases` → M5) | Mapa + LocationPicker | `MapProvider` (MapLibre), GPS, pin arrastável, geocoding, `nearby_cases` RPC | unit geo/fuzz, E2E escolher local |
| **M5** ✅ | **Perdi meu pet** | Wizard 6 passos com rascunho, `lost_cases`, sucesso, `/alerta/[code]` com OG dinâmico | E2E fluxo completo < 2 min, RLS lost_cases |
| **M6** ✅ (avistamento solto → M10) | Avistamento + timeline | `/avistamento/[code]` anônimo, Turnstile, rate limit, timeline + caminho no mapa, notificação in-app ao dono (Realtime) | E2E anônimo envia → dono vê; RLS sightings |
| **M7** ✅ | Compartilhar + QR + cartaz | ShareSheet (WhatsApp, Web Share, copiar), QR, cartaz 1:1 / 9:16 / 16:9 PNG + A4 imprimível | unit QR/URL, E2E baixar cartaz |
| **M8** ✅ | Chat | Conversas por caso, Realtime, bloquear/denunciar, aviso antigolpe | E2E dono ↔ anônimo; RLS mensagens/blocks |
| **M9** ✅ | Reencontro | Fluxo R1–R4, estado "ESTÁ EM CASA", card ENCONTRADO, agradecimento | E2E; ✅ **cenário "sumiu há 15 min" ponta a ponta** |
| **M10** ✅ | Encontrei um pet + Radar MEL | Wizard, `found_cases`, `compute_match_score`, MatchCard, `/perfil/correspondencias`, contato com tutor | unit score, E2E ✅ **cenário "encontrei na rua" ponta a ponta** |
| **M11** ✅ | Mapa/Radar público + filtros | `/mapa`, `/perdidos`, `/encontrados`, filtros tipo/espécie/período/raio, paginação | E2E filtros |
| **M12** ✅ | Guardião + push | `/guardiao`, área aproximada, Edge Function `notify-guardians`, Web Push, limites antispam, central de notificações | unit antispam, integração fila |
| **M13** ✅ | Denúncias + admin mínimo | ReportDialog em todo conteúdo, `/admin` (contagens reais, denúncias, ocultar/suspender), audit log | RLS admin, E2E denúncia → moderação |
| **M14** | Adoção básica | Listagem, página, cadastro (moderado), formulário de interesse, status AVAILABLE/IN_PROCESS/ADOPTED | E2E adoção |
| **M15** | Parceiros básicos | Cadastro de empresa (aprovação admin), diretório + mapa, perfil, ofertas rotuladas "Patrocinado" quando aplicável; `plans` seed sem cobrança | E2E cadastro → aprovação → aparece |
| **M16** | LGPD + PWA + polimento | Exportar/excluir conta, consentimentos, manifest + service worker, offline básico, auditoria de acessibilidade, performance (Lighthouse mobile) | E2E exclusão; Lighthouse ≥ 90 a11y |

Seed (a partir de M3, ampliado a cada milestone): Mel (Yorkshire, demonstrativa) e outros pets fictícios em São Paulo/SP com coordenadas de praças públicas, usuários `@exemplo.com`, telefones `(11) 90000-000X` — nenhum dado real.

**Antes do M1 preciso de 2 decisões suas** (ver resposta no chat).
