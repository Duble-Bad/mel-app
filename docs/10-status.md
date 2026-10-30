# MEL — Onde estamos (status e próximos passos)

> Atualizado em 2026-10-30. Último commit de código verificado: `e17a9c3` (CI verde nos 3 checks obrigatórios).
> Leia isto primeiro ao retomar o projeto.

## Resumo

- **Produto (M1–M16): concluído** em desenvolvimento ([06-milestones.md](06-milestones.md)).
- **Produção:** schema aplicado e verificado no `mel-prod` (pós-deploy 100% ✅). Auth básico ajustado pelo dono no painel (abaixo). O app não está publicado.
- **Etapa atual:** M17 — configuração de produção. Código de Auth pronto (conversão anônimo → conta por e-mail e por Google). **Google no `mel-prod` só depois de SMTP próprio + "Confirm email" ON** (risco de conta pré-criada, abaixo). **Próximo: comprar o domínio** — sem ele não há SMTP de produção ([11-email-producao.md](11-email-producao.md)). Preparar o client no Google Cloud já pode.

## ⏸️ Produção pausada (decisão de 2026-10-30)

Todo o trabalho de produção está **pausado** até o produto estar funcionalmente pronto em DEV: nada de domínio, SMTP/Resend, "Confirm email", Google OAuth, Manual Linking, alterações no `mel-prod` ou deploy. Os itens abaixo ficam como **pendências de lançamento**; o foco agora é o produto (auditoria funcional em DEV).

## Último CI

`e17a9c3` — e-mail do Auth (`/auth/confirmar`, templates pt-BR): ✅ verde nos 3 checks. "Banco do zero" roda também um segundo arranque com "Confirm email" ON + Mailpit: 4/4 (cadastro, e-mail duplicado neutro, recuperação, anônimo → conta).

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
2. **Auth restante:** Rate Limits nos padrões (anônimos 30/h por IP, logins 30/5 min); captcha **só depois** de o código enviar `captchaToken` nas chamadas de Auth (hoje não envia — ligar antes quebra login, cadastro e anônimo).
3. **URLs:** Site URL e Redirect URLs (`/auth/callback`) do domínio final.
4. **SMTP** próprio (Resend; e-mail da MEL, nunca de terceiros/empregador), templates pt-BR do repositório e então **"Confirm email" ON** — passo a passo em [11-email-producao.md](11-email-producao.md). Sem SMTP, a recuperação de senha não chega a usuários reais — **bloqueia o lançamento público**.
5. **Google OAuth:** passo a passo acima (depois do item 4).
6. **MapTiler:** chave de produção restrita ao domínio.
7. **Web Push:** gerar par VAPID novo para produção (nunca reutilizar o do dev); agendador de push (`PUSH_DISPATCH_SECRET`).
8. **Secrets do servidor** na hospedagem (`SUPABASE_SECRET_KEY` etc.), nunca no repositório.
9. **Domínio** e deploy do app.
10. **Primeiro moderador:** `npm run admin:role -- <email> moderator --confirm-target=<ref>` (único script administrativo permitido em produção, com o ref digitado).
11. Smoke test manual como usuário real (sem seed, sem E2E contra produção).

## Pendências conhecidas (antes do lançamento público)

- **Migrations 24 (`20261030120000_radar_public_distance`, Radar v2 — P0 de privacidade), 25 (`20261030140000_lost_case_close_edit`, ciclo de vida do alerta) e 26 (`20261030160000_adoption_partner_moderation`, moderação de adoção e parceiros) aplicadas só no `mel-dev`; aplicar no `mel-prod` na fase de lançamento** (pre-flight já espera 26).

- Captcha do Supabase Auth: código precisa passar `captchaToken` (signInAnonymously, signUp, signIn, reset) antes de ligar.
- SMTP próprio (recuperação de senha, depois "Confirm email" — o código já mostra "confira seu e-mail").
- Nome do perfil de quem vincula Google a uma sessão anônima fica vazio até o onboarding (o onboarding pede).
- Limite de sessões anônimas do **mel-dev** (30/h por IP): a suíte do CI está perto; se o CI falhar com `over_request_rate_limit`, subir o limite no mel-dev.
- Usuários anônimos órfãos (quem entra numa conta existente): limpeza futura.

## Proibido em produção (sempre)

`supabase link` · `supabase config push` · `db reset` · `migration repair` · seed · E2E/testes destrutivos · editar as 23 migrations · colocar o `mel-prod` em `MEL_SAFE_TARGET_REFS` · SQL manual/alterações de schema pelo painel · enfraquecer travas. Segredos nunca em arquivo versionado, chat ou log.

## Como retomar

1. `git pull` na `main` e confira o CI.
2. Para qualquer verificação em produção: PowerShell com as 3 variáveis temporárias (ver [08-deploy-producao.md](08-deploy-producao.md)) e `node scripts/prod/postdeploy-check.mjs --production --expect-ref=<ref>` — somente leitura; deve passar inteiro.
3. Próximo item: comprar o domínio; depois seguir [11-email-producao.md](11-email-producao.md) (SMTP → templates → "Confirm email" ON); em paralelo, preparar o client no Google Cloud.

## Documentos

[Migrations](09-migrations.md) · [Deploy de produção](08-deploy-producao.md) · [E-mail de produção](11-email-producao.md) · [Milestones](06-milestones.md) · [Decisões](decisoes.md) · [Banco (planejamento)](03-database.md)
