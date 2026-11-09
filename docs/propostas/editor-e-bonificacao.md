# Propostas: "Criar cartaz" (três modelos) e bonificação (aguardando aprovação)

Protótipos internos (DEV, `MEL_DEV_ROUTES=1`). **Nada foi gravado no banco e não há migration.**
A estrutura abaixo só será feita depois da aprovação do proprietário (`decisoes-pendentes.md`, itens 7 e 8). A demonstração não grava nada.

## 1. "Criar cartaz": três modelos por formato, escolhidos pelo tutor

**Demonstração:** `/alerta/{código}/cartaz/criar` (o protótipo antigo `/cartaz/editor` redireciona para cá). Entrada "Criar cartaz" na página do alerta, só para o tutor, com o alerta ativo e só em DEV.

### Fluxo

1. **Formato:** A4 (imprimir), Quadrado (redes sociais), Feed 4:5, Stories/Status, Horizontal.
2. **Modelo:** três prévias reais, geradas na hora com as fotos e os dados públicos do alerta. Uma leva o selo "Recomendado pela MEL", com o motivo.
3. **Personalizar (opcional; "Pular personalização" vai direto para Usar):**
   - **1. Foto principal:** a foto maior do cartaz.
   - **2. Fotos complementares (até 2):** fotos menores, ao lado ou abaixo da principal, para mostrar outros ângulos (rosto, corpo, marcas). Os números 1 e 2 e as setas ‹ › definem a ordem em que aparecem (a 1 vem primeiro, à esquerda ou em cima). Não existem no Modelo 1.
   - **3. Enquadramento da principal:** arrastar e aproximar (mouse, toque, pinça, setas e + − do teclado).
   - "Restaurar o modelo original", com "Desfazer".
   A personalização é independente por formato e por modelo.
   **Limitação conhecida:** o modelo mostra só as fotos que cabem sem ficar estreitas demais. No Modelo 3 em A4 e em 4:5, por exemplo, cabem a principal e 1 complementar: a 2ª complementar escolhida não aparece no cartaz e a tela não avisa (o aviso "Mostra 2 de 3 fotos" só aparece na etapa Modelo). Correção proposta: decisões pendentes, item 7d.
4. **Usar:**
   - Baixar: o PNG final, com o modelo no nome do arquivo.
   - Imprimir: página só com o cartaz; A4 sem margens e diálogo de impressão automático.
   - Compartilhar: compartilhamento nativo com arquivo; sem ele, baixa o cartaz e copia o link do alerta.
   - Copiar link do alerta.
   - Trocar de modelo ou de formato a qualquer momento.

### Os modelos (`lib/poster/models.ts`, `PosterModels.tsx`, `PosterV2.tsx`)

| Modelo | Ideia | Como se adapta às fotos |
|---|---|---|
| 1 — Foto em destaque | Uma foto grande, com o nome sobre ela (degradê) | Foto horizontal: larga em cima. Foto vertical: alta ao lado do texto (quadrado, 4:5, A4). Horizontal: foto à direita |
| 2 — Várias fotos | Principal + até duas complementares | Complementares empilhadas ou lado a lado, conforme o formato de cada foto. Com 1 foto vertical, ou 1 complementar horizontal numa coluna alta, o espaço que sobraria vira o quadro "Como reconhecer" |
| 3 — Clássico de poste | Fundo claro, fotos lado a lado, descrição e faixa vermelha com o QR | As fotos ficam na própria proporção; usa menos fotos se alguma fosse ficar estreita ou cortada demais; a sobra da linha vira o quadro "Como reconhecer" |

Regras comuns:
- nenhuma foto inteira sobre fundo desfocado;
- corte máximo controlado;
- texto do quadro com a letra do maior tamanho que couber;
- selo da bonificação só quando existir;
- a área de fotos cede espaço ao selo.

### Recomendação (critérios verificáveis, sem análise do conteúdo das fotos)

Os critérios são: quantidade de fotos, orientação, resolução da principal (lado menor < 640 px = pequena) e finalidade do formato. Por exemplo:
- **A4:** foto pequena ou 2+ fotos → Modelo 3.
- **Horizontal:** Modelo 1.
- **Principal pequena com 2+ fotos:** Modelo 2.
- **3+ fotos no Stories ou 4:5:** Modelo 2.
- **Demais casos:** Modelo 1.
- **Sem fotos:** Modelo 3.

### Limitações da demonstração

- Personalizar: uma complementar escolhida pode ficar de fora do cartaz sem aviso quando o modelo não comporta três fotos (item 7d de decisões pendentes).
- A escolha fica no endereço da página. Recarregar mantém, mas outro aparelho não; nada é gravado no servidor e não há localStorage.
- Gated por `MEL_DEV_ROUTES=1`. Liberar para os usuários depende da aprovação do proprietário.

### Persistência proposta (exige migration)

- Tabela `poster_designs`, um registro por alerta e formato:
  - colunas: `lost_case_id`, `format` (check nos 5), `model` (1–3), `photo_ids uuid[]` (1–3, a principal primeiro), `focus_x`/`focus_y` (0–100), `zoom` (1–3), `updated_at`;
  - chave única `(lost_case_id, format)`;
  - RLS sem escrita direta.
- RPC `save_poster_design(code, format, model, photo_ids, focus_x, focus_y, zoom)` com `security definer`. Ela valida:
  - que `auth.uid()` é o tutor;
  - que o alerta está ativo;
  - que as fotos são do pet.
  - `reset_poster_design(code, format)` faz o mesmo para restaurar.
- Leitura: `get_public_lost_case` devolve o modelo e o enquadramento salvos (só recorte de fotos já públicas).
- O fluxo passaria a abrir com o que foi salvo, em qualquer aparelho.
- Qualquer visitante pode gerar e baixar cartazes com os dados públicos; só o tutor salva.

## 2. Bonificação para quem encontrar o pet

**Protótipo:** `/dev/bonificacao`. Caso **fictício**: a Mel não é usada e nenhum alerta foi alterado.

### O que existe hoje

- Não há nenhum campo de bonificação ou recompensa no banco.
- O chat avisa "Não pague nada adiantado… nem recompensa antes de estar com o animal" e marca a palavra "recompensa" como sinal de risco (`packages/core/src/chat/chat.ts`). Se a bonificação for aprovada, esse filtro precisa ser revisto para não sinalizar o tutor que oferece.

### Comportamento prototipado

- Pergunta "Você oferece bonificação para quem encontrar seu pet?", com Não (padrão) ou Sim.
- Com Sim, o campo "Valor da bonificação (R$)":
  - tem máscara em reais (digitar 50000 vira 500,00);
  - valida vazio, zero, formato e o limite de R$ 100.000,00 (`parseRewardBRL`);
  - pode ser editado ou retirado.
- No alerta e nos cartazes aparece "BONIFICAÇÃO OFERECIDA: R$ 500,00" (exemplo ilustrativo) **só com o alerta ativo**:
  - reencontrado ou encerrado: nada aparece;
  - sem valor: nenhum bloco, nem vazio.
- Junto, o aviso: "Oferecida pelo tutor. A MEL não intermedeia pagamentos nem garante a bonificação. Nunca pague nada antes de estar com o animal."
- A MEL não processa pagamento: não há carteira, Stripe nem checkout. Não pede telefone nem endereço.
- Cartazes: um selo dourado abaixo da data, nos 5 formatos. No quadrado e no 4:5, a área da foto cede 44 a 52 px para nada ficar espremido.

### Estrutura proposta (exige migration)

- Coluna `lost_cases.reward_cents integer null`, com `check (reward_cents is null or reward_cents between 1 and 10000000)`.
- Gravada pelas RPCs de criar e editar o alerta (só o tutor).
- `get_public_lost_case` devolve o valor apenas quando `status = 'ACTIVE'`.
- Código já pronto e testado: `packages/core/src/reward/reward.ts`, com `parseRewardBRL`, `formatRewardBRL`, `maskRewardInput`, `rewardLine` e testes; e `PosterV2` (`reward`) / `photoLayout` (`{ reward }`).
- Faltaria:
  - o campo no `LostWizard` e na edição do alerta;
  - o bloco na página do alerta;
  - a revisão do filtro de risco do chat.
