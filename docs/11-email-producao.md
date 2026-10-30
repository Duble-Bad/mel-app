# MEL — E-mail transacional de produção (SMTP + Auth)

> Estado: **preparado, nada configurado no `mel-prod`.** Depende de domínio próprio (ainda não comprado).
> Ordem obrigatória: domínio → SMTP → templates → testes → "Confirm email" ON → (depois) Google.

## Provedor

| | Principal: **Resend** | Alternativa: **Amazon SES** (região São Paulo, `sa-east-1`) |
|---|---|---|
| Custo inicial | Plano gratuito (3.000/mês, **100/dia**, 1 domínio) se ainda disponível para contas novas — confirmar em resend.com/pricing; Pro US$ 20/mês (50.000/mês) | ~US$ 0,10 por 1.000 e-mails |
| Integração com Supabase | SMTP direto (`smtp.resend.com`), guia oficial dos dois lados | SMTP (`email-smtp.sa-east-1.amazonaws.com`) com credencial IAM própria |
| Domínio / SPF / DKIM | Painel mostra os registros DNS prontos | Idem, mas com mais passos (identidade, DKIM, MAIL FROM) |
| Esforço | Baixo | Médio: sair do *sandbox* (pedido de produção), IAM, monitorar bounces |
| Quando faz sentido | Agora: baixo volume, uma pessoa operando, simplicidade | Se o volume crescer muito e custo virar prioridade |

**Escolha: Resend.** Configuração mais simples com o Supabase, DKIM/SPF guiados, entregabilidade boa para transacional e caminho de crescimento previsível. Não foi escolhido pelo gratuito: o limite de **100 e-mails/dia** do plano gratuito não serve para o lançamento público — **assinar o Pro antes de abrir ao público** (um pico de cadastros esgota 100/dia em minutos e ninguém recebe confirmação).

## Domínio: necessário agora

Nenhum provedor sério envia de `@gmail.com` ou de domínio que você não controla. O remetente precisa ser `@<domínio-da-MEL>` com SPF, DKIM e DMARC no DNS desse domínio. Além disso, o próprio link dos e-mails usa a **Site URL** do Supabase (domínio de produção), e o Google OAuth também precisa do domínio (tela de consentimento, URLs).

Por que não deixar para o fim: a confirmação de e-mail é pré-requisito do Google e do lançamento; registro `.com.br` exige CPF/CNPJ e propagação de DNS; e a reputação de envio de um domínio novo leva dias para se firmar (começar a enviar só no dia do lançamento aumenta a chance de cair no spam).

Recomendação: enviar de um **subdomínio de e-mail** (ex.: `mail.<domínio>`, a definir) e usar como remetente `nao-responda@<domínio>` com nome **MEL**. Isola a reputação do e-mail transacional do resto do domínio.

## DNS (valores exatos vêm do painel do provedor — não copie de exemplos)

- **SPF:** o TXT que o provedor indicar no subdomínio de envio (no Resend, em `send.<subdomínio>` junto com um MX de retorno). Um único registro SPF por nome.
- **DKIM:** o TXT `resend._domainkey…` (chave pública) gerado pelo provedor.
- **DMARC:** TXT em `_dmarc.<domínio>` começando por `v=DMARC1; p=none; rua=mailto:<caixa-da-MEL>` por 1–2 semanas; depois `p=quarantine` (e, com relatórios limpos, `p=reject`). Sem DMARC, qualquer um pode se passar pela MEL com mais facilidade e Gmail/Yahoo penalizam.
- **Outros:** nenhum para o app. Se a MEL receber e-mail no domínio (ex.: suporte), o MX do domínio raiz é outro assunto (provedor de caixa postal).

## Supabase `mel-prod` — Authentication → Emails → SMTP Settings

| Campo | Valor / origem |
|---|---|
| Enable custom SMTP | ON |
| Sender email | `nao-responda@<domínio>` (**DEPENDE DO DOMÍNIO**) |
| Sender name | `MEL` |
| Host | `smtp.resend.com` |
| Port | `465` (TLS implícito) — ou `587` (STARTTLS) |
| Username | `resend` |
| Password | Chave de API do Resend **só de envio, restrita ao domínio da MEL**, criada no painel do Resend e colada **direto aqui**. Nunca no repositório, `.env`, `NEXT_PUBLIC_*`, log ou chat. O app não precisa dela. |
| Minimum interval per user | 60 s (padrão) |

**Authentication → Rate Limits → e-mails enviados por hora** (vale para o projeto inteiro): 30/h durante os testes; **100/h no lançamento** (com Resend Pro). Ajustar olhando o volume real.

**Authentication → Sign In / Providers → Email:** "Email OTP Expiration" **3600 s** (os e-mails dizem "vale por 1 hora"); "Secure email change" ON; "Secure password change" OFF (exige reautenticação por e-mail que o app ainda não trata).

## Templates (Authentication → Emails → Templates)

Colar o HTML dos arquivos do repositório (são os mesmos usados no ambiente local/CI):

| Template no painel | Assunto | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu e-mail na MEL | `supabase/templates/confirmacao.html` |
| Reset password | Crie uma senha nova na MEL | `supabase/templates/recuperar-senha.html` |
| Change email address | Confirme seu e-mail na MEL | `supabase/templates/troca-email.html` (também é o da conversão anônimo → conta com "Confirm email" ON) |

Não usados hoje (deixar o padrão, nada no app os dispara): Magic link, Invite user, Reauthentication. `codigo.html` fica para um futuro "entrar com código".

Todos os links vão para `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=…`. A página só confirma com um clique (leitores de e-mail que abrem links sozinhos não gastam o token) e funciona em qualquer aparelho (o link costuma abrir no app de e-mail, não no navegador do cadastro).

## Ordem

1. Comprar o domínio (dono) e decidir o subdomínio de envio.
2. Conta no Resend da MEL (e-mail da MEL, nunca de empregador); adicionar o domínio; criar SPF, DKIM e DMARC (`p=none`) no DNS; esperar "Verified".
3. Supabase `mel-prod`: Site URL e Redirect URLs do domínio (ver [10-status.md](10-status.md)).
4. Criar a chave de envio restrita e preencher **SMTP Settings** (colando a chave só no painel).
5. Colar os 3 templates e assuntos; "Email OTP Expiration" 3600 s.
6. Teste manual com uma conta de teste sua: recuperação de senha (com "Confirm email" ainda OFF) — e-mail chega, não cai em spam, link abre `/auth/confirmar`, senha nova funciona.
7. **"Confirm email" ON.** Testar: cadastro novo (mensagem "confira seu e-mail", link em outro aparelho, onboarding); visitante sem conta que cria conta (link "Confirme seu e-mail", mesma conta, contribuições mantidas).
8. Rate limit de e-mail para 100/h e Resend Pro **antes** de abrir ao público.
9. Depois de 1–2 semanas de relatórios DMARC limpos: `p=quarantine`.
10. Só então seguir para o Google OAuth.

## Verificado no código (CI, ambiente descartável com "Confirm email" ON + Mailpit)

`packages/data/tests/email-confirmation.test.ts`: cadastro sem sessão imediata; link do nosso template confirma em **outro** aparelho e só uma vez; e-mail já cadastrado recebe a mesma resposta neutra sem criar segundo usuário; recuperação abre sessão e salva a senha nova; sessão anônima → conta só vira conta no link, com o **mesmo id** e a contribuição mantida.
