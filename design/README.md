# MEL — Redesign: Etapa 1 (aguardando aprovação)

Nada desta pasta está no app. O redesign definitivo só começa depois que o proprietário escolher o conceito.

## Como abrir os protótipos

```
node design/prototipos/servidor.mjs
```

- Computador: http://localhost:4173
- Celular (mesma rede Wi-Fi): http://<ip-do-pc>:4173 (o servidor mostra o endereço ao iniciar)

| Conceito | Endereço | Telas |
|---|---|---|
| A — Comunidade e acolhimento | `/conceito-a/` | Homepage |
| **B — Moderna e dinâmica (recomendado)** | `/conceito-b/` | Homepage, `entrar.html`, `mapa.html`, `mural.html`, `adocao.html`, `parceiros.html` |
| C — Ação imediata | `/conceito-c/` | Homepage (com prévia do alerta em 3 passos) |

Apenas HTML/CSS/JS, sem bibliotecas, sem banco, com dados fictícios. As animações respeitam `prefers-reduced-motion`. Fotos: Unsplash (ver `prototipos/assets/fotos/CREDITOS.md`). Logo e fonte (Figtree) são os do app.

## Recomendação: Conceito B

Segue as referências visuais enviadas pelo proprietário: azul-escuro e dourado, hero forte, cartões de ação coloridos. No celular, as quatro ações ficam na primeira tela, que é o ponto forte do Conceito C. Do Conceito A, pode herdar as histórias de reencontro.

## Especificações funcionais

`design/especificacoes-fluxos.md`: Adoção (inclui fila de interessados sem animal disponível), Mural e Parceiros, cada um com lacunas frente ao schema atual, decisões para o proprietário e migrations propostas. As migrations não estão escritas e dependem de aprovação.

## Pendências de configuração manual (sem custo)

1. **MapTiler, origens permitidas:** a chave de desenvolvimento só aceita `localhost`. Pelo celular (`http://172.18.4.238:3000`), o estilo do mapa volta 403 e o mapa não aparece.
   - Onde: painel do MapTiler → Account → API keys → a chave usada → Allowed HTTP origins.
   - O que fazer: adicionar o endereço da rede local.
   - Produção: a chave de produção precisa conter o domínio final (checklist 5.2).
2. **Supabase mel-dev, Redirect URLs:** o login com Google pelo celular volta para `localhost:3100`. O endereço `http://172.18.4.238:3000` não está na lista, então o Supabase usa o Site URL.
   - Onde: painel → Authentication → URL Configuration → Redirect URLs.
   - O que fazer: adicionar `http://172.18.4.238:3000/**`.
   - Por que não usar `supabase config push`: ele também desfaria ajustes feitos só no painel (limites de taxa 300 e assuntos dos e-mails).
3. **Senha:** a regra real é de pelo menos 8 caracteres (app e Supabase). A referência visual mostra "maiúscula + número"; adotar isso é uma decisão nova.
