# MEL — Teste no celular (rede local, só desenvolvimento)

> Atualizado em 2026-11-06. Opção escolhida pelo proprietário: **HTTPS local** (sem túnel público, sem custo, nada exposto na internet). Nada aqui vale para produção.

## Endereços (mesma Wi-Fi do PC)

| Endereço | Para quê |
|---|---|
| **https://172.18.4.238:3443** | App com HTTPS (GPS, push, instalar app) — exige o certificado de teste no celular |
| http://172.18.4.238:3080 | Página para baixar o certificado **público** da CA de teste |
| http://172.18.4.238:3000 | App em HTTP (continua funcionando; sem GPS e sem push) |

## Como funciona

- `npm run dev:https:certificados` cria, **fora do repositório** (`~/.mel-dev-https`), uma CA só deste PC e um certificado para `172.18.4.238` (válido até 12/2027). A chave privada da CA nunca sai do PC.
- `npm run dev:https` liga um proxy TLS na porta 3443 que repassa para o app na porta 3000, e a página do certificado na 3080. Só escuta a rede local.
- O app passa a montar redirecionamentos e a checagem de mesma origem a partir do endereço que o navegador usou (`apps/web/lib/origin.ts`). Antes, com o servidor em `0.0.0.0`, o retorno do login ia para `http://0.0.0.0:3000` e as APIs de parceiro, CPF, `/perfil/dados` e exclusão de conta recusavam o próprio site.
- Se o IP do PC mudar: gerar de novo o certificado com o IP novo (`bash scripts/dev-https/gerar-certificados.sh <ip>`) e atualizar as listas do MapTiler e do Supabase.

## Religar depois de reiniciar o PC

1. App: build com `NEXT_PUBLIC_SITE_URL=https://172.18.4.238:3443` e `npx --workspace web next start -H 0.0.0.0 -p 3000`.
2. `npm run dev:https`.
3. Durante o teste de push: `npm run dev:push` (dispara o envio a cada 20 s; em produção é o agendador).

## Instalar o certificado no celular (com o proprietário, só no aparelho de teste)

Confira a impressão digital SHA-256 da CA se o celular mostrar: `68:D0:46:30:…:86:3A:DC:F6`.

**Android (Chrome)**
1. No celular, abra `http://172.18.4.238:3080` e toque em **Baixar certificado (Android)**.
2. Configurações → Segurança e privacidade → Mais configurações de segurança → Criptografia e credenciais → **Instalar um certificado → Certificado de CA** → "Instalar assim mesmo" → escolha `mel-dev-ca.cer`. (O Android exige bloqueio de tela.)
3. Abra **https://172.18.4.238:3443** no Chrome: deve abrir sem aviso de segurança.
4. Ao terminar: Criptografia e credenciais → Credenciais confiáveis → aba **Usuário** → "MEL DEV CA local" → Remover.

**iPhone (Safari)**
1. No Safari, abra `http://172.18.4.238:3080` → **Baixar certificado (iPhone)** → Permitir.
2. Ajustes → Geral → VPN e Gerenciamento de Dispositivos → perfil "MEL DEV CA local" → Instalar.
3. Ajustes → Geral → Sobre → **Ajustes de Confiança de Certificados** → ative "MEL DEV CA local".
4. Abra **https://172.18.4.238:3443** no Safari.
5. Para push no iPhone (iOS 16.4+): Compartilhar → **Adicionar à Tela de Início** e abra pelo ícone.
6. Ao terminar: remova o perfil em VPN e Gerenciamento de Dispositivos.

## Roteiro de teste manual (ainda não executado — registrar o resultado de cada item)

| # | Teste | Como |
|---|---|---|
| 1 | Login com Google | Entrar → Continuar com Google → volta logado para o app em `https://…:3443`. Depende do item "Bloqueio" abaixo; até lá, testar pelo `http://…:3000` |
| 2 | Cadastro e onboarding | Entrar → Criar conta (e-mail de teste seu) → completar "Que bom ter você na rede MEL" → Perfil |
| 3 | Mapa MEL e localização | Mapa da Rede → alternar Lista/Mapa → tocar numa área → painel com os dados; "Perto de mim" |
| 4 | GPS no celular | Perdi meu pet → etapa "Onde" → "Usar minha localização atual" → permitir → ponto no mapa |
| 5 | Notificações push | Com `npm run dev:push` rodando no PC: Perfil → ativar notificações (ou Guardião) → em outro aparelho/aba, enviar um avistamento ou mensagem → notificação chega no celular |
| 6 | Cadastro de interessado em adoção | Adoção → Quero adotar → preencher → "Em análise"; aprovar no /admin com um moderador de teste |
| 7 | Chat privado de adoção | Interessado: ligar "Aceito ser contatado por quem anuncia" (precisa estar aprovado e na lista pública). Anunciante com anúncio aprovado: Adoção → aba Quero adotar → "Conversar" → mensagem → conversa aparece para os dois em Conversas |
| 8 | Correção de dados | Perfil → Meus dados (`/perfil/dados`) → corrigir telefone (DDD inválido deve ser recusado) e pedir troca de e-mail (fica "pendente" até confirmar nos dois e-mails) |

## Bloqueio real

- **Supabase `mel-dev` → Authentication → URL Configuration → Redirect URLs:** incluir `https://172.18.4.238:3443/**` (já versionado em `supabase/config.toml`). Sem isso, login com Google e links de e-mail feitos pelo endereço HTTPS voltam para `localhost:3100`. Não usamos `supabase config push` porque ele desfaria ajustes feitos só no painel.
- MapTiler: a chave de desenvolvimento já aceita `https://172.18.4.238:3443` (estilo do mapa responde 200).

## Verificado automaticamente (2026-11-06)

- Cadeia TLS validada pela CA local; cliente sem a CA é recusado (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`).
- Em `https://172.18.4.238:3443`: contexto seguro, `crypto.randomUUID`, service worker, Push API e geolocalização disponíveis; mapa desenhado; o app pede ao Google `redirect_to=https://172.18.4.238:3443/auth/callback…`.
- Retorno do login: `https://…:3443/entrar…` pelo HTTPS e `http://…:3000/entrar…` pelo HTTP (antes: `http://0.0.0.0:3000`).
- Disparo de push em DEV responde 200.
- E2E 77/77 depois da correção de origem.
