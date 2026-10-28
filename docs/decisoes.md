# Registro de decisões

Formato: data — decisão — motivo.

- **2026-10-27 — Supabase Cloud (`mel-dev`) para desenvolvimento, sem Docker.** Máquina sem Docker. Testes de RLS rodam via supabase-js contra o projeto dev (`packages/data/tests`), em vez de pgTAP local.
- **2026-10-27 — MapLibre + MapTiler (free).** Sem cartão, bom geocoding no Brasil, trocável via `MapProvider`/`Geocoder`.
- **2026-10-28 — npm workspaces em vez de pnpm.** pnpm exige instalação global (sem permissão de admin). Mesma estrutura de monorepo.
- **2026-10-28 — Next.js 16 com Cache Components.** Versão atual do create-next-app. Dados de requisição ficam atrás de `<Suspense>`; o resto vira shell estático (bom para conexões móveis).
- **2026-10-28 — Chaves novas do Supabase (`sb_publishable_` / `sb_secret_`).** Substituem `anon`/`service_role` legadas e podem ser rotacionadas sem derrubar sessões. Variáveis: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
- **2026-10-28 — Um `.env.local` na raiz.** Carregado pelo `next.config.ts` e pelos testes de banco; `npm run env:pull` preenche sem exibir valores.
- **2026-10-28 — Privilégios por coluna em `profiles`.** RLS limita linhas; `GRANT UPDATE (colunas)` impede que o usuário altere `role`, `is_anonymous` ou `suspended_at` do próprio perfil.
- **2026-10-28 — Funções `security definer` no schema `private`.** Não ficam expostas pela API REST; `search_path = ''` em todas.
- **2026-10-28 — Visitante sem sessão não tem privilégio em `profiles`.** Dados públicos de usuário (nome, avatar) virão por view específica (M2).
- **2026-10-28 — Ações da home desabilitadas até cada fluxo existir.** Regra de qualidade: nada de link falso; o botão aparece com "Em breve".
- **2026-10-28 — Tokens em `packages/ui-tokens` (TS + CSS) com teste de paridade e contraste WCAG AA.** O TS é usado onde não há CSS (cartazes, OG, Expo).
