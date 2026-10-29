# MEL — Onde estamos (status e próximos passos)

> Atualizado em 2026-10-29. Último commit de código verificado: `021a5a1` (CI verde nos 3 checks obrigatórios).
> Leia isto primeiro ao retomar o projeto.

## Resumo

- **Produto (M1–M16): concluído** em desenvolvimento ([06-milestones.md](06-milestones.md)).
- **Produção:** schema aplicado e verificado no `mel-prod` (pós-deploy 100% ✅). Auth básico ajustado pelo dono no painel (abaixo). O app não está publicado.
- **Etapa atual:** M17 — configuração de produção. Código de Auth pronto (conversão anônimo → conta por e-mail e por Google). **Próximo passo: configurar o Google OAuth manualmente** (passo a passo abaixo).

## Último CI

`021a5a1` — Google com sessão anônima (`linkIdentity`): ✅ verde nos 3 checks obrigatórios (Verificações rápidas · Banco (RLS) e ponta a ponta · Banco do zero, auditoria e testes, que roda o teste de vínculo com manual linking + Google fictício).

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
| **Google OAuth no painel + Google Cloud** | ⏭️ próximo (manual, pelo dono) |
| Publicação do app (Vercel + domínio) | ⏸️ não iniciado |

## Próximo passo: Google OAuth (manual, pelo dono)

Nada disso foi feito ainda. O Client Secret é segredo: só no painel do Supabase, nunca no repositório, em `NEXT_PUBLIC_*`, em log ou no chat.

**Google Cloud** (projeto próprio da MEL, conta da MEL — nunca de empregador):

1. Criar o projeto (ex.: "MEL Produção").
2. **OAuth consent screen:** tipo *External*; nome "MEL"; e-mail de suporte da MEL; logo opcional; links de `/privacidade` e `/termos` (**DEPENDE DA URL DE PRODUÇÃO**); escopos só `openid`, `email`, `profile`; publicar o app (sair de *Testing*) antes do lançamento.
3. **Credentials → Create OAuth client ID → Web application.**
   - **Authorized redirect URIs:** só `https://<ref-do-mel-prod>.supabase.co/auth/v1/callback` (o Google volta para o Supabase, não para a MEL).
   - **Authorized JavaScript origins:** não é necessário para o fluxo de redirecionamento usado pela MEL; se o console exigir, a URL pública da MEL (**DEPENDE DA URL DE PRODUÇÃO**).
4. Copiar o Client ID e o Client Secret direto para o painel do Supabase (abaixo).

**Supabase `mel-prod`:**

1. Authentication → Sign In / Providers → **Google**: Enabled ON; Client ID; Client Secret (colar só aqui); "Skip nonce checks" OFF.
2. Authentication → Sign In / Providers → **Allow manual linking: ON** (necessário para o anônimo manter as contribuições ao entrar com Google; análise de segurança em [decisoes.md](decisoes.md)).
3. Authentication → URL Configuration (**DEPENDE DA URL DE PRODUÇÃO**): Site URL `https://<domínio>`; Redirect URLs só `https://<domínio>/auth/callback**`. Nunca `localhost`, nunca `*.vercel.app`, nunca `/**` no domínio inteiro.
4. Hospedagem do app: `NEXT_PUBLIC_AUTH_GOOGLE=on` (mostra o botão) e `NEXT_PUBLIC_SITE_URL=https://<domínio>`.

Sem a URL de produção, os passos de Google Cloud 1–4 e Supabase 1–2 podem ser feitos antes; o botão só deve aparecer (`NEXT_PUBLIC_AUTH_GOOGLE=on`) quando Site URL e Redirect URLs estiverem configurados.

## M17 — Configuração de produção (restante, em ordem sugerida)

Tudo no painel do `mel-prod` ou na hospedagem do app. **Nunca** `supabase config push` (o `config.toml` é de desenvolvimento). Cada item precisa de autorização e, quando envolve segredo, é feito pelo dono.

1. **API:** schemas expostos sem `private`.
2. **Auth restante:** Rate Limits nos padrões (anônimos 30/h por IP, logins 30/5 min); captcha **só depois** de o código enviar `captchaToken` nas chamadas de Auth (hoje não envia — ligar antes quebra login, cadastro e anônimo).
3. **URLs:** Site URL e Redirect URLs (`/auth/callback`) do domínio final.
4. **Google OAuth:** passo a passo acima.
5. **SMTP** próprio (e-mail da MEL, nunca de terceiros/empregador) e template `codigo.html`. Sem SMTP, a recuperação de senha não chega a usuários reais — **bloqueia o lançamento público**.
6. **MapTiler:** chave de produção restrita ao domínio.
7. **Web Push:** gerar par VAPID novo para produção (nunca reutilizar o do dev); agendador de push (`PUSH_DISPATCH_SECRET`).
8. **Secrets do servidor** na hospedagem (`SUPABASE_SECRET_KEY` etc.), nunca no repositório.
9. **Domínio** e deploy do app.
10. **Primeiro moderador:** `npm run admin:role -- <email> moderator --confirm-target=<ref>` (único script administrativo permitido em produção, com o ref digitado).
11. Smoke test manual como usuário real (sem seed, sem E2E contra produção).

## Pendências conhecidas (antes do lançamento público)

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
3. Seguir o "Próximo passo: Google OAuth" acima (ou escolher e autorizar outro item do M17).

## Documentos

[Migrations](09-migrations.md) · [Deploy de produção](08-deploy-producao.md) · [Milestones](06-milestones.md) · [Decisões](decisoes.md) · [Banco (planejamento)](03-database.md)
