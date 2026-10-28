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
- **2026-10-28 — Login: e-mail + senha (sem confirmação) e Google; código por e-mail adiado.** O plano gratuito do Supabase, com o envio de e-mail padrão, não permite personalizar templates e limita a ~2 e-mails/hora. Isso inviabiliza o código de 6 dígitos em pt-BR (preferível no celular: link mágico troca de navegador e perde o rascunho). Ao ter domínio próprio + SMTP (ex.: Resend): ativar `supabase/templates/codigo.html`, ligar `enable_confirmations` e oferecer "entrar com código". Risco temporário: contas com e-mail não verificado — mitigado por rate limit do Supabase e, no M6, captcha.
- **2026-10-28 — Auth no data layer (`@mel/data/auth`), chamado do navegador.** Mesmo código servirá ao app Expo; erros do Supabase viram mensagens humanas em pt-BR (`AuthError`).
- **2026-10-28 — `proxy.ts` renova a sessão e barra `/perfil` e `/onboarding` para visitantes e sessões anônimas.** Páginas verificam de novo (`requireOnboardedProfile`) e o banco aplica RLS.
- **2026-10-28 — Leituras de sessão chamam `connection()`.** Com Cache Components, o auth-js usa `Date.now()`; sem isso o Next tenta pré-renderizar e falha.
- **2026-10-28 — Fotos reduzidas e re-codificadas no navegador (`lib/images.ts`).** Menos dados móveis e remoção do EXIF/GPS antes do upload.
- **2026-10-28 — Tokens em `packages/ui-tokens` (TS + CSS) com teste de paridade e contraste WCAG AA.** O TS é usado onde não há CSS (cartazes, OG, Expo).
