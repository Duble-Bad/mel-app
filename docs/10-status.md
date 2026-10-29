# MEL — Onde estamos (status e próximos passos)

> Atualizado em 2026-10-29. Último commit verificado: `b1ed683` (CI verde nos 3 checks obrigatórios).
> Leia isto primeiro ao retomar o projeto.

## Resumo

- **Produto (M1–M16): concluído** em desenvolvimento ([06-milestones.md](06-milestones.md)).
- **Produção:** schema aplicado e verificado no `mel-prod`. **Nenhuma configuração feita ainda.** O app não está publicado.
- **Etapa atual:** pausa entre o deploy do schema (concluído) e a configuração de produção (M17, **não iniciada; exige autorização**).

## Linha do tempo da produção

| Etapa | Estado |
|---|---|
| Auditoria do schema e travas contra produção (`scripts/lib/safe-target.mjs`) | ✅ |
| Reconstrução do zero no CI (`schema-rebuild.yml`), manifesto e impressão digital | ✅ |
| Procedimento de deploy (`scripts/prod/`, [08-deploy-producao.md](08-deploy-producao.md)) | ✅ |
| Deploy das 23 migrations no `mel-prod` (pelo dono, no PowerShell) | ✅ 2026-10-29 |
| Pós-deploy: schema idêntico ao reconstruído; único objeto a mais `rls_auto_enable` + `ensure_rls` (anterior ao deploy) | ✅ auditado, decisão **MANTER** (`b1ed683`) |
| **M17 — Configuração de produção** | ⏸️ não iniciado |
| Publicação do app (Vercel + domínio) | ⏸️ não iniciado |

## M17 — Configuração de produção (pendente, em ordem sugerida)

Tudo no painel do `mel-prod` ou na hospedagem do app. **Nunca** `supabase config push` (o `config.toml` é de desenvolvimento). Cada item precisa de autorização e, quando envolve segredo, é feito pelo dono.

1. **API:** schemas expostos sem `private`.
2. **Auth:** login anônimo ligado; decisão sobre confirmação de e-mail; limites de envio; captcha (Turnstile) com a secret configurada no Supabase.
3. **URLs:** Site URL e Redirect URLs (`/auth/callback`) do domínio final.
4. **Google OAuth:** client de produção (Client Secret só no painel).
5. **SMTP** próprio (e-mail da MEL, nunca de terceiros/empregador) e template `codigo.html`.
6. **MapTiler:** chave de produção restrita ao domínio.
7. **Web Push:** gerar par VAPID novo para produção (nunca reutilizar o do dev); agendador de push (`PUSH_DISPATCH_SECRET`).
8. **Secrets do servidor** na hospedagem (`SUPABASE_SECRET_KEY` etc.), nunca no repositório.
9. **Domínio** e deploy do app.
10. **Primeiro moderador:** `npm run admin:role -- <email> moderator --confirm-target=<ref>` (único script administrativo permitido em produção, com o ref digitado).
11. Smoke test manual como usuário real (sem seed, sem E2E contra produção).

## Proibido em produção (sempre)

`supabase link` · `supabase config push` · `db reset` · `migration repair` · seed · E2E/testes destrutivos · editar as 23 migrations · colocar o `mel-prod` em `MEL_SAFE_TARGET_REFS` · SQL manual/alterações de schema pelo painel · enfraquecer travas. Segredos nunca em arquivo versionado, chat ou log.

## Como retomar

1. `git pull` na `main` e confira o CI.
2. Para qualquer verificação em produção: PowerShell com as 3 variáveis temporárias (ver [08-deploy-producao.md](08-deploy-producao.md)) e `node scripts/prod/postdeploy-check.mjs --production --expect-ref=<ref>` — somente leitura; deve passar inteiro.
3. Escolher e autorizar o próximo item do M17.

## Documentos

[Migrations](09-migrations.md) · [Deploy de produção](08-deploy-producao.md) · [Milestones](06-milestones.md) · [Decisões](decisoes.md) · [Banco (planejamento)](03-database.md)
