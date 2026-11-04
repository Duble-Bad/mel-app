# 16 — Guia de ativação do backup (para o proprietário)

Passo a passo para configurar o backup privado da MEL **sem programar** e **sem passar
nenhuma credencial para ninguém** (nem para Claude, ChatGPT, e-mail ou arquivo do projeto).
Painéis conferidos nas documentações oficiais em 04/11/2026; se a tela estiver diferente,
**pare** e peça ajuda descrevendo a tela (sem mostrar valores secretos).

**Regras de ouro**
- Senhas, chaves e tokens são digitados/colados **só** no painel do serviço que pede.
- Nunca mande print de tela com chave aparecendo. Nunca cole chave em conversa.
- O que é público pode ser compartilhado: a chave **pública** age (começa com `age1`), o
  nome do bucket, o nome do repositório.
- Nesta fase **nenhum dado real** é copiado: só se criam contas, chaves e o repositório.
- Cada **PARE** abaixo é um ponto de autorização.

**Custo esperado: R$ 0** (franquias gratuitas). Dúvidas abertas no fim.

---

## Passo 1 — Repositório privado `mel-backup` (GitHub)

**Onde:** github.com → canto superior direito **+** → **New repository**.

**Preencher:**
- **Owner:** a sua conta pessoal (a mesma do `mel-app`).
- **Repository name:** `mel-backup`
- **Description:** `Backup privado da MEL` (opcional)
- Visibilidade: **Private** ⚠️ (nunca Public)
- Marque a opção de criar um **README**.
- **Create repository**.

**Não colocar nada mais** no repositório por enquanto.

**Confirmar:** a página do repositório mostra o selo **Private**.

**Nunca:** adicionar colaboradores; tornar público.

> No GitHub Free, repositório privado **não tem "Environments"**; os segredos serão do
> repositório (passo 5). Isso já está previsto no modelo do workflow.

---

## Passo 2 — Conta e bucket no Backblaze B2

**Antes:** escolha a **região** — ela é **definitiva** (EUA Leste, EUA Oeste, UE Central ou
Canadá). Recomendação: **EU Central** (LGPD e GDPR são parecidas). **PARE** se tiver dúvida.

**Onde:** backblaze.com → **B2 Cloud Storage** → **Sign Up** (não pede cartão).
Ative a verificação em duas etapas da conta (Account → Security).

**Bucket:** menu **B2 Cloud Storage → Buckets → Create a Bucket**
- **Bucket Unique Name:** algo **não óbvio**, 6 a 63 caracteres, letras/números/hífen,
  sem começar com `b2-` (ex.: `mel-bkp-` + 8 caracteres aleatórios).
- **Files in Bucket are:** **Private** ⚠️
- **Default Encryption:** Enable (se aparecer).
- **Object Lock:** Disable (a retenção precisa apagar).
- **Create a Bucket**.

**Ciclo de vida:** no bucket → **Lifecycle Settings** → **Keep prior versions for this
number of days** → **7** → salvar. (O que o backup apagar fica recuperável por 7 dias.)

**Teto de gasto:** menu **Caps & Alerts** → defina limite diário **US$ 0** (ou o mínimo
permitido) em armazenamento, download e transações, e marque os alertas por e-mail.

**Confirmar:** o bucket aparece como **Private** e com a regra de 7 dias.

**Nunca:** deixar o bucket Public; usar a **Master Application Key** em qualquer lugar.

---

## Passo 3 — Chave de acesso do bucket (permissão mínima pelo painel)

**Onde:** **B2 Cloud Storage → Application Keys → Add a New Application Key**
- **Name of Key:** `mel-backup-github`
- **Allow access to Bucket(s):** **somente** o bucket do passo 2.
- **Type of Access:** **Read and Write**
- **Allow List All Bucket Names:** marcar (só revela nomes de buckets; o programa de
  cópia pode precisar).
- **File name prefix:** `mel/`
- **Duration:** em branco (sem expiração) ou 1 ano, com lembrete para renovar.
- **Create New Key**.

A tela mostra **keyID** e **applicationKey** **uma única vez**. Não copie para lugar
nenhum além do **passo 5** (deixe a aba aberta até lá) e do seu gerenciador de senhas.

**Por que "Read and Write":** é o mínimo oferecido pelo painel que permite o backup
conferir o que já foi copiado. Ela também permite apagar, mas apagar só **oculta** o
arquivo, que a regra de 7 dias guarda. (Uma chave sem permissão de apagar existe, mas só
por linha de comando; opcional, para depois.)

**Faça também agora uma 2ª chave**, **Read Only**, mesmo bucket e prefixo, nome
`mel-backup-restaurar`. Ela **não** vai para o GitHub: fica só no gerenciador de senhas,
para o dia de restaurar.

**Confirmar:** a lista de chaves mostra as duas, ligadas só ao seu bucket.

---

## Passo 4 — Chaves de criptografia (age)

São elas que garantem que nem o Backblaze nem o GitHub conseguem ler o backup.

**No seu computador (Windows):** abra o **Terminal** e rode
`winget install FiloSottile.age` e depois `age-keygen -o mel-backup-age.txt`.
- O terminal mostra uma linha `Public key: age1…` — essa é a **pública** (pode anotar).
- O arquivo `mel-backup-age.txt` tem a **privada** (`AGE-SECRET-KEY-…`).

**Guardar a privada (obrigatório, nos dois):**
1. no gerenciador de senhas (anexo ou nota segura);
2. numa cópia offline (pendrive guardado ou papel em local seguro).
Depois **apague** o arquivo da pasta onde foi gerado.

**Nunca:** colocar a chave privada no GitHub, no Backblaze, em e-mail, nuvem comum ou
conversa. **Sem ela, nenhum backup pode ser aberto — por ninguém.**

**Confirmar:** você consegue abrir a chave privada no gerenciador de senhas.

---

## Passo 5 — Segredos no repositório `mel-backup`

**Onde:** repositório `mel-backup` → **Settings** → (seção Security) **Secrets and
variables** → **Actions** → aba **Secrets** → **New repository secret**. Para cada um:
**Name** exatamente como abaixo, **Secret** = o valor, **Add secret**.

| Name | Valor (de onde vem) |
|---|---|
| `B2_KEY_ID` | keyID da chave `mel-backup-github` (passo 3) |
| `B2_KEY` | applicationKey da mesma chave |
| `B2_BUCKET` | nome do bucket (passo 2) |
| `BACKUP_AGE_RECIPIENT` | a chave **pública** `age1…` (passo 4) |
| `HEALTHCHECK_URL` | URL do passo 6 |
| `SUPABASE_URL` | **só na autorização do 1º teste** (passo 8) |
| `SUPABASE_SECRET_KEY` | **só na autorização do 1º teste** |
| `DB_URL` | **só na autorização do 1º teste** |

**Confirmar:** a lista mostra os nomes (o GitHub nunca mostra os valores de novo — é normal).

**PARE:** os três últimos dão acesso ao banco; só entram depois da autorização do passo 8.

---

## Passo 6 — Alerta de falha (healthchecks.io)

**Onde:** healthchecks.io → **Sign Up** (plano **Hobbyist**, grátis, 20 verificações).
- **Add Check** → **Name:** `MEL backup diário`
- **Schedule:** **Simple** → **Period:** 1 day → **Grace Time:** 6 hours.
- Copie a **ping URL** (`https://hc-ping.com/…`) direto para o secret `HEALTHCHECK_URL`.
- Aba **Integrations**: confirme que o **e-mail** está ativo para este check.

**Confirmar:** o check aparece como "new" (cinza) — vira verde no 1º backup.

**Nunca:** publicar a ping URL (quem tem a URL pode "fingir" um backup ok).

---

## Passo 7 — Workflow manual (sem agendamento)

**PARE e peça autorização antes:** este passo prepara o arquivo que um dia rodará o backup.

1. Escolha o commit do `mel-app` revisado (o mais recente com CI verde; anote o SHA).
2. No `mel-backup`: **Add file → Create new file** → nome `.github/workflows/backup.yml`.
3. Cole o conteúdo de `docs/backup/mel-backup-workflow.yml.example` e troque:
   `<SHA do commit revisado do mel-app>` pelo SHA e `<dono>` pelo seu usuário do GitHub.
4. Confira que as linhas de `schedule:` **continuam comentadas** (começam com `#`).
5. **Commit changes**.

**Confirmar:** aba **Actions** mostra "Backup da MEL" com o botão **Run workflow**, e
nenhuma execução aconteceu sozinha.

**Não clique em Run workflow** antes do passo 8.

---

## Passo 8 — Primeiro teste real (checklist de autorização)

Só com **autorização escrita, com data**, marcando cada item:

- [ ] Passos 1–7 concluídos e conferidos.
- [ ] Decidido o que fazer com a **conta real** do `mel-dev`: ela vai **cifrada** para o
      bucket privado e é preservada no `mel-dev` (nada é apagado lá).
- [ ] Secrets do banco cadastrados por você no painel: `SUPABASE_URL`,
      `SUPABASE_SECRET_KEY` e `DB_URL` = Supabase → projeto **mel-dev** → **Connect** →
      **Session pooler** (porta **5432**) + senha do banco + `?sslmode=require` no final.
      **Nunca** dados do `mel-prod`.
- [ ] Nenhum CI do `mel-app` rodando (aba Actions do `mel-app` sem execução amarela).
- [ ] Run workflow → tarefa **backup**. Esperado: tudo verde, check do healthchecks verde.
      O backup **só lê** o `mel-dev`.
- [ ] Run workflow → tarefa **verificacao-completa**: verde.
- [ ] Restauração **local e isolada** (com quem for ajudar, num computador com Docker):
      Supabase local, chave **Read Only** do passo 3 e a chave privada do passo 4 usadas
      só ali; conferências do `restore.sh` verdes; depois apagar o Supabase local e a pasta.
- [ ] Agendamento **continua desligado** até nova autorização (ACTIVE: doc 15, seção 5).

---

## Dúvidas para resolver antes de começar

1. **Região do B2** (definitiva): EU Central (recomendado) ou EUA?
2. **Conta real do `mel-dev`:** aceitar que vá cifrada para o backup de teste?
3. **Quem fará a restauração local** (passo 8) — precisa de um computador com Docker.
4. **Política de privacidade:** mencionar backup cifrado fora do Brasil, retenção de até
   ~37 dias (30 + 7 de versões).

## Riscos e dependências

- Perder a chave privada age = perder todos os backups (por isso, 2 cópias).
- A chave "Read and Write" pode ocultar arquivos; a regra de 7 dias permite recuperar.
- Custos: R$ 0 dentro das franquias (B2 10 GB; Actions privado ~US$ 12/mês de crédito ≈
  2.000 min; healthchecks 20 checks). O backup diário leva poucos minutos.
- Pendentes (não confirmados em documentação oficial): se teto de US$ 0 ainda permite usar
  a franquia grátis (se o painel recusar US$ 0, usar US$ 1); o que o B2 faz ao atingir o teto
  (provavelmente recusa, o que faria o backup falhar e o alerta avisar); se o checkout do
  `mel-app` público funciona com `contents: read` (esperado); regra de 60 dias sem
  atividade para agendamentos em repositório privado (documentada só para público).
