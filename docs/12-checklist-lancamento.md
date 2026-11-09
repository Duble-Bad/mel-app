# MEL — Checklist de lançamento

> Consolidada na auditoria final do MVP (2026-11-03). Tudo aqui depende do lançamento: **não** é bug do DEV.
> Nada desta lista foi executado. Cada item de produção precisa de autorização do dono; segredos só ele manuseia.
> Detalhes de cada item: [10-status.md](10-status.md) (M17), [08-deploy-producao.md](08-deploy-producao.md) (schema), [11-email-producao.md](11-email-producao.md) (SMTP).

## 0. Antes de tudo (decisões e licenças — R$ 0)

Diagnóstico de 2026-11-05 ([10-status.md](10-status.md#-prontidão-para-o-piloto-diagnóstico-de-2026-11-05)). Sem estes itens, nada de configuração de produção.

| # | Item | Por quê |
|---|---|---|
| 0.1 | ✅ **Decidido (2026-11-05): MapTiler Free.** Condição: piloto sem receita/patrocínio ("non-commercial use") | Os termos limitam o Free a uso não comercial sem definir o termo. Se "não": plano pago ou troca de mapa (exige código; plano no `13`) |
| 0.2 | ✅ **Decidido (2026-11-05): Vercel Hobby.** Condição: sem receita, anúncios, patrocínio ou ofertas patrocinadas ("non-commercial personal use only") | Só serve sem receita, anúncios, patrocínio ou ofertas patrocinadas; senão, plano pago |
| 0.3 | **Resend Free** e **Turnstile**: conferir as condições de uso | Não verificadas; nenhum serviço gratuito é presumido adequado |
| 0.4 | **Domínio próprio**: decisão do dono (único custo inevitável, ~R$ 40/ano) | Sem domínio não há SMTP (recuperação de senha), Site URL nem chaves restritas por domínio |
| 0.5 | **Restaurar o `mel-prod`** (pausado pelo plano Free) | Visto INACTIVE em 2026-11-04; restaurar é grátis, no painel |

## 1. Código que precisa existir antes de ligar a configuração

| # | Item | Por quê |
|---|---|---|
| 1.1 | ✅ **Feito (2026-11-03, Launch Readiness 1).** **Captcha do Supabase Auth no código**: `captchaToken` em `ensureSession` (sessão anônima), cadastro, login e recuperação de senha; widget Turnstile também no "Denunciar" (`ReportButton`) | Ligar o captcha no painel sem isso quebra avistamento, chat, encontrado, denúncia e login. Sem captcha, sessões anônimas descartáveis ficam contidas só pelo limite por IP e pelos tetos da migration 27 |

As correções escolhidas na auditoria final para antes do Feature Freeze ficam fora desta lista (são produto, não configuração).

## 1.1 Antes do piloto (DEV)

| # | Item | Por quê |
|---|---|---|
| 1.1.1 | Remover os casos de demonstração: `node --env-file=.env.local scripts/demo-casos/demo.mjs remover` | Os 9 casos "DEMO" só existem para teste no `mel-dev`; nunca vão para produção |

## 2. Schema (`mel-prod`) — procedimento de [08-deploy-producao.md](08-deploy-producao.md)

| # | Item | Observação |
|---|---|---|
| 2.1 | Checks verdes no commit que vai para produção | Pre-flight confere pela API do GitHub |
| 2.2 | Aplicar as migrations **24–45** | 24 (Radar v2) e 29 (avistamentos) são P0 de privacidade; 30 traz o push do tutor; 31 recupera push preso; 32 muda o ponto público para 100 m; 33–38 fila de adoção; 39 parceiros (CPF cifrado, CNPJ); 40 LGPD. 41 chat de adoção; 42–43 CPF/dados pessoais; 44–45 adoção no mapa (padrão desligado) e endereço público de parceiros. Pre-flight e pós-deploy já esperam 45. Antes: configurar as chaves `MEL_PII_*` no servidor |
| 2.3 | Pós-deploy aprovado (catálogo + impressão digital) | Reprovado → não seguir |
| 2.4 | `scripts/sighting-media-neutral-names.mjs` (listar → `--apply` → conferir 0/0) | Passo a passo no `08`. Se listar 0 e 0, nada a fazer |

## 3. Hospedagem do app (Vercel)

| # | Item | Observação |
|---|---|---|
| 3.1 | Domínio próprio + deploy do app | Pré-requisito do SMTP, do Google e das chaves restritas por domínio |
| 3.2 | `NEXT_PUBLIC_SITE_URL=https://<domínio>` **no build** (no `.env.example` ela está comentada, porque no dev não é necessária) | Sem ela, o QR do cartaz e a prévia do link (og:image) podem apontar para `*.vercel.app` |
| 3.3 | Secrets do servidor: `SUPABASE_SECRET_KEY`, `PUSH_DISPATCH_SECRET`, `TURNSTILE_SECRET_KEY`, `VAPID_PRIVATE_KEY` | Nunca no repositório |
| 3.4 | Variáveis públicas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_AUTH_GOOGLE` | Públicas entram no build: mudar exige novo deploy |
| 3.8 | **Validar a prévia do link no Facebook com o domínio público** (não dá em DEV: o endereço de DEV aponta para IP de rede privada, inalcançável pelo robô do Facebook, e o certificado é da CA local). No [Sharing Debugger](https://developers.facebook.com/tools/debug/) colar um alerta real: conferir título, descrição, URL canônica e a imagem 1200×630 com a foto; usar “Scrape Again” depois de mudanças. Repetir no WhatsApp | Só com autorização para teste em ambiente público. Até lá, o compartilhamento no Facebook abre, mas a prévia **não está validada** |
| 3.6 | *(pode ficar para depois do piloto)* **Content-Security-Policy completa** (hoje só `frame-ancestors`; os outros headers de segurança já estão no `next.config.ts`) | Levantar as origens reais: Supabase (REST, Auth, Realtime wss, Storage), MapTiler (API, tiles, fontes, worker blob), Turnstile (script e iframe), Google (OAuth) e os scripts inline do Next (nonce). Testar em modo `Report-Only` antes de impor |
| 3.5 | *(pode ficar para depois do piloto: o push já sai após cada ação)* **Agendador** (código pronto, 2C): `CRON_SECRET` (≥ 32 caracteres) na Vercel + `"crons": [{ "path": "/api/push/dispatch", "schedule": "0 9 * * *" }]` em `apps/web/vercel.json` (Hobby: 1×/dia; 09:00 UTC = 06:00 em Brasília). Outro agendador: `GET`/`POST` com `Authorization: Bearer $PUSH_DISPATCH_SECRET` | Reenvia push que ficou para trás e **apaga as fotos órfãs** do `sighting-media`. Sem ele, nada é apagado. Conferir no log da Vercel a 1ª execução (200) |
| 3.7 | **Região das funções**: `apps/web/vercel.json` já pede `gru1` (São Paulo, junto do Supabase `sa-east-1`). Exige *Root Directory* = `apps/web` no projeto Vercel | Confirmar no 1º deploy: painel → Deployment → Functions → Region `gru1` (sem isso, o padrão é `iad1`, EUA) |
| 3.8 | ⏸️ **Pendente por decisão do dono (2026-11-05): nenhum provedor contratado; backup NÃO operacional, risco aceito.** Quando houver decisão: **Backup diário** (código e ensaio prontos, 2E; ver [14-backup-restauracao.md](14-backup-restauracao.md)): repositório privado separado com o workflow agendado, chave pública age, bucket externo com retenção de 30 dias, alerta de falha, string do Session pooler | O Supabase Free não tem backup. Antes de abrir ao público: 1 backup real + 1 restauração de teste num projeto descartável. Guardar a chave privada age e a VAPID privada fora do computador |

## 4. Supabase `mel-prod` (painel — nunca `supabase config push`)

| # | Item | Observação |
|---|---|---|
| 4.1 | API: schemas expostos sem `private` | |
| 4.2 | Site URL + Redirect URLs (`/auth/callback**`) do domínio | Os templates de e-mail usam `{{ .SiteURL }}` |
| 4.3 | **SMTP próprio** (Resend, e-mail da MEL) + templates pt-BR + depois **"Confirm email" ON** | Sem SMTP, a recuperação de senha não chega a ninguém. Passo a passo no `11` |
| 4.4 | *(pode ficar para depois do piloto)* Google OAuth (só depois do 4.3) + manual linking + `NEXT_PUBLIC_AUTH_GOOGLE=on` | Tela de consentimento publicada com links de `/privacidade` e `/termos` |
| 4.5 | Rate limits de Auth: anônimos **30/h por IP** (o `mel-dev` está em 300/h só para testes), logins nos padrões | |
| 4.6 | Captcha do Auth: Authentication → Bot and Abuse Protection → Turnstile, com o **segredo de produção** do Turnstile (o mesmo par de 5.1) | O código (1.1) já está pronto. Ligar **depois** do deploy do app com as chaves de produção (5.1): a site key do app e o segredo no Supabase têm de ser do mesmo widget. Conferir no smoke test: avistamento, chat, encontrado, denúncia, cadastro, login e recuperação |

## 5. Chaves de terceiros

| # | Item | Observação |
|---|---|---|
| 5.1 | Turnstile de produção (site key + secret) restrito ao domínio | As do dev são as chaves de **teste** (sempre aprovam) |
| 5.2 | MapTiler de produção restrita ao domínio | Acompanhar a cota: a página do alerta carrega o mapa |
| 5.3 | VAPID novo para produção | Nunca reutilizar o do dev |

## 6. Operação e validação

| # | Item | Observação |
|---|---|---|
| 6.1 | Primeiro moderador: `npm run admin:role -- <email> moderator --confirm-target=<ref>` | |
| 6.2 | Revisão jurídica de termos e privacidade | Incluir o que fica depois da exclusão de conta (avistamentos anônimos, com local e texto) |
| 6.3 | Smoke test manual como usuário real (no DEV, 2026-11-05: 3 rodadas visuais de E2E 76/76 e ~120 telas revisadas; falta repetir em produção, num celular de verdade, com push, e-mail e Google reais) | Alerta → cartaz → compartilhar no WhatsApp (**conferir a prévia**: imagem aparece, tamanho e tempo a frio); avistamento anônimo; chat; push num celular real (no iPhone, com a MEL na Tela de Início); e-mail de recuperação de senha |
| 6.4 | Concluir o M17 em [10-status.md](10-status.md) | |

## Fora do caminho crítico (pós-lançamento)

- `pet-photos` com nome neutro (UUID do dono no caminho público) — ver pendência em [10-status.md](10-status.md).
- Limpeza de usuários anônimos antigos/órfãos.
- Isolamento dos testes no `mel-dev` (a limpeza do E2E apaga todo anônimo criado durante a execução, inclusive de um CI simultâneo; marcar os anônimos de teste e pôr `concurrency` no CI).
