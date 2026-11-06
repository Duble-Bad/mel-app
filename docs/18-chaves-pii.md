# 18 — Chaves de dados pessoais (CPF) e correção de dados pelo titular

> Decisão do proprietário (pendência 1, 2026-11-06): o CPF completo só é visto
> pelo **titular** e por **administradores autorizados explicitamente**, com
> auditoria. Moderador comum vê só o estado ("CPF informado ✓", "ilegível",
> "pendente"). As chaves de produção **ainda não estão configuradas**: este
> documento é o procedimento para quando forem.

## 1. O que está protegido e como

| Item | Como |
|---|---|
| CPF do protetor independente | Cifrado no **servidor Next.js** com AES-256-GCM (`node:crypto`), IV aleatório de 12 bytes, tag de 16 bytes, AAD = id do cadastro (o cifrado não pode ser movido para outra linha). |
| Versão da chave | Gravada em cada linha (`partner_documents.key_version`). |
| Duplicidade | HMAC-SHA256 com **chave separada** (`lookup_hmac` + `hmac_key_version`). Nunca hash simples. |
| Banco / backups | Só cifrado + HMAC. As chaves **nunca** vão para o banco, o repositório, o navegador ou os logs. |
| Estado de leitura | `partner_documents.read_state`: `ok`, `unreadable` (cifrado/IV/tag corrompidos) ou `key_unavailable` (versão de chave ausente). Nada é apagado por isso. |
| Auditoria de acesso | `partner_document_access_log` (quem, quando, qual cadastro, ação; nunca o valor). |
| Auditoria de mudanças | `personal_data_changes` (quem, qual campo, onde, quando; nunca o valor, nem parcial). |

Código: `apps/web/lib/pii/crypto.ts` (puro), `apps/web/lib/pii/partnerCpf.ts`
(regras), `apps/web/lib/pii/keys.ts` (lê o ambiente), migrations
`20261106130000`, `20261106160000` e `20261106161000`.

## 2. Quem vê o quê

- **Titular**: vê o próprio CPF mascarado (`***.***.**9-00`) e, se pedir, completo
  (cada consulta registrada). Corrige em **Perfil → Dados pessoais e documentos**
  (`/perfil/dados`).
- **Administrador** (`profiles.role = 'admin'`) **com concessão** em
  `pii_access_grants`: vê o CPF na fila de moderação (cada consulta registrada
  como `admin_view`).
- **Moderador comum**: nunca recebe o número; vê só o estado. Concessões antigas
  a moderadores ficaram na tabela, mas não valem (o servidor exige `admin`), e o
  banco recusa novas.

Conceder (SQL Editor do projeto, pelo proprietário):

```sql
-- a pessoa precisa já ser admin (npm run admin:role -- email admin)
insert into public.pii_access_grants (user_id, note) values ('<uuid>', 'motivo e data');
-- revogar
delete from public.pii_access_grants where user_id = '<uuid>';
```

## 3. Geração e guarda das chaves

São **duas chaves por ambiente** (cifra e HMAC), cada uma com 32 bytes aleatórios
em base64:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Regras de custódia:

1. Gere num computador confiável, fora de qualquer pasta sincronizada com o Git.
2. Guarde **cada versão** em **dois lugares independentes**:
   - gerenciador de senhas do responsável (item "MEL PII — produção — cifra v1",
     "… — HMAC v1"), com 2FA;
   - **cópia offline** (papel em envelope lacrado ou pendrive cifrado) em local
     físico diferente.
3. **Nunca** no repositório, no banco, em issue/chat/e-mail, em captura de tela,
   nem **junto do backup do banco** (o backup só tem cifrado; quem tiver backup +
   chave teria os CPFs).
4. Ambientes diferentes, chaves diferentes (dev ≠ produção). A chave de HMAC
   precisa ser diferente da de cifra (o app recusa iguais).
5. Registre fora do repositório: versão, data de criação, quem gerou, onde estão
   as cópias.

## 4. Configurar em produção (pendente — não feito)

1. Gerar as duas chaves (seção 3) e guardá-las **antes** de cadastrar.
2. Vercel → Projeto → Settings → Environment Variables → **Production** (marcar
   como *Sensitive*):
   `MEL_PII_ENC_KEY`, `MEL_PII_ENC_KEY_VERSION=1`, `MEL_PII_HMAC_KEY`,
   `MEL_PII_HMAC_KEY_VERSION=1` (as `*_PREVIOUS` ficam vazias).
3. Redeploy. Sem as chaves, o cadastro e a correção de CPF respondem
   "indisponível" e nada é gravado (falha segura).
4. Conferir: inscrição de protetor de teste → aparece "CPF informado ✓" na
   moderação → recusar o cadastro (apaga o CPF) → excluir a conta de teste.

## 5. Backups

- O dump do banco contém só `ciphertext`, `iv`, `auth_tag`, `lookup_hmac` e as
  versões. **As chaves não entram no backup e não podem ser guardadas com ele.**
- Para restaurar um backup antigo e ler os CPFs, é preciso ter **as versões de
  chave usadas naquelas linhas**. Por isso, uma chave aposentada fica arquivada
  (offline) até o último backup que a usa expirar (ver doc 14).

## 6. Rotação de chave (sem perda)

Quando: periodicamente (ex.: anual), troca de responsável, ou suspeita de
vazamento (aí, imediatamente).

1. Gere a chave nova (cifra e/ou HMAC) e guarde-a (seção 3) com a versão
   seguinte (ex.: v2).
2. No ambiente do servidor:
   - `MEL_PII_ENC_KEY=<nova>`, `MEL_PII_ENC_KEY_VERSION=2`,
     `MEL_PII_ENC_KEYS_PREVIOUS=1:<antiga>`;
   - HMAC, se também rodar: `MEL_PII_HMAC_KEY=<nova>`, `MEL_PII_HMAC_KEY_VERSION=2`,
     `MEL_PII_HMAC_KEYS_PREVIOUS=1:<antiga>`.
   Redeploy. A partir daqui, gravações novas usam v2; as antigas ainda abrem, e a
   **duplicidade é checada em todas as versões de HMAC** configuradas.
3. Recifrar o que já existe, num terminal com as **mesmas** variáveis:
   ```bash
   npm run pii:rotate            # simulação: só conta
   npm run pii:rotate -- --apply # recifra e recalcula o HMAC
   ```
   Fora do dev, o script exige `--confirm-target=<ref do projeto>` (trava
   `scripts/lib/safe-target.mjs`). Ele imprime só contagens. Se a maioria das
   linhas não abrir, **não marca nada** (provável chave errada) e sai com código 2.
   "Conflitos" = o titular regravou durante a rotação; rode de novo.
4. Confirmar que nada ficou para trás:
   ```sql
   select key_version, hmac_key_version, read_state, count(*)
     from public.partner_documents group by 1, 2, 3;
   ```
5. Só com **zero** linhas em v1: remover `*_PREVIOUS` do ambiente e redeploy.
   Arquivar a chave v1 offline (seção 5); não destruir enquanto houver backup
   que dependa dela.

## 7. Dado ilegível ou indisponível

O servidor nunca cai nem apaga nada quando um CPF não abre:

- `unreadable`: o cifrado, o IV ou a tag foram alterados/corrompidos (ou a
  chave daquela versão foi trocada por outra).
- `key_unavailable`: a versão gravada não está no ambiente.

O estado é marcado quando alguém tenta ler (titular, admin) ou pelo
`pii:rotate --apply`. Efeitos:

- conta e cadastro continuam; um cadastro aprovado continua aprovado;
- a moderação vê "CPF ilegível/indisponível" e **não consegue aprovar** um
  cadastro pendente com CPF nesse estado (RPC e trigger);
- o titular vê o aviso e o caminho seguro: **cadastrar o CPF de novo** em
  `/perfil/dados` (confirma a identidade antes). O CPF novo passa por
  validação, checagem de duplicidade e **volta para a análise da moderação** —
  a aprovação anterior não é transferida;
- se a chave reaparecer (restaurada da cópia), a próxima leitura ou o
  `pii:rotate --apply` volta a linha para `ok`.

## 8. Chave perdida

Não há recuperação matemática de um valor AES-256-GCM sem a chave — **não
prometa recuperar**.

1. Procure as cópias (gerenciador e offline). Achou: configure como versão
   anterior (`*_PREVIOUS`) e rode `pii:rotate -- --apply`.
2. Não achou (cifra perdida): gere chave nova com versão nova; rode
   `pii:rotate -- --apply --force-mark` para marcar as linhas como
   `key_unavailable` (sem `--force-mark` o script se recusa, por segurança).
   As contas ficam; avise os protetores afetados para cadastrar o CPF de novo em
   `/perfil/dados` (cada um volta para análise).
3. Perdeu só a chave do **HMAC** (a de cifra existe): gere HMAC nova (versão
   nova) e rode `pii:rotate -- --apply` — o HMAC é recalculado a partir do CPF
   decifrado, sem perda e sem envolver os titulares.
4. Chave **vazada** (não perdida): rotação imediata (seção 6), revogação de
   acessos, análise de incidente e, se houver risco relevante aos titulares,
   comunicação à ANPD e aos titulares (LGPD art. 48).

## 9. Correção de dados pelo titular (`/perfil/dados`)

- Mostra tudo **mascarado** (o servidor mascara; o valor inteiro nunca chega ao
  navegador). Para corrigir, a pessoa digita o valor novo (máscara de
  digitação só na tela; o banco guarda a forma canônica sem pontuação).
- **Confirmação recente de identidade**: o servidor lê o claim `amr` do JWT
  (verificado por `getClaims`); se o último login forte foi há mais de 10 min,
  pede a senha de novo (rota `/api/perfil/reautenticar`, que faz o login com o
  e-mail da própria sessão) ou o Google de novo (contas Google). `token_refresh`
  e sessão anônima não contam. O banco aplica a mesma regra
  (`private.has_recent_auth`) na troca de CNPJ/telefone de parceiro e no
  WhatsApp da fila de adoção — mesmo fora do app.
- **CPF**: validado, duplicidade em todas as versões de HMAC (atômica, sob trava),
  cifrado, volta para análise; auditoria sem valor.
- **CNPJ**: validado (numérico ou alfanumérico) no app e no banco; a verificação
  volta para "pendente"; aprovado volta para análise. Consulta externa segue
  desligada: nunca vira "verificado" sozinho.
- **Telefones** (parceiro, fila de adoção, alertas ativos): mesma regra no app e
  no banco (DDD existente; celular 11 dígitos com 9; fixo 10 dígitos começando
  em 2–5). Guardado como DDD + número; o E.164 é `+55` + isso (links `wa.me`/`tel:`).
  "Formato válido" ≠ "confirmado": não há SMS, todos ficam "não confirmado".
  Linhas antigas fora do padrão **não são reescritas**: aparecem como "precisa
  ser corrigido" e só são validadas quando mudam.
- **E-mail**: só pelo fluxo seguro do Supabase Auth (`updateUser({ email })`, com
  `double_confirm_changes`: links no e-mail atual e no novo). A tela mostra
  "troca pendente" (de `auth.users.email_change`) até confirmar. `profiles` não
  guarda e-mail; a fonte única é `auth.users` (sem divergência possível).
  Formato válido ≠ verificado.
- Escopo: perfis com telefones em `profiles.phone_private/whatsapp_private` não
  têm tela (colunas sem uso no app); estão validadas e auditadas no banco.
