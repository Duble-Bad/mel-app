# MEL — Onde estamos (status e próximos passos)

> Atualizado em 2026-11-05. **MVP em Feature Freeze desde o commit `46f3238`**; série Launch Readiness (1, 2A–2L) concluída no código e na documentação; último CI verde em `25561fe`.
> **Decisão de 2026-11-05:** o piloto segue nos planos gratuitos do **MapTiler** e da **Vercel (Hobby)**. **Próxima ação única:** decidir o domínio próprio (checklist 0.4).
> **Redesign (2026-11-05, branch `redesign/etapa-1`, ainda fora da `main`):** Conceito B aprovado e implementado no app; ponto público aproximado passou para **100 m** (migration 32, aplicada só no `mel-dev`). Detalhes em "Redesign e 100 m" abaixo.
> **Cartazes (2026-11-09, só DEV):** 65 combinações (13 seleções de fotos × 5 formatos) validadas com o alerta RCU6K4. Dimensões e QR (tamanho real e celular) passam em 65/65, e nenhuma combinação tem laterais desfocadas. Também foram feitos: os protótipos do editor (`/alerta/rcu6k4/cartaz/editor`) e da bonificação (`/dev/bonificacao`), sem migration; e a orientação da descrição pública no cadastro, na edição e no alerta. Decisões em [decisoes-pendentes.md](decisoes-pendentes.md); propostas em [propostas/editor-e-bonificacao.md](propostas/editor-e-bonificacao.md).
> **"Criar cartaz" (2026-11-09, só DEV):** o tutor escolhe entre 3 modelos por formato (15 no total), personaliza e baixa, imprime ou compartilha (`/alerta/{código}/cartaz/criar`). 120 combinações verificadas (8 conjuntos de fotos × 15 modelos): dimensões e QR 120/120, nenhuma foto com laterais desfocadas. Liberação para os usuários e persistência na conta dependem do proprietário.
> **"Criar cartaz" refinado (2026-11-09, rodada 12, só DEV):** indicador de etapas (atual, concluída, pulada, pendente, com erro), navegação Voltar/Continuar/Pular personalização, miniaturas dos formatos na proporção real, prévias compactas com ampliação, ações Baixar/Imprimir/Compartilhar no topo da etapa final no celular. Ponto aberto: na etapa Personalizar, uma complementar escolhida pode não aparecer no cartaz quando o modelo não comporta três fotos (ver decisões pendentes, item 7d).
> Leia isto primeiro ao retomar o projeto. Para o lançamento, a lista completa está em [12-checklist-lancamento.md](12-checklist-lancamento.md).

## 🚦 Prontidão para o piloto (diagnóstico de 2026-11-05)

Prioridade do proprietário: colocar a MEL no ar para ajudar tutores, com custo operacional
**R$ 0** sempre que possível. Nenhum serviço pago e nenhuma funcionalidade nova.

**Pronto:** MVP congelado (alerta + cartaz/QR, avistamentos com privacidade, encontrados e
Radar, conversa, push de tutor e Guardião, adoção e parceiros moderados, mapas); 31
migrations validadas do zero; RLS, privacidade, push e agendador testados; captcha,
headers, anti-abuso, recuperação de push (31), agendador autenticado e região `gru1` no
código; procedimento de deploy com pre-flight e pós-deploy.

**Impede o lançamento:**

| Tipo | Item |
|---|---|
| Técnico | `mel-prod` **pausado** (INACTIVE, visto em 2026-11-04): restaurar no painel (grátis) |
| Técnico / privacidade | migrations **24–31** pendentes no `mel-prod` (24 e 29 são P0: sem elas o público vê o ponto exato do avistamento) |
| ~~Licença~~ | **Decidido (2026-11-05):** seguir no MapTiler Free e na Vercel Hobby. Condição: piloto **sem** receita, anúncio, patrocínio ou oferta patrocinada (os termos dos dois são "não comercial"); se isso mudar, rever os planos antes |
| Licença | Resend Free e Turnstile: condições de uso não verificadas |
| Configuração | domínio próprio — **único custo inevitável** (~R$ 40/ano; decisão do proprietário): sem ele não há SMTP nem recuperação de senha |
| Configuração | Vercel (Root Directory `apps/web`, variáveis e secrets de produção, `NEXT_PUBLIC_SITE_URL`); Supabase de produção (URLs, SMTP Resend, captcha, anônimos 30/h); chaves de produção restritas ao domínio (Turnstile, VAPID novo, MapTiler); primeiro moderador; smoke test |

**Risco aceito (decisão de 2026-11-05):** backup externo **pendente e não operacional**; o
Supabase Free não faz backup. Perda do banco hoje seria irrecuperável. Ver [14](14-backup-restauracao.md)–[17](17-armazenamento-sao-paulo.md).

**Depois do piloto:** Google OAuth; CSP completa; cron diário (o push já sai após cada ação);
backup externo; troca de mapa (plano no [13](13-mapas-fornecedores.md)); revisão jurídica
formal (após aprovação dos textos atuais pelo dono); teste instável `lostcase-lifecycle`
(1 falha transitória em `89bdeb9`, verde na 2ª tentativa).

**Sequência mínima (sem contratar):** 1) ~~licenças~~ (decidido: MapTiler Free e Vercel Hobby) e conferir Resend Free e Turnstile; 2) decidir/registrar domínio;
3) restaurar o `mel-prod`; 4) migrations 24–31 + pós-deploy ([08](08-deploy-producao.md));
5) Auth/SMTP/captcha no `mel-prod`; 6) chaves de produção; 7) deploy na Vercel e conferir
`gru1`; 8) primeiro moderador; 9) smoke test; 10) abrir o piloto sem ofertas patrocinadas.
Detalhe de cada item: [12-checklist-lancamento.md](12-checklist-lancamento.md).

## 🧊 MVP Feature Freeze (2026-11-03)

Autorizado pelo dono sobre o commit **`46f3238`**. Estado congelado:

- **31 migrations**, todas aplicadas no `mel-dev` e validadas do zero (impressão digital versionada); **24–31 pendentes no `mel-prod`**.
- **P0 encerrados:** Radar Privacy (24) e Sighting Privacy (29, completado na 30 com o rótulo público do avistamento).
- **P1 encerrados:** tratamento de erros, ciclo de vida do alerta (25), moderação de adoção/parceiros (26), anti-abuso (27) e limpeza de fotos órfãs (28).
- **Quick wins do benchmark:** cartaz acionável, antigolpe concreto, orientação de fotos do pet.
- **Pacote pré-freeze:** push para o tutor (avistamento, mensagem, Radar), rótulo público do avistamento (30), headers de segurança, mapa sob demanda.
- **CI verde** em `46f3238`: verificações rápidas; banco contra o `mel-dev` (23 arquivos ✅, 2 pulados) + E2E 70/70; reconstrução do zero (24 arquivos ✅, 1 pulado; impressão digital idêntica).
- **`mel-prod` intocado** desde o primeiro deploy (23 migrations, 2026-10-29).

**Regra a partir deste marco:** nenhuma funcionalidade nova entra no MVP. Só podem ser autorizadas, uma a uma e separadamente:

1. correções de **segurança**;
2. correções de **regressão**;
3. **requisitos indispensáveis ao lançamento** ([12-checklist-lancamento.md](12-checklist-lancamento.md) — ex.: captcha do Auth no código, CSP completa).

Ideias de produto (MEL ID + QR permanente, Ponto de Apoio, CTA de instalação do PWA, vitrine de reencontros, contadores públicos, Alerta Turbinado, monetização, plaquinha/NFC…) ficam para depois do lançamento.

## 🎨 Redesign e 100 m (2026-11-05)

Branch `redesign/etapa-1` (commits `34ea1b3`, `482da81`, `db69158`, `2da4a97` e seguintes). **Na `main` desde 2026-11-06** (merge pedido pelo proprietário); produção continua sem deploy e sem as migrations 24–45.

| Item | Estado |
|---|---|
| Correção: cadastro quebrava no celular por `http://<ip>` (`crypto.randomUUID` só existe em HTTPS/localhost) | ✅ `randomId()` em `@mel/data`; onboarding com "Tentar novamente" e "Sair da conta" |
| Protótipos (3 conceitos) e especificações de Adoção/Mural/Parceiros | ✅ `design/` (servidor: `node design/prototipos/servidor.mjs`, porta 4173) |
| Conceito B no app | ✅ tokens (escuro azul-escuro + dourado; "Vi um pet" azul, adoção dourada), **tema escuro padrão**, cabeçalho fixo com navegação, home com a foto da Mel e o gatinho, entrar com foto e regra de senha ao vivo, novo `/mural`, mapa/adoção/parceiros no novo visual |
| Ponto público aproximado 250 m → **100 m** (decisão do proprietário) | ✅ migration 32 no `mel-dev`; `PUBLIC_CELL_METERS = 100` no core; **pendente no `mel-prod`** |
| Fidelidade ao Conceito B (2ª rodada): home com fita entrelaçada, números reais (só quando significativos), Como funciona, "Agora na sua região", Adoção responsável, Parceiros, rodapé em todas as páginas; mapa com áreas de 100 m e painel lateral; mural com espécie/porte e adoção integrada | ✅ |
| Decisões do proprietário (§4 das especificações, respondidas em 2026-11-05) | ✅ adoção 1–5 e 7 (migrations 33–38), mural 6 (só interface), parceiros 8–10 (migration 39), LGPD (migration 40); tudo só no `mel-dev` |
| Chat de doador/ONG direto com quem está na fila | ✅ (2026-11-06, migration 41) — só com opt-in do interessado; moderadores não iniciam |
| CPF só para titular e admin autorizado; rotação de chaves; dado ilegível/chave perdida sem perder a conta; correção pelo titular (`/perfil/dados`); validações e máscaras de CPF/CNPJ/telefone/e-mail | ✅ (2026-11-06, migrations 42–43; procedimento de chaves em [18-chaves-pii.md](18-chaves-pii.md)) — produção **não** configurada |
| Mapa e Google pelo celular (rede local) | Mapa ✅ em DEV. **Google ❌ pelo IP:** o Supabase Auth recusa retorno para IP não-loopback mesmo na lista; alternativa por nome (`sslip.io`) aguardando aprovação; HTTPS local configurado em 2026-11-06 (`https://172.18.4.238:3443`, opção A, sem túnel público) — testes manuais do proprietário pendentes; falta incluir a URL HTTPS nas Redirect URLs do `mel-dev` ([19-teste-no-celular.md](19-teste-no-celular.md)) |
| Merge na `main` | ✅ 2026-11-06, a pedido do proprietário (só código; sem deploy: a Vercel não está conectada e o `mel-prod` não recebeu migrations). Aprovação visual da etapa: depende do reteste manual |
| Administrador no `mel-dev` | ✅ conta Google do proprietário com papel `admin` (2026-11-06, autorizado por ele), por `npm run admin:role -- <email> admin --aplicar` (sem `--aplicar` o script só mostra a prévia; nunca cria conta) |
| Reteste 4 (2026-11-06) | ✅ autorização de endereço do parceiro preservada no rascunho durante o login (só na aba, não publica nada: no banco ainda depende de aprovação e validação); ilustrações DEMO com faixa e aviso dentro da área que sobra em todos os recortes (quadrado e painel largo do celular) |
| Inspeção real no celular (2026-11-06) — correções | ✅ menu do celular (portal: o `backdrop-filter` do cabeçalho prendia o painel em 64 px); mapa não volta para Lista nem perde o zoom em "Perto de mim"/"Buscar nesta área" (sem remontagem; centro do link com 3 casas ≈ 110 m); avisos do GPS visíveis na aba Mapa; áreas com preenchimento leve e um círculo por célula; prévia do mapa da home identificada como ilustrativa e com "Abrir mapa real"; foto que não carrega mostra "Foto indisponível"; painel de detalhes com foto limitada no celular. Reteste manual do proprietário pendente |
| Dados de teste no `mel-dev` | ✅ Limpeza executada em 2026-11-06 com aprovação do proprietário: **155 contas sintéticas removidas** (~8,3 mil linhas em cascata), backup verificado e ensaio de restauração 10/10 antes; preservadas as contas de origem duvidosa (42 `test+` de rótulo dinâmico + 6 ligadas a elas + anônimos sem evidência) e a conta real do proprietário. Backup em `~/.mel-dev-backups/limpeza-testes-3ac4f15a984cc23d.json` (`limpeza.mjs restaurar <arquivo>`). |
| Casos de DEMONSTRAÇÃO (mel-dev) | ✅ 9 casos controlados de uma conta marcada (`demo.casos@exemplo.com`, `app_metadata.mel_demo`): 3 perdidos, 2 encontrados, 2 vistos (encontrado com `custody = street`), 2 adoções; bairros variados (3 na Penha). Nomes "DEMO …", textos "não é um caso real". Imagens: **ilustrações geradas pelo script** (desenho de cão/gato com a faixa "DEMONSTRAÇÃO" e "não é um animal real"; nenhuma foto de animal ou pessoa): perdidos com 1, 2 e 6, encontrados/visto com 1 (um visto sem foto), adoções com 4 e 1. Inseridos sem gatilhos: 0 avisos, 0 push, 0 Radar. Fora dos números públicos da home. **Remover antes do piloto:** `node --env-file=.env.local scripts/demo-casos/demo.mjs remover` |
| Mapa da home com dados reais | ✅ Mesmo mapa (MapLibre + áreas de 100 m) e mesma consulta/filtros padrão do /mapa; carrega só ao aparecer na tela, sem interação (poucos blocos do MapTiler); toque abre o /mapa; estado vazio sem mapa. Ilustração removida do código |
| Teste de cadastro/onboarding instável | ✅ Onboarding conclui com navegação completa (o roteador podia reaproveitar o redirecionamento antigo para /onboarding). Suíte completa 3× seguidas, 81/81, sem novas tentativas |
| Reteste no celular (2ª rodada, 2026-11-06) — correções | ✅ **Pontos fora dos círculos no mapa:** o CSS do ponto (`position: relative`) vencia o `absolute` do marcador do MapLibre quando o CSS do mapa carregava depois (vindo da home); cada ponto ia 30 px para o lado por ponto anterior (até 90 px). Corrigido sem mudar raio nem coordenadas; teste de geometria (projeção de Mercator, zoom e movimento). **Abas Entrar/Criar conta:** aba ativa no dourado oficial (#f6b928, texto #1c1404), inativa sem fundo. **Fotos:** galeria nova (miniaturas, ampliar, anterior/próxima, deslizar, ✕/Esc, "Foto indisponível") no alerta, encontrado e adoção — antes o alerta mostrava só a 1ª foto e nada ampliava. **Mapas de detalhe:** mesmo tema e cores do mapa da rede (seguem o tema da tela); "Região aproximada" do encontrado com a área de ~100 m e zoom da MEL; o mapa do alerta continua com pinos (mistura o ponto público com avistamentos que o tutor vê exatos); atribuição MapTiler/OSM mantida com chip escuro e linha própria. Reteste manual do proprietário pendente |
| Reteste no celular (3ª rodada, 2026-11-06) — correções | ✅ **Rótulos do mapa de detalhes:** abria no zoom 14 exato, em que o estilo escuro do MapTiler não posiciona nenhum rótulo (confirmado voltando ao 14 depois de mexer: continuam sumidos; em 13, 14,1+ e 15 aparecem), e com 224 px o nome do bairro caía fora da janela. Agora zoom 14,5, mapa mais alto (288 px no celular, 340 px no desktop) e chip fixo com a região pública ("Mooca, São Paulo – SP · área aproximada"). **"Perdido e Visto sumiram":** os casos existem e estão ativos; o padrão sem GPS é 5 km da Sé e os mais próximos estão a 5,5–6,1 km. Agora o mapa avisa "Sem Perdidos e Vistos até 5 km nos últimos 30 dias" com "Ampliar para 10 km", e mostra estado vazio sobre o mapa. Legenda acima do botão de atribuição. **Adoção no mapa** sob configuração de administrador e **regra de endereços de ONGs, empresas e pessoas físicas** (migrations 44–45, só no `mel-dev`). Reteste manual do proprietário pendente |
| "Ajude compartilhando" no alerta (2026-11-06) | ✅ em DEV: WhatsApp (texto e link de antes), Facebook (compartilhamento oficial pela web, sem SDK), TikTok e Instagram (cartaz Stories 9:16 pelo menu nativo quando o navegador aceita imagem; senão baixar o cartaz e copiar o link, com instrução de publicação manual — nada é publicado sozinho). Mais opções, Copiar link e Cartaz/QR Code mantidos. Links e QR Codes dos cartazes de DEV apontam para o servidor de desenvolvimento: em produção usarão o domínio público. Reteste do proprietário pendente |
| Compartilhamento e cartazes (2ª rodada, 2026-11-09) | ✅ em DEV: Instagram (Stories 9:16, Feed 4:5, Feed 1:1) e TikTok (foto vertical 9:16) geram o cartaz do formato escolhido e usam o menu do sistema só se `navigator.canShare({ files })` aceitar; senão baixam a imagem com mensagem honesta. Prévia do link: `og:url`, canônica, `og:site_name`, `og:locale`, imagem 1200×630 com a **foto** em destaque. Facebook: prévia **não validada** em DEV (IP privado + CA local; checklist 3.8). Cartazes: **4 propostas** (A4, quadrado, Stories, horizontal; e Feed 4:5) em `/alerta/<código>/cartaz/propostas`, aguardando aprovação — os modelos atuais continuam. Tutor escolhe a capa e o enquadramento (migration 46) |
| Cartazes com o cadastro real da Mel (2026-11-09) | Em DEV: prévia interna `/dev/cartaz-pet/MEL-YCCV7Z` (só com `MEL_DEV_ROUTES=1`; lê o cadastro, não grava). A Mel **não tem alerta**: QR e link ficam reservados, região/data aparecem como ausentes (não foram inventados; o servidor não cria alerta). Propostas revistas: faixa PROCURA-SE no topo (nada sobre o rosto), layout segue a orientação da foto principal (vertical vira coluna alta), foto principal nunca cortada além de 35% (senão aparece inteira), complementares pelo centro, horizontal 1200×630, link marcado AMBIENTE DE TESTE — DEV. Dica de tamanho no envio (original da câmera, ≥1200 px no lado maior) e aviso de foto pequena (lado menor < 640 px) no cadastro e no editor do cartaz. Aprovação visual do proprietário pendente |
| Alerta real da Mel e comparação de cartazes (2026-11-09) | ✅ em DEV: alerta **RCU6K4** publicado pelo fluxo do app como o tutor (autorizado pelo proprietário): 16/10/2026 22:00 (horário aproximado), região pública "Vila Santa Margarida, Ferraz de Vasconcelos – SP" (ponto exato privado; o público fica a 52 m). Sem avisos, push ou Radar. Atenção: a **descrição do pet** (texto do tutor, pública) cita a rua. Comparação por formato (anterior × proposta, tamanho real, download, o que mudou) em `/alerta/<código>/cartaz/propostas`, só com `MEL_DEV_ROUTES=1`, noindex. Validação: 40/40 imagens com dimensões certas e QR legível em tamanho real e na tela do celular. Pendente: aprovação visual do proprietário; enquadramento por formato (hoje um ponto por foto vale para todos) |
| Auditoria RCU6K4 e privacidade (2026-11-09) | Alerta confere (pet MEL-YCCV7Z, ACTIVE, visível no mapa/mural do DEV, 16/10 ~22:00, região pública só o bairro, ponto exato privado a 52 m, sem avisos/push/Radar). **Exposição confirmada:** o nome da rua está na descrição do pet (texto do tutor) e aparece na página pública do pet, na página do alerta e nas respostas públicas da API (alerta e tabela de pets); não aparece no mapa, mural, prévias de link nem cartazes (o texto é cortado antes). Correção recomendada pendente de autorização: editar a descrição (dado da Mel) e, no produto, aviso no formulário + omissão de endereço em textos públicos (exige migration). Propostas refinadas: Stories com áreas seguras, horizontal só com a foto principal, A4 em coluna, horário aproximado, link sem o endereço técnico em DEV; um ponto de enquadramento por foto é suficiente |
| Limites de fotos | Pet (alerta de perdido): até 6 (`MAX_PET_PHOTOS`, só na interface); encontrado/visto: 1 (`photo_path`); avistamento: 1; adoção: 1 a 4 (check no banco) |
| Consulta automática de CNPJ | ⏸️ sem fonte oficial gratuita para projeto privado (Conecta gov.br é só para órgãos públicos; Serpro é pago); validação local + "Verificação pendente"; adaptador pronto e desligado (`MEL_CNPJ_LOOKUP=off`) |
| Foto da Mel em alta resolução (seção "Nossa origem") | ⏳ o proprietário vai enviar |

**Validação final da 2ª rodada (2026-11-05, branch `redesign/etapa-1`):** E2E contra build de produção 77/77 (75 + 2 de parceiros após ajuste de seletor); "Reconstrução do schema" ✅ (banco do zero idêntico ao `mel-dev`, 223 testes de banco, auditoria e impressão digital das 40 migrations) e CI ✅, ambos disparados manualmente na branch. Comparação lado a lado protótipo × site real das 6 telas do Conceito B.

**Testes (2026-11-05, 1ª rodada):** unitários, tipos e lint ✅; testes de banco ligados aos 100 m (Radar, avistamentos, alertas, mapa: 35/35) ✅; E2E contra build de produção 74/76, e as 2 falhas foram de ambiente (segredo do agendador ausente na execução manual — repetido, 5/5 — e um alerta de teste órfão de uma execução interrompida, já apagado). Suíte completa de banco a repetir quando o limite de login do Auth do `mel-dev` zerar.

**Lição de ambiente:** o cache do Turbopack (`apps/web/.next/dev`) corrompeu e o `next dev` passou a recarregar a página em laço (E2E com dezenas de falhas falsas). Solução: parar o servidor e apagar `apps/web/.next/dev`. Não rodar `next start` e `next dev` sobre a mesma pasta `.next` ao mesmo tempo, e não deixar duas execuções de E2E simultâneas.

**Variáveis de servidor novas (produção, pelo dono, só no painel da hospedagem):** `MEL_PII_ENC_KEY`, `MEL_PII_ENC_KEY_VERSION`, `MEL_PII_HMAC_KEY`, `MEL_PII_HMAC_KEY_VERSION` (e `MEL_PII_ENC_KEYS_PREVIOUS` só ao trocar a chave), `MEL_CNPJ_LOOKUP=off`, `MEL_SPONSORED_OFFERS=off`. Sem as chaves de PII, o cadastro de protetor responde 503. Moderadores que podem ver CPF: inserir em `pii_access_grants` (registro de cada acesso em `partner_document_access_log`).

**Configuração manual pendente (sem custo) para testar pelo celular na rede local:** MapTiler → *Allowed HTTP origins* com `http://172.18.4.238:3000`; Supabase `mel-dev` → *Redirect URLs* com `http://172.18.4.238:3000/**` (login com Google).

## Resumo

- **Produto (M1–M16): concluído** em desenvolvimento ([06-milestones.md](06-milestones.md)); **Feature Freeze** em `46f3238` (acima).
- **Produção:** schema aplicado e verificado no `mel-prod` (pós-deploy 100% ✅). Auth básico ajustado pelo dono no painel (abaixo). O app não está publicado.
- **Etapa atual:** Launch Readiness concluído no código (até 2L). **Próxima etapa: lançamento do piloto (M17)**, na sequência mínima de "Prontidão para o piloto", só com autorização do dono, item a item. Licenças decididas (MapTiler Free e Vercel Hobby, 2026-11-05). Próxima ação única: decidir o domínio próprio.

## ⏸️ Produção pausada (decisão de 2026-10-30)

Todo o trabalho de produção está **pausado** até o produto estar funcionalmente pronto em DEV: nada de domínio, SMTP/Resend, "Confirm email", Google OAuth, Manual Linking, alterações no `mel-prod` ou deploy. Os itens abaixo ficam como **pendências de lançamento**; o foco agora é o produto (auditoria funcional em DEV).

## Último CI

**3 rodadas visuais de E2E depois da correção (2026-11-05, `763a6b3`):** 76/76 ✅ em cada uma — rodada 1 no navegador visível para o dono, devagar (8,5 min); rodadas 2 e 3 em segundo plano (6,5 e 6,3 min). Sem novas tentativas automáticas; nenhuma falha; servidor só com os erros provocados pelo próprio teste (`/dev/erro`). Não cobre celular físico, push real, e-mail real nem Google real (ficam para o smoke test manual da produção).

**Teste visual (2026-11-05):** ~120 telas revisadas (celular claro/escuro, computador, fim de cada um dos 76 cenários). 1 defeito: cabeçalho duplicado em "Não encontramos esta página" dentro do app — **corrigido** (`app/(app)/not-found.tsx`, autorizado como correção no Feature Freeze), com E2E conferindo um cabeçalho só. Fotos quebradas e blocos marrons vistos no `mel-dev` são dados deixados pelos testes, não defeito.

**3 rodadas completas de E2E (2026-11-05), build de produção, sem novas tentativas automáticas:** 76/76 ✅ em cada rodada (2,8 · 2,7 · 2,5 min). Logs do servidor sem erro inesperado: só os provocados pelos próprios testes (`/dev/erro`, login social recusado) e o push desligado de propósito (sem chave VAPID).

`25561fe` (2026-11-04, docs 17): ✅ CI e reconstrução do schema. `89bdeb9` (guia 16 + verificação rápida): ✅ CI (na 2ª tentativa, falha transitória em `lostcase-lifecycle`), reconstrução ✅, ensaio de backup ✅. `7d7be25` (migration 31): ✅ nos 3 checks.

Marco do Feature Freeze:
`46f3238` — marco do Feature Freeze: ✅ verde nos 3 checks (banco contra o `mel-dev` 23 arquivos ✅ / 2 pulados, 185 testes; E2E 70/70; reconstrução do zero 24 arquivos ✅ / 1 pulado, impressão digital idêntica).

Anterior: `3f62ebf` — P0 privacidade dos avistamentos (migration 29 + impressão digital): ✅ verde nos 3 checks. Reconstrução do zero com auditoria, impressão digital idêntica, paridade, drift e testes de banco; CI contra o `mel-dev`: banco 22 arquivos ✅ (2 pulados, como sempre: `email-confirmation` e `google-linking`), E2E 69/69 ✅, inclusive o avistamento com os textos novos e a legenda "localização aproximada". O commit anterior (`246fcf2`) ficou vermelho só pela impressão digital ainda não versionada e pelo limite antigo de sessões anônimas do `mel-dev` (30/h).

## Linha do tempo da produção

| Etapa | Estado |
|---|---|
| Auditoria do schema e travas contra produção (`scripts/lib/safe-target.mjs`) | ✅ |
| Reconstrução do zero no CI (`schema-rebuild.yml`), manifesto e impressão digital | ✅ |
| Procedimento de deploy (`scripts/prod/`, [08-deploy-producao.md](08-deploy-producao.md)) | ✅ |
| Deploy das 23 migrations no `mel-prod` (pelo dono, no PowerShell) | ✅ 2026-10-29 |
| Pós-deploy: schema idêntico ao reconstruído; `rls_auto_enable` + `ensure_rls` (plataforma, anteriores ao deploy) aceitos só pela definição exata; 7 event triggers validados | ✅ decisão **MANTER** (`b1ed683`) |
| Auditoria de Auth do código e checklist do painel | ✅ |
| Auth básico no painel do `mel-prod` (informado pelo dono, não conferido por leitura) | ✅ Email ON · Confirm email OFF · Anonymous ON · Manual linking OFF · senha mínima 8 |
| Conversão anônimo → conta por e-mail/senha (mesmo id, contribuições mantidas) | ✅ `e9a42d5` |
| Google: login normal + vínculo à sessão anônima (`linkIdentity`) no código | ✅ `021a5a1` |
| Google Cloud: projeto, tela de consentimento e client OAuth | ⏭️ pode ser feito já (manual, pelo dono) |
| E-mail transacional no código: `/auth/confirmar` (token_hash, qualquer aparelho, só com clique), templates pt-BR, cadastro sem enumeração, testes com "Confirm email" ON | ✅ |
| **Domínio próprio** (pelo dono) | ⏭️ próximo — necessário para SMTP, Site URL e Google |
| **SMTP (Resend) + templates + "Confirm email" ON** (antes de qualquer conta real e antes do Google) | ⏸️ depois do domínio — [11-email-producao.md](11-email-producao.md) |
| Google provider + manual linking no painel do `mel-prod` | ⏸️ depois do item acima |
| Publicação do app (Vercel + domínio) | ⏸️ não iniciado |
| `mel-prod` pausado pelo plano Free (INACTIVE, visto em 2026-11-04) | ⏸️ restaurar no painel antes das migrations |
| Migrations 24–31 no `mel-prod` | ⏸️ pendentes (P0 de privacidade: 24 e 29) |
| Backup externo | ⏸️ pendente por decisão de 2026-11-05 (nenhum provedor contratado; não operacional) |

## Por que o Google espera o "Confirm email" ON

No login com Google, o Supabase **liga automaticamente** a identidade Google a um usuário que já exista com o mesmo e-mail. A proteção contra conta pré-criada (apagar senha/identidades não confirmadas) só roda se esse usuário **não** estiver confirmado. Com "Confirm email" OFF, todo cadastro por e-mail e senha nasce confirmado, então: alguém cadastra o e-mail de outra pessoa com uma senha; quando a dona do e-mail entra com Google, cai nessa conta, e o atacante continua entrando com a senha. Isso independe do "manual linking" e não tem chave para desligar no Supabase.

Por isso: **SMTP próprio → "Confirm email" ON → só então Google ON**, tudo antes de abrir o app ao público (contas criadas com "Confirm email" OFF continuam confirmadas). O código já trata "Confirm email" ON (tela "confira seu e-mail"; conversão do anônimo pelo link do e-mail). Análise em [decisoes.md](decisoes.md).

## Google OAuth (manual, pelo dono)

Nada disso foi feito ainda. O Client Secret é segredo: só no painel do Supabase, nunca no repositório, em `NEXT_PUBLIC_*`, em log ou no chat.

**Google Cloud** (projeto próprio da MEL, conta da MEL — nunca de empregador):

1. Criar o projeto (ex.: "MEL Produção").
2. **OAuth consent screen:** tipo *External*; nome "MEL"; e-mail de suporte da MEL; logo opcional; links de `/privacidade` e `/termos` (**DEPENDE DA URL DE PRODUÇÃO**); escopos só `openid`, `email`, `profile`; publicar o app (sair de *Testing*) antes do lançamento.
3. **Credentials → Create OAuth client ID → Web application.**
   - **Authorized redirect URIs:** só `https://<ref-do-mel-prod>.supabase.co/auth/v1/callback` (o Google volta para o Supabase, não para a MEL).
   - **Authorized JavaScript origins:** não é necessário para o fluxo de redirecionamento usado pela MEL; se o console exigir, a URL pública da MEL (**DEPENDE DA URL DE PRODUÇÃO**).
4. Copiar o Client ID e o Client Secret direto para o painel do Supabase (abaixo).

**Supabase `mel-prod`** (só depois de SMTP próprio + "Confirm email" ON):

1. Authentication → Sign In / Providers → **Google**: Enabled ON; Client ID; Client Secret (colar só aqui); "Skip nonce checks" OFF.
2. Authentication → Sign In / Providers → **Allow manual linking: ON** (necessário para o anônimo manter as contribuições ao entrar com Google; análise de segurança em [decisoes.md](decisoes.md)).
3. Authentication → URL Configuration (**DEPENDE DA URL DE PRODUÇÃO**): Site URL `https://<domínio>`; Redirect URLs só `https://<domínio>/auth/callback**`. Nunca `localhost`, nunca `*.vercel.app`, nunca `/**` no domínio inteiro.
4. Hospedagem do app: `NEXT_PUBLIC_AUTH_GOOGLE=on` (mostra o botão) e `NEXT_PUBLIC_SITE_URL=https://<domínio>`.

Sem a URL de produção, os passos 1, 3 e 4 do Google Cloud já podem ser feitos (o 2 precisa dos links de privacidade/termos). No Supabase, Google e manual linking só depois do "Confirm email" ON; o botão só deve aparecer (`NEXT_PUBLIC_AUTH_GOOGLE=on`) quando Site URL e Redirect URLs estiverem configurados.

## M17 — Configuração de produção (restante, em ordem sugerida)

Tudo no painel do `mel-prod` ou na hospedagem do app. **Nunca** `supabase config push` (o `config.toml` é de desenvolvimento). Cada item precisa de autorização e, quando envolve segredo, é feito pelo dono.

1. **API:** schemas expostos sem `private`.
2. **Auth restante:** Rate Limits nos padrões (anônimos 30/h por IP, logins 30/5 min); captcha do Auth (Bot Protection → Turnstile, com o **segredo de produção** do Turnstile): o código já envia `captchaToken` em sessão anônima, cadastro, login e recuperação (Launch Readiness 1, 2026-11-03).
3. **URLs:** Site URL e Redirect URLs (`/auth/callback`) do domínio final.
4. **SMTP** próprio (Resend; e-mail da MEL, nunca de terceiros/empregador), templates pt-BR do repositório e então **"Confirm email" ON** — passo a passo em [11-email-producao.md](11-email-producao.md). Sem SMTP, a recuperação de senha não chega a usuários reais — **bloqueia o lançamento público**.
5. **Google OAuth:** passo a passo acima (depois do item 4).
6. **MapTiler:** chave de produção restrita ao domínio. **Turnstile:** site key e secret de produção restritas ao domínio (as do dev são as chaves de teste, que sempre aprovam).
7. **Web Push:** gerar par VAPID novo para produção (nunca reutilizar o do dev); agendador de push (`PUSH_DISPATCH_SECRET`), que também **apaga as fotos órfãs** do `sighting-media` (sem ele, nada é apagado).
8. **Secrets do servidor** na hospedagem (`SUPABASE_SECRET_KEY` etc.), nunca no repositório.
9. **Domínio** e deploy do app, com `NEXT_PUBLIC_SITE_URL=https://<domínio>` **no build** (sem ela, o QR do cartaz e a prévia do link podem apontar para `*.vercel.app`).
10. **Primeiro moderador:** `npm run admin:role -- <email> moderator --confirm-target=<ref>`. Scripts administrativos permitidos em produção, sempre com o ref digitado: este e o `sighting-media-neutral-names.mjs` (passo do [deploy de schema](08-deploy-producao.md), depois da migration 29).
11. Smoke test manual como usuário real (sem seed, sem E2E contra produção), incluindo a **prévia do alerta no WhatsApp** (imagem aparece, tamanho e tempo a frio), push num celular real e e-mail de recuperação.

## Pendências conhecidas (antes do lançamento público)

- **Migrations 24 (`20261030120000_radar_public_distance`, Radar v2 — P0 de privacidade), 25 (`20261030140000_lost_case_close_edit`, ciclo de vida do alerta) 26 (`20261030160000_adoption_partner_moderation`, moderação de adoção e parceiros) 27 (`20261030180000_global_abuse_limits`, anti-abuso), 28 (`20261030190000_orphan_media_cleanup`, limpeza de fotos órfãs) 29 (`20261103120000_sighting_privacy`, privacidade dos avistamentos — P0) 30 (`20261103160000_tutor_push_public_place`, push do tutor e rótulo público do avistamento) e 31 (`20261104120000_push_outbox_recovery`, recuperação de push preso) e 32 (`20261105120000_public_area_100m`, ponto público de 100 m), 33–38 (fila de adoção, avisos compatíveis, retenção, cancelar interesse), 39 (tipos de parceiro, CPF cifrado, CNPJ) 40 (exportação LGPD), 41 (chat de adoção) e 42–43 (CPF só para titular/admin, rotação, correção pelo titular, validações) aplicadas só no `mel-dev`; aplicar no `mel-prod` na fase de lançamento** (pre-flight já espera 43). Depois da 29, no lançamento: `node scripts/sighting-media-neutral-names.mjs` (lista; `--apply --confirm-target=<ref>` renomeia fotos antigas, se houver).

- Captcha do Supabase Auth (Turnstile) — fecha a criação de sessões anônimas em série, a origem das sessões descartáveis. **Pronto no código (2026-11-03):** `captchaToken` em `ensureSession` (sessão anônima), cadastro, login e recuperação de senha; o token só é pedido quando o Auth precisa (quem já tem sessão não gasta), e o formulário pega outro para a rota. Denúncia também com Turnstile (`/api/denuncias`). Provado contra o Auth real com captcha ligado (fase do CI `schema-rebuild`, `tests/captcha.test.ts`). Falta só ligar no painel do `mel-prod`. As rotas `/api/avistamentos`, `/api/encontrados` e `/api/conversas` já verificam Turnstile no servidor (`lib/turnstile.ts`; DEV usa as chaves de teste da Cloudflare).
- Agendador do push (`GET`/`POST /api/push/dispatch` com `Authorization: Bearer` + `CRON_SECRET` ou `PUSH_DISPATCH_SECRET`; GET é o do Vercel Cron) também apaga as fotos órfãs do `sighting-media` (mais de 24 h sem avistamento/encontrado, até 100 por chamada). **Código pronto (2C, 2026-11-04)**; o Cron não está ligado — configurar no lançamento (checklist 3.5). Região `gru1` em `apps/web/vercel.json`, a confirmar no 1º deploy (3.7).
- Push preso em `SENDING` (despacho interrompido no meio): **resolvido no `mel-dev` (migration 31, 2D, 2026-11-04)** — reserva expira em 15 min e volta à fila, até 3 vezes e só para avisos de até 6 h; depois, `FAILED`. Não é entrega única: se o serviço de push aceitar e o processo cair antes de registrar, o push pode sair 2 vezes (o `tag` da notificação faz o aparelho substituir em vez de empilhar).
- **Backup (2E, 2026-11-04):** `scripts/backup/` (backup.sh, restore.sh, storage.mjs) + ensaio manual `backup-restore-drill.yml` com dados sintéticos, **verde**: banco + Auth + arquivos voltam iguais num banco novo. Falta ativar (repositório privado, bucket externo, alerta) e provar contra um projeto hospedado — [14-backup-restauracao.md](14-backup-restauracao.md).
- **Backup incremental (2H, 2026-11-04):** só arquivos novos/substituídos são baixados; pontos selados com `.ok`; restauração confere tudo antes e exige `RESTORE_CONFIRM`; retenção de 30 dias pelo script (`prune`). Ensaio com 9 cenários verde. Falta: projeto hospedado e bucket real.
- **Pré-ativação do backup (2I, 2026-11-04):** referência quebrada agora é registrada no ponto e reconciliada antes da carga (antes, um ponto "completo" podia falhar no fim da restauração); `.ok` só depois de conferir os blobs. Fornecedor: Backblaze B2. Procedimento do proprietário, modelo do workflow privado e critérios READY/TESTED/ACTIVE em [15-ativacao-backup.md](15-ativacao-backup.md). Estado: **READY**.
- **Guia de ativação (2K, 2026-11-04):** [16-guia-backup.md](16-guia-backup.md), passo a passo para o proprietário (GitHub privado, B2, chaves age, secrets, healthchecks, workflow manual, checklist do 1º teste). Ajustes: sem Environments no GitHub Free (secrets do repositório), verificação diária rápida + completa mensal, leitura dos `.sha256` numa única chamada.
- **Armazenamento em São Paulo (2L, 2026-11-04):** decisão do proprietário; B2 suspenso. Recomendação: Oracle OCI `sa-saopaulo-1` (US$ 0), alternativa Magalu Cloud `br-se1` (~R$ 2/mês) — [17-armazenamento-sao-paulo.md](17-armazenamento-sao-paulo.md). Aguardando aprovação; guia 16 a refazer para o provedor escolhido.
- **CI isolado (2F, 2026-11-04):** só o job `integration` do `ci.yml` usa o `mel-dev`; ele roda um por vez (`concurrency: mel-dev-shared-database`, sem cancelar quem está rodando). Push em sequência: o do meio pode ser cancelado ANTES de começar (o GitHub guarda só 1 na espera) e o mais novo é testado. Testes locais (`npm run test:db`, `test:e2e`) contra o `mel-dev` não entram nessa fila: não rodar enquanto o CI roda.
- Limites anti-abuso (migration 27) estão calibrados para o MVP; revisar com os eventos `abuse_guard` (tabela `events`, 30 dias) e os avisos `limite atingido` nos logs das rotas.
- SMTP próprio (recuperação de senha, depois "Confirm email" — o código já mostra "confira seu e-mail").
- Nome do perfil de quem vincula Google a uma sessão anônima fica vazio até o onboarding (o onboarding pede).
- Limite de sessões anônimas do **mel-dev**: **300/h por IP** desde 2026-11-03 (era 30/h e o CI falhava com `over_request_rate_limit` quando testes locais e o CI rodavam na mesma hora). Só no `mel-dev`: no `mel-prod` continua baixo (30/h), junto com o captcha previsto para o lançamento.
- Usuários anônimos órfãos (quem entra numa conta existente): limpeza futura.
- **Revisão final — `pet-photos` com o UUID do dono no caminho** (`<uuid>/…`, bucket público; vale também para fotos de adoção e logo de parceiro). Quem ajuda não aparece mais ali (avistamentos/encontrados usam o `sighting-media` com nome neutro desde a migration 29), mas o UUID liga entre si o conteúdo público da mesma pessoa: alerta, anúncio de adoção e empresa parceira (que tem nome e endereço públicos). Impacto: baixo/médio — o conteúdo já é público e assumido pelo dono; o ganho do atacante é ligar perfis (ex.: tutor do alerta ↔ dono da empresa). Recomendação: mesma solução do `sighting-media` (nome neutro + posse pelo `owner_id`), num pacote próprio — mexe nas políticas do bucket, nos triggers de fotos de pet, adoção e parceiro e na exclusão de conta.

## Pendências C/D (fora do MVP — auditoria final de 2026-11-03)

Não entram no Feature Freeze. Cada uma só volta se virar correção de segurança/regressão ou requisito de lançamento, com autorização.

**C — corrigir só se for muito barato:**
- Pets públicos legíveis direto pelo REST com `owner_id` (e enumeração); logo de parceiro com o UUID do dono no caminho.
- Radar lista alertas FOUND e encontrados REUNITED/CLOSED sem selo de status (`get_my_matches`).
- HTML inválido no `LostWizard` (`<div>` dentro de `<p>`, botão dentro de `<dl>`) → aviso de hidratação.
- Isolamento dos testes no `mel-dev`: a limpeza do E2E apaga todo anônimo criado durante a execução (inclusive de um CI simultâneo); CI sem `concurrency`.
- Push: segredo do despachante comparado sem `timingSafeEqual`; endpoint de inscrição sem lista de hosts permitidos.
- `metadataBase` / `og:url` / canonical.
- Moderador suspenso continua moderador; moderador pode suspender um admin.
- Atalho para `/admin` no perfil de quem modera.

**D — pós-lançamento:**
- Suspensão incompleta (não bloqueia editar o já publicado, denunciar, Guardião, pets e upload).
- 404 com status 200 nas rotas dinâmicas (`notFound()` dentro de `<Suspense>`).
- `robots.txt`, sitemap, OG da home.
- `pet-photos` com nome neutro (correção completa, ~8–12 h, com migration) — item "Revisão final" acima.
- Fotos substituídas de adoção e logo ficam órfãs no Storage; usuários anônimos antigos nunca expiram.
- Skip link; alvos de toque secundários < 44 px (zoom do mapa, links de texto).
- Fila de push: envio sequencial; reenvio de item abandonado pode duplicar (raro; ver migration 31).
- Prévia do cartaz gera 3 PNGs grandes; `getPublicLostCase` roda 2× por visita.

**Configurações e código necessários ao lançamento:** [12-checklist-lancamento.md](12-checklist-lancamento.md) — captcha do Auth no código, CSP completa, migrations 24–30 + script das fotos antigas, domínio, `NEXT_PUBLIC_SITE_URL` no build, Site URL/redirects, SMTP + "Confirm email", Google OAuth, Turnstile/MapTiler/VAPID de produção, agendador do push, secrets, rate limits de produção, primeiro moderador, revisão jurídica e smoke test.

## Proibido em produção (sempre)

`supabase link` · `supabase config push` · `db reset` · `migration repair` · seed · E2E/testes destrutivos · editar migrations já aplicadas · colocar o `mel-prod` em `MEL_SAFE_TARGET_REFS` · SQL manual/alterações de schema pelo painel · enfraquecer travas. Segredos nunca em arquivo versionado, chat ou log.

## Como retomar

1. `git pull` na `main` e confira o CI.
2. Para qualquer verificação em produção: PowerShell com as 3 variáveis temporárias (ver [08-deploy-producao.md](08-deploy-producao.md)) e `node scripts/prod/postdeploy-check.mjs --production --expect-ref=<ref>` — somente leitura; deve passar inteiro.
3. Próximo item: comprar o domínio; depois seguir [11-email-producao.md](11-email-producao.md) (SMTP → templates → "Confirm email" ON); em paralelo, preparar o client no Google Cloud.

## Documentos

[Checklist de lançamento](12-checklist-lancamento.md) · [Migrations](09-migrations.md) · [Deploy de produção](08-deploy-producao.md) · [E-mail de produção](11-email-producao.md) · [Milestones](06-milestones.md) · [Decisões](decisoes.md) · [Banco (planejamento)](03-database.md)
