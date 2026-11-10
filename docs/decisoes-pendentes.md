# Decisões pendentes do proprietário

Lista viva das decisões que dependem do proprietário (atualizada em 2026-11-10).
Ao decidir, mover o item para "Decididas" com a data e registrar em `decisoes.md`.

## Pendentes

| # | Desde | Decisão | Contexto |
|---|---|---|---|
| 2 | 2026-11-09 | **Substituir os cartazes atuais** pelos novos modelos (hoje os dois convivem: o gerador antigo do alerta e o "Criar cartaz") | Modelos já aprovados (2026-11-10); falta decidir se o gerador antigo sai |
| 3 | 2026-11-09 | **Trocar a capa da Mel** para a foto horizontal com laço amarelo | Recomendação visual: a capa atual (no colo) é a que pior identifica a Mel. Não alterar sem autorização |
| 4 | 2026-11-09 | **Teste manual**: ler o QR Code com câmera de celular (tela e A4 impresso) | Só o proprietário consegue |
| 5 | 2026-11-09 | **Teste manual**: Instagram/TikTok/Facebook num celular real (compartilhamento nativo) | Nos testes automáticos o menu do sistema é simulado |
| 6 | 2026-11-09 | **Prévia do link no Facebook** com domínio público | Exige domínio público e autorização para teste em ambiente público (checklist 3.8) |
| 7f | 2026-11-10 | **"Resumo para o cartaz"** (campo próprio, curto, só para os cartazes) | Opcional; exige migration. O contador já orienta o tutor (ver Decididas) |
| 7c | 2026-11-09 | **Foto principal no Modelo 2 / Stories com as fotos da Mel**: a capa (no colo, rosto pequeno e virado) vira a foto maior; a foto de rosto aparece como complementar | O tutor já pode trocar a principal em "Personalizar". Decidir se a capa da Mel muda (item 3) |
| 8 | 2026-11-09 | **Bonificação opcional no alerta**: aprovar formulário, apresentação e a migration | Protótipo em `/dev/bonificacao` (caso fictício); proposta no mesmo documento |
| 8a | 2026-11-09 | **Bonificação × aviso antigolpe do chat**: o chat hoje sinaliza a palavra "recompensa" como risco | Decidir como conviver: manter o aviso "nunca pague antes" e não sinalizar o tutor que oferece |
| 11 | 2026-11-09 | **Fotos pequenas para o A4**: as fotos da Mel são ampliadas 2 a 2,5× no A4 (podem sair menos nítidas impressas) | Pedir fotos maiores ao tutor (a dica de tamanho já aparece no cadastro) ou aceitar |
| 9 | 2026-11-09 | **Sugestão "Ele está desaparecido? Publicar alerta"** no cadastro e na página do pet | Cadastrar o pet não cria alerta; registrado em `decisoes.md` |
| 14 | 2026-11-10 | **Aplicar a Opção B nos fluxos reais** ("Criar cartaz" e "Perdi meu pet") | Escolhida pelo proprietário (Decididas). A aplicação depende de autorização expressa; sem mudar regras, campos ou banco |
| 10 | 2026-11-06 | **Merge e produção**: configurar `mel-prod` (migrations 24–46, chaves PII) e publicar | Nada em produção sem autorização expressa |

## Decididas

| Data | Decisão |
|---|---|
| 2026-11-10 | **Microinterações: Opção B (Progressão dinâmica)** escolhida pelo proprietário (encerra o item 13), a partir do protótipo `/dev/microinteracoes`. Ainda não aplicada aos fluxos reais (item 14) |
| 2026-11-10 | **6 alertas sintéticos removidos do `mel-dev`** (encerra o item 7b): SYEE89, UEBTTQ, SFUY49, 7WN595, ZBMPFS e H2X673, das contas `e2e+r11-…@exemplo.com` (64 linhas em cascata: contas, perfis, pets, fotos, alertas, avisos e push), com backup e ensaio de restauração 8/8 antes (`~/.mel-dev-backups/limpeza-testes-52e81f77e6017d05.json`). Eles deixavam o CI vermelho (o teste do Radar via 7 correspondências em vez de 1). Alerta RCU6K4 da Mel conferido depois: intacto. Os arquivos das 10 fotos podem ter ficado no Storage (só as linhas do banco saíram) |
| 2026-11-10 | **20 modelos de cartaz aprovados e "Criar cartaz" liberado aos tutores** (encerra os itens 1, 7, 7e e 12). Entrada "Criar cartaz" na página do alerta para o tutor; qualquer pessoa pode gerar e baixar; protótipos (`/propostas`, `/dev/bonificacao`) continuam só em DEV. Os cartazes antigos do alerta continuam disponíveis (item 2) |
| 2026-11-10 | **Salvar o cartaz na conta do tutor** (encerra o item 7a): migration 47 `poster_designs` + `save_poster_design`/`reset_poster_design`/`get_poster_designs`, aplicada **só no `mel-dev`**; em produção, junto com as demais migrations (item 10) |
| 2026-11-10 | **Merge da `redesign/etapa-1` na `main`** (redesign + cartazes), só código: sem deploy e sem migrations em produção (item 10 continua pendente) |
| 2026-11-10 | **Contador nos campos de descrição** (pet e observações do alerta): "Até 150 caracteres aparecem inteiros nos cartazes" e, acima disso, aviso de que o resto pode sair com "…" e que o texto completo fica na página do alerta. Só orienta: não bloqueia nem corta; o limite do cadastro continua 500 |
| 2026-11-10 | **Personalizar limita a seleção às fotos que cabem** no modelo e formato (item 7d): "Não cabe" nas que ficariam estreitas demais; aviso quando uma sai ao trocar a principal |
| 2026-11-09 | **Descrição do pet é texto livre e voluntário.** O tutor decide o que divulgar, inclusive ruas e endereços; nada de censura ou alteração automática. A proteção técnica das coordenadas privadas continua independente. (Encerra as propostas de editar a descrição da Mel e de omitir endereços automaticamente.) |
| 2026-11-09 | Alerta da Mel (RCU6K4) publicado no `mel-dev` |
| 2026-11-06 | Conta do proprietário com papel `admin` no `mel-dev` |
| 2026-11-06 | Merge do redesign (etapa 1) na `main`, só código |
