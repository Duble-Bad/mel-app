# 15 — Ativação do backup (pré-ativação, 2I)

Preparação para ligar o backup de [14-backup-restauracao.md](14-backup-restauracao.md).
**Nada aqui foi executado com dados ou credenciais reais.** Termos de fornecedores
consultados em 04/11/2026 nas páginas oficiais; reconfirmar no dia.

## 1. Consistência do ponto (auditoria)

| Pergunta | Resposta |
|---|---|
| Arquivo referenciado pelo banco que some antes da cópia | Detectado: as referências vêm do **próprio dump** (`dump-inspect.mjs`). Desde a 2J, faltando qualquer arquivo o ponto vira `.incomplete` (nunca `.ok`), o backup **falha** e não há ping; o ponto fica guardado só para diagnóstico (`incremental.mjs missing <data>`, local, com a chave). |
| Arquivo novo ou alterado durante a execução | Novo depois da listagem: entra no próximo ponto (no ponto atual, sem linha no banco, seria órfão). Substituído entre a listagem e o download: o tamanho diferente aborta o backup (sem `.ok`); mesmo tamanho fica com o conteúdo mais novo sob a chave antiga (risco aceito, raro: o app nunca substitui arquivos). |
| `.ok` só depois das verificações | Sim: depois do snapshot e do `.refs`, e só se **todo** blob do manifesto (e o `.sha256`) estiver no repositório. |
| Ponto completo que falha depois por referência quebrada | **Era possível (corrigido em 2I/2J):** agora só ponto sem nenhuma referência quebrada recebe `.ok` (`status: complete`); verify e restauração recusam `.incomplete` antes de qualquer escrita. |
| Retenção ao mesmo tempo que o backup | Poderia apagar um blob reaproveitado ainda sem `.ok`. Evitado por: backup e retenção no mesmo workflow, em sequência, com `concurrency`; o selo confere os blobs antes do `.ok`; a retenção só apaga blob com mais de 30 dias. |

## 2. Repositório privado `mel-backup`

- **Contém só:** o workflow (modelo: [backup/mel-backup-workflow.yml.example](backup/mel-backup-workflow.yml.example)) e um README.
  Os scripts vêm do `mel-app` público num **commit fixo revisado** (`MEL_APP_REF`).
- **Nunca commitar:** dumps, arquivos do Storage, pastas de trabalho, `.env*`, chave
  privada age, configuração do rclone com chaves, saídas de `verify`/`fetch`.
- **Secrets** (em *Environments*, não no repositório):
  - `backup`: `DB_URL` (Session pooler, porta 5432, `?sslmode=require`), `SUPABASE_URL`,
    `SUPABASE_SECRET_KEY`, `BACKUP_AGE_RECIPIENT` (pública), `B2_WRITE_KEY_ID`/`B2_WRITE_KEY`
    (bucket único; `listFiles`, `readFiles`, `writeFiles`, **sem** `deleteFiles`), `HEALTHCHECK_URL`.
  - `retencao`: `B2_PRUNE_KEY_ID`/`B2_PRUNE_KEY` (mesmo bucket, com `deleteFiles`).
  - A chave **privada** age nunca vai para o GitHub (gerenciador de senhas + cópia offline).
- **Permissões:** `permissions: {}` (o job não precisa do token do GitHub);
  `persist-credentials: false`; `if: github.repository == '<dono>/mel-backup'`.
- **Pull requests:** o workflow não tem gatilho `pull_request`/`push`; só `workflow_dispatch`
  (e `schedule` depois da ativação). Repositório privado, sem colaboradores além do dono.
- **Logs:** os scripts só imprimem totais; os secrets são mascarados pelo GitHub; proibido
  `set -x`, `env`, `printenv` e debug de passos (`ACTIONS_STEP_DEBUG`).
- **Artefatos:** nenhum `upload-artifact` nem `cache` de pastas de trabalho; a pasta de
  trabalho é `mktemp` com `umask 077` e apagada ao fim (`trap`), e o runner é descartado.

## 3. Armazenamento: Backblaze B2 × Cloudflare R2

| | Backblaze B2 | Cloudflare R2 |
|---|---|---|
| Franquia | 10 GB; transações A/B/C grátis; classe D 2.500/dia grátis; download grátis até 3× o armazenado | 10 GB-mês; 1 M classe A e 10 M classe B por mês; saída grátis |
| Cartão | "No credit card required" | checkout de assinatura do R2; exigência de cartão **pendente** |
| Acima da franquia | US$ 0,005/GB-mês ou US$ 6,95/TB (páginas divergem — **pendente**) | US$ 0,015/GB-mês; A US$ 4,50/M; B US$ 0,36/M |
| Teto de gasto | limites e alertas por quantidade (75% e 100%) | **pendente** |
| rclone | backend `b2` (apagar = ocultar; `--b2-hard-delete` apaga) | backend `s3`, provider Cloudflare (`no_check_bucket`) |
| Permissão mínima | chave por bucket e por capacidade: **escrita sem apagar** possível (pela API/CLI) | "Object Read & Write" por bucket; escrita sem apagar **não encontrada** |
| Proteção contra exclusão | versões guardadas por padrão; Object Lock sem custo | bucket locks (disponibilidade no plano **pendente**) |
| Região | EUA, Canadá, UE (escolhida na criação, definitiva); sem América do Sul | dica de localização sem América do Sul; jurisdição UE/EUA |

**Recomendação: B2.** Sem cartão, com teto de gasto, transações grátis e chave do backup
diário **sem permissão de apagar** (a retenção usa outra chave, em outro *Environment*).
Regra de ciclo de vida do bucket: "manter só a última versão" com
`daysFromHidingToDeleting: 7` — o que a retenção apaga fica recuperável por 7 dias e
depois some (exclusão total em até ~37 dias; registrar na política de privacidade).
Os dados saem do Brasil **cifrados** com chave que fica só com o dono (transferência
internacional: citar na política de privacidade). Ambos cabem na franquia (< 2 GB no 1º ano).

**Pendentes:** cartão e teto no R2; preço exato do B2 acima de 10 GB; comportamento do B2
ao atingir o teto; se o rclone precisa de `listBuckets` com a chave restrita (conferir no
1º backup manual).

## 4. Primeiro backup hospedado — procedimento do proprietário

Credenciais digitadas **só** nos painéis (Supabase, Backblaze, GitHub, healthchecks.io);
nunca coladas em conversa com IA, e-mail ou arquivo do projeto.

**Antes (autorização explícita por escrito, com data):**
1. Confirmar que nenhum CI do `mel-app` está rodando (aba Actions) — o backup só lê, mas
   evita disputar conexões do pooler com os testes.
2. Lembrar: o `mel-dev` tem 1 conta real; ela irá, **cifrada**, para o bucket privado e
   sairá pela retenção (ou apagar o bucket ao fim do teste).

**Preparação:**
3. Gerar o par age num computador de confiança (`age-keygen -o mel-backup.key`); guardar
   o arquivo no gerenciador de senhas + cópia offline; anotar só a linha `age1…` (pública).
4. Backblaze: conta (região UE ou EUA, definitiva), bucket **privado**, teto de gasto,
   regra de ciclo de vida da seção 3; três chaves restritas ao bucket: escrita sem apagar
   (backup), com apagar (retenção) e só leitura (restaurar, fica com o dono, fora do GitHub).
5. GitHub: repositório **privado** `mel-backup` com o workflow do modelo (`schedule`
   comentado), `MEL_APP_REF` = SHA revisado; Environments `backup` e `retencao` com os
   secrets da seção 2. `DB_URL`: painel do Supabase → Connect → **Session pooler** + senha
   do banco do `mel-dev` + `?sslmode=require`.
6. healthchecks.io: um check diário; URL no secret.

**Execução (manual):**
7. Actions → "Backup diário da MEL" → Run workflow. Esperado: `[backup] ok`, `verify` íntegro.
   O job só lê o `mel-dev` (dump e download); nada é escrito nele.

**Confirmar que restaura (sem projeto hospedado extra):**
8. Num computador com Docker: `supabase start` (Supabase local, descartável) com as mesmas
   migrations; `restore.sh` com `BACKUP_REPO` do B2 (chave de **leitura**), a chave privada
   e `RESTORE_CONFIRM=127.0.0.1`. Conferências do script + login de teste.
9. Apagar o Supabase local (`supabase stop --no-backup`) e a pasta de trabalho; a chave
   privada volta para o cofre.

**Bloqueio:** restauração num projeto **hospedado** novo exige um 3º projeto Supabase (o
Free permite 2: `mel-dev` e `mel-prod`). Sem ele, a restauração é comprovada no Supabase
local (passo 8), que cobre dados, Auth, arquivos e RLS, mas não a reconfiguração de
JWT/OAuth/SMTP de um projeto novo hospedado.

## 5. Critérios: READY → TESTED → ACTIVE

| Estado | Exige |
|---|---|
| **READY** (hoje) | Scripts, ensaio sintético verde, modelo de workflow, procedimento, decisão de fornecedor |
| Backup incompleto | Falha explícita: `backup.sh` sai com erro, sem `BACKUP_RESULT_FILE`; o workflow confere o ponto **recém-criado** (não `latest`) antes do ping; retenção não roda (`needs: backup`). Uma referência quebrada **permanente** na origem impede novos pontos íntegros até ser corrigida: o alerta do ping avisa no mesmo dia. |
| **TESTED** | 1 backup hospedado com `verify` íntegro no bucket real; 1 restauração isolada (Supabase local) com conferências verdes; chave privada guardada e testada; bucket privado com teto e ciclo de vida |
| **ACTIVE** | `schedule` diário ligado; ping de vida com alerta por e-mail; retenção rodando e conferida após 31 dias; ensaio sintético mensal (este repositório) e restauração real trimestral (passo 8) registrados em `10-status.md` |
