# MEL — Teste no celular (rede local, só desenvolvimento)

> Diagnóstico de 2026-11-06. Nada aqui vale para produção (produção terá domínio próprio com HTTPS).

## Como está hoje (`http://172.18.4.238:3000`, mesma Wi-Fi)

| Recurso | Funciona? | Evidência / motivo |
|---|---|---|
| Navegação, cadastro, login por e-mail, alerta, avistamento, chat | ✅ | Corrigido em `34ea1b3` (`crypto.randomUUID` não existe em `http://` fora do localhost) |
| Mapa (MapTiler) | ✅ | A chave de desenvolvimento aceita a origem `http://172.18.4.238:3000`: estilo, blocos e busca de endereço respondem 200; teste automatizado vê o mapa desenhado (9 blocos, nenhum erro) |
| Login com Google | ✅ (falta só o teste com uma conta Google real) | O app pede ao Supabase `redirect_to=http://172.18.4.238:3000/auth/callback?…`; essa URL está nas *Redirect URLs* do `mel-dev` (painel) e versionada em `supabase/config.toml`. Sem isso, o Supabase devolvia para o *Site URL* (`localhost:3100`) |
| GPS ("usar minha localização") | ❌ | Navegadores só liberam geolocalização em contexto seguro (HTTPS ou localhost) |
| Notificações push e "instalar app" | ❌ | Service worker e Push API exigem contexto seguro |
| PKCE do login | ⚠️ | Sem WebCrypto em `http://`, a biblioteca usa o método `plain` em vez de `S256`. Aceitável só em desenvolvimento |

O IP `172.18.4.238` é privado e pode mudar (DHCP). Se mudar, atualizar as três listas: *Redirect URLs* do Supabase (`mel-dev`), origens da chave de desenvolvimento do MapTiler e `supabase/config.toml`.

## Para testar GPS e push: HTTPS de teste (gratuito, temporário) — escolha do proprietário

Nada abaixo foi configurado. As duas opções são sem custo; nenhuma toca produção.

### Opção A (recomendada): HTTPS só na rede local, com certificado de desenvolvimento

- Gera uma autoridade certificadora local (mkcert ou `next dev --experimental-https` com certificado para o IP) e serve o app em `https://172.18.4.238:3443`.
- O celular precisa instalar e confiar nesse certificado (configurações de segurança do Android/iOS) — só no aparelho de teste.
- **Nada fica exposto na internet.** Origem fixa: basta adicionar `https://172.18.4.238:3443` uma vez no MapTiler (chave de dev) e nas *Redirect URLs* do `mel-dev`.
- Contras: passo manual de instalar o certificado; remover do celular ao terminar.

### Opção B: túnel temporário da Cloudflare (`trycloudflare.com`)

- `cloudflared tunnel --url http://localhost:3000` gera um endereço `https://<aleatório>.trycloudflare.com` sem conta e sem custo.
- **Expõe o app de desenvolvimento (e o `mel-dev`) na internet** enquanto o túnel estiver aberto; o endereço muda a cada execução.
- Exigiria liberar a origem no MapTiler e nas *Redirect URLs* a cada execução. **Não usar curinga** (`*.trycloudflare.com`): qualquer túnel de terceiros passaria a valer para a chave do mapa e para os retornos de login do `mel-dev`.
- Precisa baixar o executável `cloudflared`.

**Recomendação:** Opção A (não expõe nada). A Opção B só para um teste rápido e supervisionado, fechando o túnel e removendo a origem ao final.
