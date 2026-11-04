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
- **Retenção (LGPD):** 30 dias corridos, apagados pela regra de ciclo de vida do
  bucket. Uma exclusão de conta some dos backups em até 30 dias; registrar isso na
  política de privacidade. Sem cópias mensais longas.
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
