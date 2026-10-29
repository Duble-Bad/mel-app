# MEL — Deploy de schema em produção (`mel-prod`)

> **Status:** primeiro deploy (23 migrations) aplicado no `mel-prod` em 2026-10-29.
> Só rode com autorização explícita do dono do projeto.

Este procedimento aplica **somente as migrations versionadas** (`supabase/migrations`) no `mel-prod`.
Configuração (Auth, URLs, OAuth, SMTP, Turnstile, MapTiler, VAPID, agendador, secrets, primeiro admin, domínio) é outra etapa, feita depois, pelo painel — **nunca** com `supabase config push` (o `config.toml` é de desenvolvimento).

## Dois mundos separados

| | Desenvolvimento | Produção |
|---|---|---|
| Autorização | `MEL_SAFE_TARGET_REFS` (só o `mel-dev`) | `--production` + `--expect-ref` + `MEL_PROD_PROJECT_REF` + `MEL_PROD_DB_URL` + `MEL_PROD_DB_CA_FILE` + terminal interativo + 2 confirmações digitadas + prompt do CLI |
| Código | `scripts/lib/safe-target.mjs` | `scripts/prod/*` |
| Conexão | projeto ligado (`supabase link`) ou `.env.local` | `--db-url` informado na hora; **nunca** `supabase link` |
| Pode criar dados? | sim (seed, testes, E2E) | **não**: só `db push` de migrations e leituras do catálogo |

Colocar o `mel-prod` em `MEL_SAFE_TARGET_REFS` **não** libera produção: o procedimento de produção aborta, e toda a trava de desenvolvimento passa a recusar tudo.

## Antes do dia do deploy

1. Checks verdes no commit que vai para produção (o pre-flight confere pela API do GitHub):
   - `Verificações rápidas (tipos, lint, unitários)`
   - `Banco (RLS) e ponta a ponta`
   - `Banco do zero, auditoria e testes`
2. Baixar o certificado SSL do `mel-prod` (painel → Settings → Database → SSL Configuration → Download certificate) para um arquivo local, fora do repositório.
3. Ter à mão a senha do banco do `mel-prod` (gerenciador de senhas). Ela não é gravada em arquivo.

## Execução (somente com autorização)

Num **PowerShell novo** (ou Windows Terminal), na raiz do repositório, na `main` atualizada e limpa.
**Não use o Git Bash**: no terminal dele o Node não é reconhecido como interativo e o deploy é recusado.

```powershell
# Só nesta sessão. A URL com senha é digitada mascarada (Read-Host -AsSecureString)
# e não vai para o histórico do PowerShell nem para arquivo.
$env:MEL_PROD_PROJECT_REF = '<ref do mel-prod>'
$s = Read-Host 'URL do banco do mel-prod (com senha)' -AsSecureString
$env:MEL_PROD_DB_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); Remove-Variable s
$env:MEL_PROD_DB_CA_FILE = 'C:\caminho\para\prod-ca-2021.crt'

# 1) Pre-flight (só leitura). Aborta se qualquer item falhar.
node scripts/prod/preflight.mjs --production --expect-ref=<ref do mel-prod>

# 2) Deploy (pede confirmações). Roda o pre-flight de novo antes de tudo.
node scripts/prod/deploy-schema.mjs --production --expect-ref=<ref do mel-prod>

# 3) Limpar a sessão
Remove-Item Env:MEL_PROD_PROJECT_REF, Env:MEL_PROD_DB_URL, Env:MEL_PROD_DB_CA_FILE
```

O CLI do Supabase é chamado pelo próprio Node, **sem shell**: caracteres especiais da senha nunca são interpretados por `cmd.exe`/bash.

O `deploy-schema.mjs`, em ordem:

1. Recusa se não houver terminal interativo ou se estiver em CI.
2. Pre-flight completo (lista abaixo). Qualquer ❌ → aborta, nada aplicado.
3. Mostra o alvo (ref mascarado) e as migrations pendentes.
4. `supabase db push --db-url … --dry-run` (simulação).
5. Pede o **ref completo** digitado e a frase `APLICAR MIGRATIONS NO MEL-PROD`.
6. Relê o estado de produção; se mudou desde o pre-flight → aborta.
7. `supabase db push --db-url …` — sem `--yes`: o próprio CLI pede o último "y".
8. Pós-deploy (somente leitura). Reprovado → não seguir para a configuração.

## Pre-flight (`scripts/prod/preflight.mjs`)

- `--production` presente; `--expect-ref` = `MEL_PROD_PROJECT_REF` (20 caracteres).
- `MEL_PROD_DB_URL` é um banco Supabase (direto `db.<ref>.supabase.co` ou pooler `postgres.<ref>@…pooler.supabase.com:5432`) **do mesmo ref**.
- Certificado SSL presente (conexão com `rejectUnauthorized: true`).
- Fora de CI; ref de produção **fora** de `MEL_SAFE_TARGET_REFS`, do `supabase link` e do `.env.local`; `NEXT_PUBLIC_SUPABASE_URL` do terminal não aponta para produção.
- Exatamente 23 migrations, idênticas ao manifesto `supabase/migrations.manifest.json` (nome, ordem e hash).
- Nenhum dado de seed/demo nas migrations (INSERT só em `storage.buckets` e `public.plans`; nada de `exemplo.com`/demo/seed/COPY/TRUNCATE).
- Impressão digital de referência versionada (`supabase/schema-fingerprint.json`).
- Branch `main`, working tree limpa, HEAD = `origin/main`.
- Os 3 checks do GitHub verdes no HEAD.
- Plano = só `supabase db push --db-url` (+ `--dry-run`); sem reset, seed, config, link, E2E, repair, dump, `--include-*`.
- Estado de produção (leitura): nenhuma migration desconhecida, ordem igual à do repositório, ao menos uma pendente.

## Pós-deploy (`scripts/prod/postdeploy-check.mjs`)

Transação **READ ONLY**, só catálogo — não cria usuários nem dados.

- 23 migrations registradas, na ordem dos arquivos.
- 24 tabelas; RLS habilitado nas 24; primary key em todas.
- 60 políticas em `public` + 9 em `storage.objects` (nomes idênticos às migrations).
- 40 funções `public` + 46 `private` (nomes idênticos); SECURITY DEFINER sempre com `search_path`.
- 24 triggers, incluindo `on_auth_user_created` e `on_auth_user_converted` em `auth.users`.
- 16 enums; 45 índices declarados.
- Sem grant de escrita para `anon`; `anon` sem acesso ao schema `private`.
- 3 buckets (`avatars` 2 MB, `pet-photos` 5 MB, `sighting-media` 5 MB; públicos; webp/jpeg/png).
- Realtime: `public.messages` e `public.notifications`.
- **Drift:** impressão digital (definição completa de colunas, constraints, índices, funções, grants, triggers, políticas, RLS, enums, buckets, publication) idêntica à do banco reconstruído do zero.

### Objetos de plataforma (não são migrations da MEL)

O `mel-prod` tem objetos que **não** fazem parte das 23 migrations. Eles foram auditados (READ ONLY, 2026-10-29) e são aceitos **só** pela definição exata, fixada em `scripts/prod/postdeploy-check.mjs`.

**`public.rls_auto_enable()` + event trigger `ensure_rls`**

- **Fatos:** nenhuma migration nem arquivo do repositório os cria. Os OIDs (função 17604, event trigger 17605) são anteriores ao schema `supabase_migrations` (17606, criado pelo primeiro `db push`) e a todos os objetos das migrations (≥ 18740): **já existiam antes do deploy da MEL**.
- **Origem:** provisionamento/infraestrutura do Supabase é **PROVÁVEL, não comprovada**. Nome, event trigger, tags e mensagens de LOG coincidem com a receita oficial de [event triggers do Supabase](https://supabase.com/docs/guides/database/postgres/event-triggers) (variante: nome da tabela via OID com `%I.%I`, erro não relançado). O catálogo não registra quem criou; não afirmamos que veio da opção "Enable automatic RLS".
- **O que faz:** ao fim de `CREATE TABLE` / `CREATE TABLE AS` / `SELECT INTO` no `public`, liga RLS (sem FORCE) na tabela nova; fora do `public`, só LOG. Se o ALTER falhar, a tabela fica sem RLS e só há LOG — o pós-deploy e a auditoria da reconstrução exigem RLS em toda tabela, então isso não passa despercebido.
- **Segurança:** owner `postgres` (não superusuário), SECURITY DEFINER com `search_path=pg_catalog`. O EXECUTE para `anon`/`authenticated` é o grant padrão do `public` e é inócuo: a chamada direta como `anon` é recusada (`0A000 cannot display a value of type event_trigger`) e o corpo só funciona dentro de um event trigger. `anon`/`authenticated` não têm CREATE em schema nem no banco.
- **Por que mantemos:** já existia, só restringe (liga RLS) e reforça a regra "RLS em toda tabela" para tabelas criadas fora das migrations (ex.: pelo painel). Remover exigiria uma migration em produção para tirar uma proteção.

**Como a exceção não esconde outro drift**

| Verificação | Reprova se |
|---|---|
| `PLATFORM_FUNCTIONS` (uma única função, por nome) | ausente; assinatura, retorno, linguagem, md5 (`846ec2fb…a9bf`), owner, superusuário, DEFINER/INVOKER, `search_path`, ACL ou EXECUTE de anon/authenticated/service_role diferentes; event trigger ligado diferente; chamada como `anon` não recusada (ou não testável) |
| `EXPECTED_EVENT_TRIGGERS` (lista exata de 7) | qualquer event trigger a mais, a menos, ou com nome, evento, tags, estado, owner ou função diferentes |
| Funções / impressão digital | qualquer outra função a mais no `public`/`private` (só o nome acima sai da comparação) ou qualquer diferença nas 13 categorias |
| Papéis da API | `anon`/`authenticated` com CREATE em algum schema ou no banco |

Os 6 outros event triggers (`issue_graphql_placeholder`, `issue_pg_cron_access`, `issue_pg_graphql_access`, `issue_pg_net_access`, `pgrst_ddl_watch`, `pgrst_drop_watch`; owner `supabase_admin`, funções em `extensions`) são **infraestrutura do Supabase**, não migrations da MEL. Uma atualização da plataforma que os altere faz o pós-deploy reprovar de propósito: revise e atualize a lista antes de aceitar.

A chamada como `anon` roda dentro da transação READ ONLY, num savepoint sempre desfeito.

Pode ser rodado sozinho, a qualquer momento:
`node scripts/prod/postdeploy-check.mjs --production --expect-ref=<ref do mel-prod>` (mesmas variáveis).

## Proibido em produção

`supabase link` · `supabase config push` · `supabase db reset` · `db push --include-seed/--include-roles/--include-all` · `supabase migration repair` · `npm run db:seed` · `npm run test:db` · `npm run test:e2e` · `npm run db:push` / `db:types` / `env:pull` · scripts administrativos sem `--confirm-target` · editar migration já validada (crie outra e atualize o manifesto após nova reconstrução).
