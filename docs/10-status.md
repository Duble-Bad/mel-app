# MEL — Onde estamos (status e próximos passos)

> Atualizado em 2026-11-05. **MVP em Feature Freeze desde o commit `46f3238`**; série Launch Readiness (1, 2A–2L) concluída no código e na documentação; último CI verde em `25561fe`.
> **Decisão de 2026-11-05:** o piloto segue nos planos gratuitos do **MapTiler** e da **Vercel (Hobby)**. **Próxima ação única:** decidir o domínio próprio (checklist 0.4).
> Leia isto primeiro ao retomar o projeto. Para o lançamento, a lista completa está em [12-checklist-lancamento.md](12-checklist-lancamento.md).

## 🚦 Prontidão para o piloto (diagnóstico de 2026-11-05)

Prioridade do proprietário: colocar a MEL no ar para ajudar tutores, com custo operacional
**R$ 0** sempre que possível. Nenhum serviço pago e nenhuma funcionalidade nova.

**Pronto:** MVP congelado (alerta + cartaz/QR, avistamentos com privacidade, encontrados e
Radar, conversa, push de tutor e Guardião, adoção e parceiros moderados, mapas); 31
migrations validadas do zero; RLS, privacidade, push e agendador testados; captcha,
headers, anti-abuso, recuperação de push (31), agendador autenticado e região `gru1` no
código; procedimento de deploy com pre-flight e pós-deploy.

**Impede o lançamento:**

| Tipo | Item |
|---|---|
| Técnico | `mel-prod` **pausado** (INACTIVE, visto em 2026-11-04): restaurar no painel (grátis) |
| Técnico / privacidade | migrations **24–31** pendentes no `mel-prod` (24 e 29 são P0: sem elas o público vê o ponto exato do avistamento) |
| ~~Licença~~ | **Decidido (2026-11-05):** seguir no MapTiler Free e na Vercel Hobby. Condição: piloto **sem** receita, anúncio, patrocínio ou oferta patrocinada (os termos dos dois são "não comercial"); se isso mudar, rever os planos antes |
| Licença | Resend Free e Turnstile: condições de uso não verificadas |
| Configuração | domínio próprio — **único custo inevitável** (~R$ 40/ano; decisão do proprietário): sem ele não há SMTP nem recuperação de senha |
| Configuração | Vercel (Root Directory `apps/web`, variáveis e secrets de produção, `NEXT_PUBLIC_SITE_URL`); Supabase de produção (URLs, SMTP Resend, captcha, anônimos 30/h); chaves de produção restritas ao domínio (Turnstile, VAPID novo, MapTiler); primeiro moderador; smoke test |

**Risco aceito (decisão de 2026-11-05):** backup externo **pendente e não operacional**; o
Supabase Free não faz backup. Perda do banco hoje seria irrecuperável. Ver [14](14-backup-restauracao.md)–[17](17-armazenamento-sao-paulo.md).

**Depois do piloto:** Google OAuth; CSP completa; cron diário (o push já sai após cada ação);
backup externo; troca de mapa (plano no [13](13-mapas-fornecedores.md)); revisão jurídica
formal (após aprovação dos textos atuais pelo dono); teste instável `lostcase-lifecycle`
(1 falha transitória em `89bdeb9`, verde na 2ª tentativa).

**Sequência mínima (sem contratar):** 1) ~~licenças~~ (decidido: MapTiler Free e Vercel Hobby) e conferir Resend Free e Turnstile; 2) decidir/registrar domínio;
3) restaurar o `mel-prod`; 4) migrations 24–31 + pós-deploy ([08](08-deploy-producao.md));
5) Auth/SMTP/captcha no `mel-prod`; 6) chaves de produção; 7) deploy na Vercel e conferir
`gru1`; 8) primeiro moderador; 9) smoke test; 10) abrir o piloto sem ofertas patrocinadas.
Detalhe de cada item: [12-checklist-lancamento.md](12-checklist-lancamento.md).

## 🧊 MVP Feature Freeze (2026-11-03)

Autorizado pelo dono sobre o commit **`46f3238`**. Estado congelado:

- **31 migrations**, todas aplicadas no `mel-dev` e validadas do zero (impressão digital versionada); **24–31 pendentes no `mel-prod`**.
- **P0 encerrados:** Radar Privacy (24) e Sighting Privacy (29, completado na 30 com o rótulo público do avistamento).
- **P1 encerrados:** tratamento de erros, ciclo de vida do alerta (25), moderação de adoção/parceiros (26), anti-abuso (27) e limpeza de fotos órfãs (28).
- **Quick wins do benchmark:** cartaz acionável, antigolpe concreto, orientação de fotos do pet.
- **Pacote pré-freeze:** push para o tutor (avistamento, mensagem, Radar), rótulo público do avistamento (30), headers de segurança, mapa sob demanda.
- **CI verde** em `46f3238`: verificações rápidas; banco contra o `mel-dev` (23 arquivos ✅, 2 pulados) + E2E 70/70; reconstrução do zero (24 arquivos ✅, 1 pulado; impressão digital idêntica).
- **`mel-prod` intocado** desde o primeiro deploy (23 migrations, 2026-10-29).

**Regra a partir deste marco:** nenhuma funcionalidade nova entra no MVP. Só podem ser autorizadas, uma a uma e separadamente:

1. correções de **segurança**;
2. correções de **regressão**;
3. **requisitos indispensáveis ao lançamento** ([12-checklist-lancamento.md](12-checklist-lancamento.md) — ex.: captcha do Auth no código, CSP completa).

Ideias de produto (MEL ID + QR permanente, Ponto de Apoio, CTA de instalação do PWA, vitrine de reencontros, contadores públicos, Alerta Turbinado, monetização, plaquinha/NFC…) ficam para depois do lançamento.

## Resumo

- **Produto (M1–M16): concluído** em desenvolvimento ([06-milestones.md](06-milestones.md)); **Feature Freeze** em `46f3238` (acima).
- **Produção:** schema aplicado e verificado no `mel-prod` (pós-deploy 100% ✅). Auth básico ajustado pelo dono no painel (abaixo). O app não está publicado.
- **Etapa atual:** Launch Readiness concluído no código (até 2L). **Próxima etapa: lançamento do piloto (M17)**, na sequência mínima de "Prontidão para o piloto", só com autorização do dono, item a item. Licenças decididas (MapTiler Free e Vercel Hobby, 2026-11-05). Próxima ação única: decidir o domínio próprio.

## ⏸️ Produção pausada (decisão de 2026-10-30)

Todo o trabalho de produção está **pausado** até o produto estar funcionalmente pronto em DEV: nada de domínio, SMTP/Resend, "Confirm email", Google OAuth, Manual Linking, alterações no `mel-prod` ou deploy. Os itens abaixo ficam como **pendências de lançamento**; o foco agora é o produto (auditoria funcional em DEV).

## Último CI

**3 rodadas visuais de E2E depois da correção (2026-11-05, `763a6b3`):** 76/76 ✅ em cada uma — rodada 1 no navegador visível para o dono, devagar (8,5 min); rodadas 2 e 3 em segundo plano (6,5 e 6,3 min). Sem novas tentativas automáticas; nenhuma falha; servidor só com os erros provocados pelo próprio teste (`/dev/erro`). Não cobre celular físico, push real, e-mail real nem Google real (ficam para o smoke test manual da produção).

**Teste visual (2026-11-05):** ~120 telas revisadas (celular claro/escuro, computador, fim de cada um dos 76 cenários). 1 defeito: cabeçalho duplicado em "Não encontramos esta página" dentro do app — **corrigido** (`app/(app)/not-found.tsx`, autorizado como correção no Feature Freeze), com E2E conferindo um cabeçalho só. Fotos quebradas e blocos marrons vistos no `mel-dev` são dados deixados pelos testes, não defeito.

**3 rodadas completas de E2E (2026-11-05), build de produção, sem novas tentativas automáticas:** 76/76 ✅ em cada rodada (2,8 · 2,7 · 2,5 min). Logs do servidor sem erro inesperado: só os provocados pelos próprios testes (`/dev/erro`, login social recusado) e o push desligado de propósito (sem chave VAPID).

`25561fe` (2026-11-04, docs 17): ✅ CI e reconstrução do schema. `89bdeb9` (guia 16 + verificação rápida): ✅ CI (na 2ª tentativa, falha transitória em `lostcase-lifecycle`), reconstrução ✅, ensaio de backup ✅. `7d7be25` (migration 31): ✅ nos 3 checks.

Marco do Feature Freeze:
`46f3238` — marco do Feature Freeze: ✅ verde nos 3 checks (banco contra o `mel-dev` 23 arquivos ✅ / 2 pulados, 185 testes; E2E 70/70; reconstrução do zero 24 arquivos ✅ / 1 pulado, impressão digital idêntica).

Anterior: `3f62ebf` — P0 privacidade dos avistamentos (migration 29 + impressão digital): ✅ verde nos 3 checks. Reconstrução do zero com auditoria, impressão digital idêntica, paridade, drift e testes de banco; CI contra o `mel-dev`: banco 22 arquivos ✅ (2 pulados, como sempre: `email-confirmation` e `google-linking`), E2E 69/69 ✅, inclusive o avistamento com os textos novos e a legenda "localização aproximada". O commit anterior (`246fcf2`) ficou vermelho só pela impressão digital ainda não versionada e pelo limite antigo de sessões anônimas do `mel-dev` (30/h).

## Linha do tempo da produção

| Etapa | Estado |
|---|---|
| Auditoria do schema e travas contra produção (`scripts/lib/safe-target.mjs`) | ✅ |
| Reconstrução do zero no CI (`schema-rebuild.yml`), manifesto e impressão digital | ✅ |
| Procedimento de deploy (`scripts/prod/`, [08-deploy-producao.md](08-deploy-producao.md)) | ✅ |
| Deploy das 23 migrations no `mel-prod` (pelo dono, no PowerShell) | ✅ 2026-10-29 |
| Pós-deploy: schema idêntico ao reconstruído; `rls_auto_enable` + `ensure_rls` (plataforma, anteriores ao deploy) aceitos só pela definição exata; 7 event triggers validados | ✅ decisão **MANTER** (`b1ed683`) |
| Auditoria de Auth do código e checklist do painel | ✅ |
| Auth básico no painel do `mel-prod` (informado pelo dono, não conferido por leitura) | ✅ Email ON · Confirm email OFF · Anonymous ON · Manual linking OFF · senha mínima 8 |
| Conversão anônimo → conta por e-mail/senha (mesmo id, contribuições mantidas) | ✅ `e9a42d5` |
| Google: login normal + vínculo à sessão anônima (`linkIdentity`) no código | ✅ `021a5a1` |
| Google Cloud: projeto, tela de consentimento e client OAuth | ⏭️ pode ser feito já (manual, pelo dono) |
| E-mail transacional no código: `/auth/confirmar` (token_hash, qualquer aparelho, só com clique), templates pt-BR, cadastro sem enumeração, testes com "Confirm email" ON | ✅ |
| **Domínio próprio** (pelo dono) | ⏭️ próximo — necessário para SMTP, Site URL e Google |
| **SMTP (Resend) + templates + "Confirm email" ON** (antes de qualquer conta real e antes do Google) | ⏸️ depois do domínio — [11-email-producao.md](11-email-producao.md) |
| Google provider + manual linking no painel do `mel-prod` | ⏸️ depois do item acima |
| Publicação do app (Vercel + domínio) | ⏸️ não iniciado |
| `mel-prod` pausado pelo plano Free (INACTIVE, visto em 2026-11-04) | ⏸️ restaurar no painel antes das migrations |
| Migrations 24–31 no `mel-prod` | ⏸️ pendentes (P0 de privacidade: 24 e 29) |
| Backup externo | ⏸️ pendente por decisão de 2026-11-05 (nenhum provedor contratado; não operacional) |

## Por que o Google espera o "Confirm email" ON

No login com Google, o Supabase **liga automaticamente** a identidade Google a um usuário que já exista com o mesmo e-mail. A proteção contra conta pré-criada (apagar senha/identidades não confirmadas) só roda se esse usuário **não** estiver confirmado. Com "Confirm email" OFF, todo cadastro por e-mail e senha nasce confirmado, então: alguém cadastra o e-mail de outra pessoa com uma senha; quando a dona do e-mail entra com Google, cai nessa conta, e o atacante continua entrando com a senha. Isso independe do "manual linking" e não tem chave para desligar no Supabase.

Por isso: **SMTP próprio → "Confirm email" ON → só então Google ON**, tudo antes de abrir o app ao público (contas criadas com "Confirm email" OFF continuam confirmadas). O código já trata "Confirm email" ON (tela "confira seu e-mail"; conversão do anônimo pelo link do e-mail). Análise em [decisoes.md](decisoes.md).

## Google OAuth (manual, pelo dono)

Nada disso foi feito ainda. O Client Secret é segredo: só no painel do Supabase, nunca no repositório, em `NEXT_PUBLIC_*`, em log ou no chat.

**Google Cloud** (projeto próprio da MEL, conta da MEL — nunca de empregador):

1. Criar o projeto (ex.: "MEL Produção").
2. **OAuth consent screen:** tipo *External*; nome "MEL"; e-mail de suporte da MEL; logo opcional; links de `/privacidade` e `/termos` (**DEPENDE DA URL DE PRODUÇÃO**); escopos só `openid`, `email`, `profile`; publicar o app (sair de *Testing*) antes do lançamento.
3. **Credentials → Create OAuth client ID → Web application.**
   - **Authorized redirect URIs:** só `https://<ref-do-mel-prod>.supabase.co/auth/v1/callback` (o Google volta para o Supabase, não para a MEL).
   - **Authorized JavaScript origins:** não é necessário para o fluxo de redirecionamento usado pela MEL; se o console exigir, a URL pública da MEL (**DEPENDE DA URL DE PRODUÇÃO**).
4. Copiar o Client ID e o Client Secret direto para o painel do Supabase (abaixo).

**Supabase `mel-prod`** (só depois de SMTP próprio + "Confirm email" ON):

1. Authentication → Sign In / Providers → **Google**: Enabled ON; Client ID; Client Secret (colar só aqui); "Skip nonce checks" OFF.
2. Authentication → Sign In / Providers → **Allow manual linking: ON** (necessário para o anônimo manter as contribuições ao entrar com Google; análise de segurança em [decisoes.md](decisoes.md)).
3. Authentication → URL Configuration (**DEPENDE DA URL DE PRODUÇÃO**): Site URL `https://<domínio>`; Redirect URLs só `https://<domínio>/auth/callback**`. Nunca `localhost`, nunca `*.vercel.app`, nunca `/**` no domínio inteiro.
4. Hospedagem do app: `NEXT_PUBLIC_AUTH_GOOGLE=on` (mostra o botão) e `NEXT_PUBLIC_SITE_URL=https://<domínio>`.

Sem a URL de produção, os passos 1, 3 e 4 do Google Cloud já podem ser feitos (o 2 precisa dos links de privacidade/termos). No Supabase, Google e manual linking só depois do "Confirm email" ON; o botão só deve aparecer (`NEXT_PUBLIC_AUTH_GOOGLE=on`) quando Site URL e Redirect URLs estiverem configurados.

## M17 — Configuração de produção (restante, em ordem sugerida)

Tudo no painel do `mel-prod` ou na hospedagem do app. **Nunca** `supabase config push` (o `config.toml` é de desenvolvimento). Cada item precisa de autorização e, quando envolve segredo, é feito pelo dono.

1. **API:** schemas expostos sem `private`.
2. **Auth restante:** Rate Limits nos padrões (anônimos 30/h por IP, logins 30/5 min); captcha do Auth (Bot Protection → Turnstile, com o **segredo de produção** do Turnstile): o código já envia `captchaToken` em sessão anônima, cadastro, login e recuperação (Launch Readiness 1, 2026-11-03).
3. **URLs:** Site URL e Redirect URLs (`/auth/callback`) do domínio final.
4. **SMTP** próprio (Resend; e-mail da MEL, nunca de terceiros/empregador), templates pt-BR do repositório e então **"Confirm email" ON** — passo a passo em [11-email-producao.md](11-email-producao.md). Sem SMTP, a recuperação de senha não chega a usuários reais — **bloqueia o lançamento público**.
5. **Google OAuth:** passo a passo acima (depois do item 4).
6. **MapTiler:** chave de produção restrita ao domínio. **Turnstile:** site key e secret de produção restritas ao domínio (as do dev são as chaves de teste, que sempre aprovam).
7. **Web Push:** gerar par VAPID novo para produção (nunca reutilizar o do dev); agendador de push (`PUSH_DISPATCH_SECRET`), que também **apaga as fotos órfãs** do `sighting-media` (sem ele, nada é apagado).
8. **Secrets do servidor** na hospedagem (`SUPABASE_SECRET_KEY` etc.), nunca no repositório.
9. **Domínio** e deploy do app, com `NEXT_PUBLIC_SITE_URL=https://<domínio>` **no build** (sem ela, o QR do cartaz e a prévia do link podem apontar para `*.vercel.app`).
10. **Primeiro moderador:** `npm run admin:role -- <email> moderator --confirm-target=<ref>`. Scripts administrativos permitidos em produção, sempre com o ref digitado: este e o `sighting-media-neutral-names.mjs` (passo do [deploy de schema](08-deploy-producao.md), depois da migration 29).
11. Smoke test manual como usuário real (sem seed, sem E2E contra produção), incluindo a **prévia do alerta no WhatsApp** (imagem aparece, tamanho e tempo a frio), push num celular real e e-mail de recuperação.

## Pendências conhecidas (antes do lançamento público)

- **Migrations 24 (`20261030120000_radar_public_distance`, Radar v2 — P0 de privacidade), 25 (`20261030140000_lost_case_close_edit`, ciclo de vida do alerta) 26 (`20261030160000_adoption_partner_moderation`, moderação de adoção e parceiros) 27 (`20261030180000_global_abuse_limits`, anti-abuso), 28 (`20261030190000_orphan_media_cleanup`, limpeza de fotos órfãs) 29 (`20261103120000_sighting_privacy`, privacidade dos avistamentos — P0) 30 (`20261103160000_tutor_push_public_place`, push do tutor e rótulo público do avistamento) e 31 (`20261104120000_push_outbox_recovery`, recuperação de push preso) aplicadas só no `mel-dev`; aplicar no `mel-prod` na fase de lançamento** (pre-flight já espera 31). Depois da 29, no lançamento: `node scripts/sighting-media-neutral-names.mjs` (lista; `--apply --confirm-target=<ref>` renomeia fotos antigas, se houver).

- Captcha do Supabase Auth (Turnstile) — fecha a criação de sessões anônimas em série, a origem das sessões descartáveis. **Pronto no código (2026-11-03):** `captchaToken` em `ensureSession` (sessão anônima), cadastro, login e recuperação de senha; o token só é pedido quando o Auth precisa (quem já tem sessão não gasta), e o formulário pega outro para a rota. Denúncia também com Turnstile (`/api/denuncias`). Provado contra o Auth real com captcha ligado (fase do CI `schema-rebuild`, `tests/captcha.test.ts`). Falta só ligar no painel do `mel-prod`. As rotas `/api/avistamentos`, `/api/encontrados` e `/api/conversas` já verificam Turnstile no servidor (`lib/turnstile.ts`; DEV usa as chaves de teste da Cloudflare).
- Agendador do push (`GET`/`POST /api/push/dispatch` com `Authorization: Bearer` + `CRON_SECRET` ou `PUSH_DISPATCH_SECRET`; GET é o do Vercel Cron) também apaga as fotos órfãs do `sighting-media` (mais de 24 h sem avistamento/encontrado, até 100 por chamada). **Código pronto (2C, 2026-11-04)**; o Cron não está ligado — configurar no lançamento (checklist 3.5). Região `gru1` em `apps/web/vercel.json`, a confirmar no 1º deploy (3.7).
- Push preso em `SENDING` (despacho interrompido no meio): **resolvido no `mel-dev` (migration 31, 2D, 2026-11-04)** — reserva expira em 15 min e volta à fila, até 3 vezes e só para avisos de até 6 h; depois, `FAILED`. Não é entrega única: se o serviço de push aceitar e o processo cair antes de registrar, o push pode sair 2 vezes (o `tag` da notificação faz o aparelho substituir em vez de empilhar).
- **Backup (2E, 2026-11-04):** `scripts/backup/` (backup.sh, restore.sh, storage.mjs) + ensaio manual `backup-restore-drill.yml` com dados sintéticos, **verde**: banco + Auth + arquivos voltam iguais num banco novo. Falta ativar (repositório privado, bucket externo, alerta) e provar contra um projeto hospedado — [14-backup-restauracao.md](14-backup-restauracao.md).
- **Backup incremental (2H, 2026-11-04):** só arquivos novos/substituídos são baixados; pontos selados com `.ok`; restauração confere tudo antes e exige `RESTORE_CONFIRM`; retenção de 30 dias pelo script (`prune`). Ensaio com 9 cenários verde. Falta: projeto hospedado e bucket real.
- **Pré-ativação do backup (2I, 2026-11-04):** referência quebrada agora é registrada no ponto e reconciliada antes da carga (antes, um ponto "completo" podia falhar no fim da restauração); `.ok` só depois de conferir os blobs. Fornecedor: Backblaze B2. Procedimento do proprietário, modelo do workflow privado e critérios READY/TESTED/ACTIVE em [15-ativacao-backup.md](15-ativacao-backup.md). Estado: **READY**.
- **Guia de ativação (2K, 2026-11-04):** [16-guia-backup.md](16-guia-backup.md), passo a passo para o proprietário (GitHub privado, B2, chaves age, secrets, healthchecks, workflow manual, checklist do 1º teste). Ajustes: sem Environments no GitHub Free (secrets do repositório), verificação diária rápida + completa mensal, leitura dos `.sha256` numa única chamada.
- **Armazenamento em São Paulo (2L, 2026-11-04):** decisão do proprietário; B2 suspenso. Recomendação: Oracle OCI `sa-saopaulo-1` (US$ 0), alternativa Magalu Cloud `br-se1` (~R$ 2/mês) — [17-armazenamento-sao-paulo.md](17-armazenamento-sao-paulo.md). Aguardando aprovação; guia 16 a refazer para o provedor escolhido.
- **CI isolado (2F, 2026-11-04):** só o job `integration` do `ci.yml` usa o `mel-dev`; ele roda um por vez (`concurrency: mel-dev-shared-database`, sem cancelar quem está rodando). Push em sequência: o do meio pode ser cancelado ANTES de começar (o GitHub guarda só 1 na espera) e o mais novo é testado. Testes locais (`npm run test:db`, `test:e2e`) contra o `mel-dev` não entram nessa fila: não rodar enquanto o CI roda.
- Limites anti-abuso (migration 27) estão calibrados para o MVP; revisar com os eventos `abuse_guard` (tabela `events`, 30 dias) e os avisos `limite atingido` nos logs das rotas.
- SMTP próprio (recuperação de senha, depois "Confirm email" — o código já mostra "confira seu e-mail").
- Nome do perfil de quem vincula Google a uma sessão anônima fica vazio até o onboarding (o onboarding pede).
- Limite de sessões anônimas do **mel-dev**: **300/h por IP** desde 2026-11-03 (era 30/h e o CI falhava com `over_request_rate_limit` quando testes locais e o CI rodavam na mesma hora). Só no `mel-dev`: no `mel-prod` continua baixo (30/h), junto com o captcha previsto para o lançamento.
- Usuários anônimos órfãos (quem entra numa conta existente): limpeza futura.
- **Revisão final — `pet-photos` com o UUID do dono no caminho** (`<uuid>/…`, bucket público; vale também para fotos de adoção e logo de parceiro). Quem ajuda não aparece mais ali (avistamentos/encontrados usam o `sighting-media` com nome neutro desde a migration 29), mas o UUID liga entre si o conteúdo público da mesma pessoa: alerta, anúncio de adoção e empresa parceira (que tem nome e endereço públicos). Impacto: baixo/médio — o conteúdo já é público e assumido pelo dono; o ganho do atacante é ligar perfis (ex.: tutor do alerta ↔ dono da empresa). Recomendação: mesma solução do `sighting-media` (nome neutro + posse pelo `owner_id`), num pacote próprio — mexe nas políticas do bucket, nos triggers de fotos de pet, adoção e parceiro e na exclusão de conta.

## Pendências C/D (fora do MVP — auditoria final de 2026-11-03)

Não entram no Feature Freeze. Cada uma só volta se virar correção de segurança/regressão ou requisito de lançamento, com autorização.

**C — corrigir só se for muito barato:**
- Pets públicos legíveis direto pelo REST com `owner_id` (e enumeração); logo de parceiro com o UUID do dono no caminho.
- Radar lista alertas FOUND e encontrados REUNITED/CLOSED sem selo de status (`get_my_matches`).
- HTML inválido no `LostWizard` (`<div>` dentro de `<p>`, botão dentro de `<dl>`) → aviso de hidratação.
- Isolamento dos testes no `mel-dev`: a limpeza do E2E apaga todo anônimo criado durante a execução (inclusive de um CI simultâneo); CI sem `concurrency`.
- Push: segredo do despachante comparado sem `timingSafeEqual`; endpoint de inscrição sem lista de hosts permitidos.
- `metadataBase` / `og:url` / canonical.
- Moderador suspenso continua moderador; moderador pode suspender um admin.
- Atalho para `/admin` no perfil de quem modera.

**D — pós-lançamento:**
- Suspensão incompleta (não bloqueia editar o já publicado, denunciar, Guardião, pets e upload).
- 404 com status 200 nas rotas dinâmicas (`notFound()` dentro de `<Suspense>`).
- `robots.txt`, sitemap, OG da home.
- `pet-photos` com nome neutro (correção completa, ~8–12 h, com migration) — item "Revisão final" acima.
- Fotos substituídas de adoção e logo ficam órfãs no Storage; usuários anônimos antigos nunca expiram.
- Skip link; alvos de toque secundários < 44 px (zoom do mapa, links de texto).
- Fila de push: envio sequencial; reenvio de item abandonado pode duplicar (raro; ver migration 31).
- Prévia do cartaz gera 3 PNGs grandes; `getPublicLostCase` roda 2× por visita.

**Configurações e código necessários ao lançamento:** [12-checklist-lancamento.md](12-checklist-lancamento.md) — captcha do Auth no código, CSP completa, migrations 24–30 + script das fotos antigas, domínio, `NEXT_PUBLIC_SITE_URL` no build, Site URL/redirects, SMTP + "Confirm email", Google OAuth, Turnstile/MapTiler/VAPID de produção, agendador do push, secrets, rate limits de produção, primeiro moderador, revisão jurídica e smoke test.

## Proibido em produção (sempre)

`supabase link` · `supabase config push` · `db reset` · `migration repair` · seed · E2E/testes destrutivos · editar migrations já aplicadas · colocar o `mel-prod` em `MEL_SAFE_TARGET_REFS` · SQL manual/alterações de schema pelo painel · enfraquecer travas. Segredos nunca em arquivo versionado, chat ou log.

## Como retomar

1. `git pull` na `main` e confira o CI.
2. Para qualquer verificação em produção: PowerShell com as 3 variáveis temporárias (ver [08-deploy-producao.md](08-deploy-producao.md)) e `node scripts/prod/postdeploy-check.mjs --production --expect-ref=<ref>` — somente leitura; deve passar inteiro.
3. Próximo item: comprar o domínio; depois seguir [11-email-producao.md](11-email-producao.md) (SMTP → templates → "Confirm email" ON); em paralelo, preparar o client no Google Cloud.

## Documentos

[Checklist de lançamento](12-checklist-lancamento.md) · [Migrations](09-migrations.md) · [Deploy de produção](08-deploy-producao.md) · [E-mail de produção](11-email-producao.md) · [Milestones](06-milestones.md) · [Decisões](decisoes.md) · [Banco (planejamento)](03-database.md)
