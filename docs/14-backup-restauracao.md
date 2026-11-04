# 14 — Backup e restauração (Supabase Free)

Launch Readiness 2E (04/11/2026). **O Supabase Free não tem backup automático**
(o diário de 7 dias começa no Pro). Este é o backup próprio da MEL: scripts em
`scripts/backup/`, ensaio em `.github/workflows/backup-restore-drill.yml`.
**Nada está agendado nem configurado com credenciais reais.**

## 1. O que precisa ser preservado

| Parte | Onde | Como volta |
|---|---|---|
| Schema, funções, RLS, grants, buckets, planos | `supabase/migrations` (Git) | migrations no projeto novo (`db push`) — não vem do backup |
| Dados das tabelas `public` | banco | `data.sql` do backup |
| Contas, identidades (Google), sessões | schema `auth` | `data.sql` (senhas como hash; ninguém precisa redefinir) |
| Arquivos (avatars, pet-photos, sighting-media) | Storage | pasta `storage/` do backup, nos mesmos caminhos |
| Dono e data de cada arquivo | `storage.objects` | `objects.csv` (posse do sighting-media, faxina de órfãs) |
| Configuração do Auth (URLs, Google, SMTP, captcha, limites, templates) | painel do Supabase | **manual** (checklist de lançamento) |
| Chaves de API e de JWT do Supabase | painel | **novas** num projeto novo → atualizar na Vercel |
| VAPID, Turnstile, MapTiler, Resend, CRON_SECRET | Vercel / gerenciador de senhas | não mudam; **a chave VAPID privada precisa estar guardada**: sem ela, todas as inscrições de push morrem |
| Chave privada do backup (age) | gerenciador de senhas + cópia offline | sem ela, nenhum backup abre |

## 2. Estratégia recomendada (custo zero)

- **Rotina:** GitHub Actions agendado 1×/dia, num **repositório PRIVADO separado**
  (o `mel-app` é público e logs de Actions de repositório público são públicos).
  Private repo no plano gratuito: 2.000 min/mês; o backup leva poucos minutos.
- **Conexão:** o banco do Free só tem endereço IPv6 direto e o runner do GitHub não
  tem IPv6 → usar a string do **Session pooler** (porta 5432) do painel. *Não testado.*
- **Criptografia:** `age` com chave **pública** no runner; a privada fica só com o
  dono (gerenciador de senhas + cópia offline). Quem vaza o bucket ou o runner não abre nada.
- **Armazenamento:** Backblaze B2 (10 GB grátis) ou Cloudflare R2 (10 GB grátis,
  sem custo de saída). Chave de acesso restrita a um bucket, só escrita se o
  fornecedor permitir (B2 permite chave só `writeFiles`). *Termos e cadastro não verificados.*
- **Retenção (LGPD):** 30 dias, pelo comando `prune 30` do próprio repositório (seção 8).
  **Não** usar regra de ciclo de vida do bucket por idade: um arquivo enviado há 40 dias e
  ainda no ar é usado pelo ponto de hoje. Uma exclusão de conta some dos backups em até
  30 dias; registrar isso na política de privacidade.
- **Monitoramento:** e-mail de falha do GitHub Actions + "ping de vida"
  (ex.: healthchecks.io grátis) que avisa se o backup **não** rodar. *Não configurado.*
- **Logs:** os scripts só imprimem totais, tamanhos e tempos; nunca caminhos, dados ou segredos.

## 3. Ensaio (comprovado em 04/11/2026)

Workflow manual `backup-restore-drill.yml`, em dois Supabase locais descartáveis:
banco A com dados **sintéticos** → backup → A destruído → banco B novo (só
migrations) → restauração → conferências. Sem segredos, sem artefatos.

| Verificação | Resultado |
|---|---|
| Backup gerado (31 migrations, 58 tabelas, 5 arquivos) | ✅ |
| Arquivo criptografado: texto sintético conhecido ausente; presente só com a chave | ✅ |
| Arquivo adulterado e chave errada não abrem | ✅ |
| Restauração recusa banco com contas (não sobrescreve dados) | ✅ |
| Mesmas contagens nas 58 tabelas (public, auth, storage) | ✅ |
| 5/5 arquivos de volta, mesmo caminho e mesmo conteúdo (sha256) | ✅ |
| Dono e data originais de 5/5 arquivos | ✅ |
| Toda referência do banco tem arquivo (0 ausentes, 0 órfãos) | ✅ |
| URL dos avatares reescrita para o projeto novo | ✅ |
| Schema, RLS, funções e grants idênticos às migrations (auditoria + impressão digital) | ✅ |
| Login com a mesma senha e o mesmo id; sessão anônima continua pelo refresh token | ✅ |
| RLS (dados privados do pet), privacidade (ponto aproximado, rótulo), Radar, conversa | ✅ |

## 4. Ainda não comprovado

- Backup de um projeto **hospedado** (pooler IPv4, permissões do `postgres` para
  `session_replication_role` e para corrigir `storage.objects`, volume real).
- Restauração num projeto Supabase **novo hospedado** (chaves de JWT diferentes:
  sessões existentes devem cair e o refresh token pode não valer — no ensaio a chave era a mesma).
- Agendamento, armazenamento externo, regra de retenção e alerta de falha.
- Tempo com volume real (no ensaio: backup 5 s, restauração 2 s, dados mínimos).

## 5. Recuperação (projeto perdido)

1. Criar projeto novo no Supabase (região São Paulo).
2. Aplicar as migrations (procedimento de `08-deploy-producao.md`, mesmo commit do backup).
3. `restore.sh` com o backup mais recente e a chave privada (de um computador com Docker).
4. Reconfigurar Auth, SMTP, captcha, Google e URLs (checklist 12).
5. Atualizar `NEXT_PUBLIC_SUPABASE_URL` e as chaves na Vercel; novo deploy.
6. Conferir: `storage.mjs check`, login de teste, alerta público, push.

**Perda máxima de dados (RPO):** até 24 h. **Tempo de recuperação (RTO):** estimado
em 1–2 h, dominado pela reconfiguração manual (passos 1, 4 e 5).

## 6. Projeto hospedado (2G, 04/11/2026)

**Rede (verificado por DNS):** o host direto do banco (`db.<ref>.supabase.co`) só tem
IPv6; o Session pooler (`aws-1-sa-east-1.pooler.supabase.com`, porta 5432) só IPv4.
O runner do GitHub não tem IPv6 → **sempre o Session pooler**, com `?sslmode=require`.
Os scripts recusam, antes de conectar, a porta 6543 (Transaction pooler, onde o
`pg_dump` não funciona) e conexão remota sem TLS (`scripts/backup/db-url-guard.sh`).

**Permissões necessárias (por papel):**

| Uso | Credencial | Observação |
|---|---|---|
| `pg_dump` dos dados (public + auth) | senha do banco (`postgres.<ref>` no pooler) | só leitura no backup; *no hospedado, não testado* |
| Arquivos do Storage | chave secreta (`sb_secret_…`) | listar e baixar; ignora RLS: guardar só no repositório privado |
| Restaurar dados | senha do banco do projeto NOVO | `session_replication_role = replica` (receita oficial do Supabase; *não testado no hospedado*) |
| Dono/data dos arquivos | mesma | `update storage.objects` como `postgres`: *não testado no hospedado* |

**Backup do `mel-dev` não executado (bloqueio):** o `mel-dev` tem **1 conta com
e-mail real** (contagem agregada; nenhum dado lido além disso) e fotos enviadas, e
não há senha do banco guardada neste computador (o arquivo `pooler-url` só tem
host e usuário). Executar exigiria uma credencial nova e copiaria dado pessoal.
Para validar no hospedado, uma de duas: (a) autorização + senha do banco do
`mel-dev` + aceitar que o arquivo cifrado contenha essa conta (apagado ao fim), ou
(b) remover a conta real do `mel-dev` antes. O projeto `mel-prod` está pausado.

**Egress do Storage (achado):** o backup baixa todos os arquivos todo dia. O Free tem
5 GB/mês de egress (+5 GB em cache) e o app também consome. Backup completo diário
≈ 30 × tamanho do Storage: viável até ~100 MB de fotos; acima disso, arquivos
**incrementais** (os nomes são únicos e não mudam: baixar só os novos). Medir antes:
`node scripts/backup/storage.mjs stats` (sem baixar nada). `mel-dev` hoje: 1.421
arquivos, 1,2 MB (imagens de teste) → ~0,04 GB/mês.

**Reconfigurar após restaurar em projeto novo:** chaves de API e de JWT (novas: todo
mundo entra de novo; o refresh token antigo provavelmente não vale — no ensaio a
chave era a mesma), Google OAuth (URL de callback do novo projeto no Google Cloud),
SMTP (Resend), captcha (Turnstile), Site URL e Redirect URLs, limites do Auth,
`NEXT_PUBLIC_SUPABASE_URL` e chaves na Vercel.

## 7. Ativação (planejada, nada executado)

| Item | Estado |
|---|---|
| Scripts de backup, restauração e conferência | implementado |
| Ensaio local com dados sintéticos (migrations 1–31, Auth, Storage, RLS, referências) | **testado** (workflow manual) |
| Conexão pelo pooler, guardas de TLS/porta | implementado; guardas testadas; conexão real não |
| Backup de projeto hospedado | **não testado** (bloqueio acima) |
| Restauração em projeto hospedado novo | **não testado** (sem 3º projeto) |
| Repositório privado + Actions diário | planejado |
| Bucket externo (B2/R2) com retenção de 30 dias | planejado (termos/cadastro não verificados) |
| Alerta de falha + ping de vida | planejado |
| Ensaio de restauração periódico (mensal, no repositório público, sintético) | planejado (workflow pronto, manual) |
| Storage incremental | planejado (necessário acima de ~100 MB) |

Passos: (1) repositório privado `mel-backup` com cópia de `scripts/backup/` e o
workflow diário (`schedule` + `workflow_dispatch`, sem artefatos, `permissions:
contents: read`); (2) secrets: `DB_URL` (pooler, sslmode), `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `BACKUP_AGE_RECIPIENT`, credenciais do bucket só de escrita;
(3) bucket com regra de ciclo de vida de 30 dias; (4) ping de vida no fim do job;
(5) primeiro backup manual + restauração num projeto **descartável** (criar, testar,
apagar — fica no limite de 2 projetos do Free só se um dos atuais estiver pausado,
como o `mel-prod` hoje) antes de ligar o agendamento.

## 8. Backup incremental (2H, 04/11/2026)

Substitui o "baixar tudo todo dia" da 2E. Código: `scripts/backup/incremental.mjs`
(repositório via rclone: pasta local no ensaio, bucket B2/R2 em produção).

**Repositório:**

| Caminho | Conteúdo |
|---|---|
| `blobs/<chave>.age` | um arquivo do Storage, cifrado (age) |
| `blobs/<chave>.age.sha256` | sha256 do cifrado: confere sem a chave privada |
| `snapshots/<data>.tar.gz.age` | o ponto: dump do banco, contagens, dono/data dos arquivos e o manifesto (caminho → blob) |
| `snapshots/<data>.refs` | chaves dos blobs que o ponto usa (sem dados) |
| `snapshots/<data>.ok` | escrito **por último**: sha256 do snapshot e do `.refs`. Sem `.ok`, o ponto não existe |

- **Chave do blob** = sha256(bucket, caminho, eTag, tamanho, `updated_at`), calculável pela
  listagem do Storage. Só o que não está em `blobs/` é baixado. O app nunca substitui
  arquivo (`upsert: false` em todo upload), mas a política do avatar permite substituir:
  substituído → outra chave → blob novo; o antigo continua para os pontos anteriores.
- **Sem índice frágil:** o "já tenho" é a listagem de `blobs/`. Perder todos os snapshots
  não faz o próximo backup baixar tudo de novo (testado).
- **Integridade antes de restaurar:** snapshot × `.ok`; cada blob × sha256 do manifesto
  (cifrado, autenticado); age recusa cifrado alterado; tamanho × manifesto. Qualquer falha
  → nada é escrito no destino.
- **Restauração exige** `RESTORE_CONFIRM=<host do destino>`, destino com as mesmas
  migrations e sem contas.

**Consistência banco × arquivos:** ordem fixa — dump do banco → listagem/envio dos
arquivos → dono/data (`storage.objects`) → selo. Tudo que o dump referencia já existia no
dump e é listado logo depois; a janela de segundos só pode (a) deixar sem arquivo algo
apagado nesse intervalo — aparece no `storage.mjs check` da restauração — ou (b) incluir
arquivo novo sem linha no banco (órfão, a faxina apaga). As contagens conferidas são as
**do próprio dump** (`dump-counts.mjs`), não de uma consulta separada no banco vivo.

**Retenção (`prune 30`):** apaga pontos com mais de 30 dias (o mais novo fica sempre,
mesmo velho: backup parado não apaga tudo) e blobs que **nenhum ponto mantido** usa
(pelos `.refs`, cada um conferido com o seu `.ok`) e que também tenham mais de 30 dias
(um backup em andamento pode ter acabado de enviá-lo). `.refs` ausente ou adulterado
**suspende** a retenção. Sobras de backup interrompido (sem `.ok`) saem após 1 dia.

**Manifesto perdido ou corrompido:** cada ponto é independente; se um snapshot se perde,
os outros continuam restauráveis. `.refs` perdido: `rebuild-refs` (com a chave privada)
refaz a partir dos snapshots e confere com o `.ok`. O próximo backup recria tudo do zero
sem rebaixar arquivos.

**Transferência (egress do Supabase):** o banco inteiro por dia (dump, pequeno) + só os
arquivos **novos ou substituídos**. Ex.: piloto com 50 fotos novas/dia (~250 KB cada,
original + miniatura) ≈ 12 MB/dia ≈ 0,4 GB/mês, contra ~30 × o Storage inteiro antes.
Armazenamento: cada arquivo uma vez, mais as versões substituídas por até 30 dias.

**Ensaio (run `41861445673`, verde, só dados sintéticos):**

| Cenário | Resultado |
|---|---|
| 1º backup completo | 5 arquivos enviados |
| 2º sem mudanças | 0 baixados, 5 reaproveitados |
| Inclusão + substituição + exclusão, com backup interrompido no meio do envio | interrompido não vira ponto; o seguinte envia só os 2 que faltavam |
| Interrompido antes de selar | arquivo existe, mas não é ponto |
| Perda de todos os snapshots | próximo backup: 0 baixados |
| Restaurar ponto anterior | foto original e avatar antigo de volta; 53 tabelas = dump; 5/5 arquivos, 0 dono errado; 0 referência quebrada; Auth, RLS, privacidade |
| Sem confirmação / blob corrompido / snapshot adulterado | recusados; banco de destino continua vazio |
| `.refs` perdido | retenção suspensa; `rebuild-refs` refaz |
| Retenção de 30 dias (pontos e blobs envelhecidos) | 2 pontos e 3 blobs sem uso apagados; os 5 em uso ficam |
| Restaurar o ponto mais recente depois da retenção | foto nova, avatar substituído, foto apagada ausente; auditoria/impressão digital idênticas |
| Restaurar por cima | recusado |

**Ainda não comprovado:** tudo contra projeto hospedado (bloqueio da 2G) e o rclone com
bucket real (o ensaio usa pasta local, mesmo código).

## 9. Integridade do ponto (2J, 04/11/2026)

Ponto **íntegro** = `.ok` com `status: "complete"` e `missingRefs: 0`: toda referência do
banco tem arquivo, todo blob conferido. Faltando arquivo referenciado, o ponto recebe
`.incomplete` no lugar do `.ok`, `backup.sh` **falha** (sem ping de sucesso), `verify` e
a restauração o recusam antes de gravar, ele nunca é "o mais recente" e a retenção só
considera pontos íntegros (o último íntegro fica, mesmo com incompletos mais novos).
Incompletos ficam 30 dias para diagnóstico (`incremental.mjs missing <data>`, local, com a
chave privada) e não protegem blobs. Ensaio run `41885817981`: falha sem ping (5b), volta
ao íntegro (5c), recusa do incompleto (7), retenção com incompleto mais novo (8),
restauração do íntegro mais recente (9) — e todos os cenários anteriores verdes.

