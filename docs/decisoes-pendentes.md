# Decisões pendentes do proprietário

Lista viva das decisões que dependem do proprietário (atualizada a cada rodada).
Ao decidir, mover o item para "Decididas" com a data e registrar em `decisoes.md`.

## Pendentes

| # | Desde | Decisão | Contexto |
|---|---|---|---|
| 1 | 2026-11-09 | **Aprovar visualmente as propostas de cartaz** (A4, quadrado, 4:5, Stories, horizontal) | Comparação em `/alerta/rcu6k4/cartaz/propostas?fotos=2,3,4` (DEV). 65 combinações validadas tecnicamente; nenhuma aprovação técnica substitui a visual |
| 2 | 2026-11-09 | **Substituir os cartazes atuais** pelas propostas | Só depois do item 1 |
| 3 | 2026-11-09 | **Trocar a capa da Mel** para a foto horizontal com laço amarelo | Recomendação visual: a capa atual (no colo) é a que pior identifica a Mel. Não alterar sem autorização |
| 4 | 2026-11-09 | **Teste manual**: ler o QR Code com câmera de celular (tela e A4 impresso) | Só o proprietário consegue |
| 5 | 2026-11-09 | **Teste manual**: Instagram/TikTok/Facebook num celular real (compartilhamento nativo) | Nos testes automáticos o menu do sistema é simulado |
| 6 | 2026-11-09 | **Prévia do link no Facebook** com domínio público | Exige domínio público e autorização para teste em ambiente público (checklist 3.8) |
| 7 | 2026-11-09 | **"Criar cartaz" com três modelos por formato**: aprovar a qualidade dos 15 modelos e liberar o fluxo para os tutores (hoje só em DEV) | Demonstração em `/alerta/rcu6k4/cartaz/criar` (rodada 12: indicador de etapas, navegação Voltar/Continuar/Pular, ampliar cartaz, ações Baixar/Imprimir/Compartilhar no topo); detalhes em `docs/propostas/editor-e-bonificacao.md` |
| 7a | 2026-11-09 | **Salvar o cartaz escolhido na conta do tutor** (tabela `poster_designs` + RPC com validação do tutor) | Exige migration. Sem ela, a escolha vale só no endereço da página |
| 7b | 2026-11-09 | **Apagar os 6 alertas sintéticos de teste** (SYEE89, UEBTTQ, SFUY49, 7WN595, ZBMPFS, H2X673), que aparecem no mapa e no mural de DEV | Conferido (somente leitura): contas `e2e+r11-…@exemplo.com` criadas pelo script de testes, perfil fictício "Bia Teste", 1 pet e 1 alerta por conta, nenhum avistamento; nenhum é da Mel. A remoção (apaga as contas e, em cascata, pets e alertas) foi bloqueada pela permissão do ambiente: falta a sua autorização. Para testes futuros, usar só os testes E2E, que criam e apagam os próprios dados |
| 7c | 2026-11-09 | **Foto principal no Modelo 2 / Stories com as fotos da Mel**: a capa (no colo, rosto pequeno e virado) vira a foto maior; a foto de rosto aparece como complementar | O tutor já pode trocar a principal em "Personalizar". Decidir se a capa da Mel muda (item 3) |
| 8 | 2026-11-09 | **Bonificação opcional no alerta**: aprovar formulário, apresentação e a migration | Protótipo em `/dev/bonificacao` (caso fictício); proposta no mesmo documento |
| 8a | 2026-11-09 | **Bonificação × aviso antigolpe do chat**: o chat hoje sinaliza a palavra "recompensa" como risco | Decidir como conviver: manter o aviso "nunca pague antes" e não sinalizar o tutor que oferece |
| 11 | 2026-11-09 | **Fotos pequenas para o A4**: as fotos da Mel são ampliadas 2 a 2,5× no A4 (podem sair menos nítidas impressas) | Pedir fotos maiores ao tutor (a dica de tamanho já aparece no cadastro) ou aceitar |
| 12 | 2026-11-09 | **Foto única vertical**: nos três modelos não há mais faixas vazias (foto alta ao lado do texto ou quadro "Como reconhecer" no espaço que sobraria) | Conferir na demonstração com o cenário "uma vertical" (`/alerta/syee89/cartaz/criar`) |
| 9 | 2026-11-09 | **Sugestão "Ele está desaparecido? Publicar alerta"** no cadastro e na página do pet | Cadastrar o pet não cria alerta; registrado em `decisoes.md` |
| 10 | 2026-11-06 | **Merge e produção**: configurar `mel-prod` (migrations 24–46, chaves PII) e publicar | Nada em produção sem autorização expressa |

## Decididas

| Data | Decisão |
|---|---|
| 2026-11-09 | **Descrição do pet é texto livre e voluntário.** O tutor decide o que divulgar, inclusive ruas e endereços; nada de censura ou alteração automática. A proteção técnica das coordenadas privadas continua independente. (Encerra as propostas de editar a descrição da Mel e de omitir endereços automaticamente.) |
| 2026-11-09 | Alerta da Mel (RCU6K4) publicado no `mel-dev` |
| 2026-11-06 | Conta do proprietário com papel `admin` no `mel-dev` |
| 2026-11-06 | Merge do redesign (etapa 1) na `main`, só código |
