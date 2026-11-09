# Propostas: editor de cartazes e bonificação (aguardando aprovação)

Protótipos internos (DEV, `MEL_DEV_ROUTES=1`). **Nada foi gravado no banco e não há migration.**
A estrutura abaixo só será feita depois da aprovação do proprietário (`decisoes-pendentes.md`, itens 7 e 8).

## 1. Editor de personalização dos cartazes

**Protótipo:** `/alerta/{código}/cartaz/editor`, com o alerta real e só leitura.

### O que faz

- Escolher a foto principal e as complementares (até 3), incluir, remover e reordenar.
- Enquadrar a principal em cada formato separadamente:
  - arrastar dentro da moldura com mouse ou dedo (eventos de ponteiro);
  - aproximar com pinça, roda do mouse ou controle deslizante, de 1× a 3×.
- Alternar os 5 formatos; cada um guarda o próprio enquadramento (• no botão do formato).
- "Restaurar original deste formato" ou "Restaurar tudo".
- Prévia fiel: a imagem da prévia é o próprio PNG final, gerado pela rota dos cartazes com `?fotos=&foco=&zoom=`. A moldura usa a mesma conta do recorte do servidor (`cropToDataUrl`).
- Baixar e compartilhar: compartilhamento nativo com arquivo quando o aparelho permite; senão, download.
- "Salvar para reutilizar" funciona **só neste navegador** (localStorage), como protótipo.
- Não altera a foto original, a capa, a ordem do cadastro, a descrição nem os enquadramentos dos outros formatos.

### Fluxo no celular (proposto)

1. Na página do alerta, em "Compartilhar", o tutor toca em "Personalizar cartaz".
2. Escolhe o formato (chips), as fotos (grade com "Usar como principal", "Incluir"/"Remover", ◀ ▶) e enquadra com o dedo.
3. Confere a prévia final e toca em Salvar, Baixar ou Compartilhar.

### Persistência proposta (exige migration)

- Tabela `poster_framings`, um registro por alerta e formato:
  - colunas: `lost_case_id`, `format` (check nos 5 formatos), `photo_ids uuid[]` (1 a 3, a principal primeiro), `focus_x`/`focus_y` (0–100), `zoom` (1–3), `updated_at`;
  - chave única `(lost_case_id, format)`;
  - RLS sem escrita direta.
- RPC `set_poster_framing(code, format, photo_ids, focus_x, focus_y, zoom)` com `security definer`. Ela valida:
  - que `auth.uid()` é o tutor do alerta;
  - que o alerta está ativo;
  - que todas as fotos pertencem ao pet.
- RPC `reset_poster_framing(code, format)` com as mesmas validações.
- Leitura: `get_public_lost_case` passa a devolver os enquadramentos públicos (são só recorte de fotos já públicas).
- O que reaproveita e o que muda no código:
  - aproveita `composePhotos` (opção `framing`, já usada pelo protótipo), `cropToDataUrl` (parâmetro `zoom`) e o `PosterPhotoEditor` atual (capa e foco), cujo controle passaria a abrir o editor;
  - a rota dos cartazes passa a ler o enquadramento salvo em vez do `?foco/&zoom`.

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
