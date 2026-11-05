# MEL: especificações funcionais para aprovação (Adoção, Mural, Parceiros)

> **Status: proposta.** Nada aqui foi implementado. Antes de qualquer migration, o proprietário precisa aprovar as decisões da última seção.
> Base: análise do schema atual (`supabase/migrations`), do `@mel/data` e das telas em `apps/web/app/(app)`. Os dados são de 2026-11-05.

---

## 0. Referência analisada: Caramelo Online

O que observamos em `carameloonline.com.br`, `/mural` e `/cadastrar`. Esta análise não reaproveita marca, textos, imagens nem código deles.

### O que eles fazem bem

**Lista de quem quer adotar, mesmo sem animais disponíveis.**
- Um formulário curto registra a pessoa como interessada, com:
  - nome e WhatsApp;
  - bairro e cidade;
  - espécie (cão, gato ou tanto faz), porte, idade e moradia;
  - se já tem outros animais;
  - um texto livre sobre a rotina.
- Depois da aprovação da equipe, aparece no mural "Querem adotar" apenas o primeiro nome, o bairro e as preferências.
- O WhatsApp nunca é publicado.

**Mural único dividido em seções.** As seções são: perdidos, encontrados na rua (avisando que não são verificados), para adoção, "de volta pra casa" e "querem adotar". Cada uma tem um contador.

**Aviso anti-golpe no mural.** Recomenda não pagar antes de ver o animal, encontrar em local público e ligar para o 190 em caso de suspeita.

**Pouca fricção.** O fluxo não pede login.

### O que a MEL deve fazer diferente

**Contas e contato dentro do app, não por WhatsApp.**
- A MEL já tem contas e chat interno, e já usa moderação, captcha e limites de uso.
- O contato acontece pelo chat da MEL. O WhatsApp só é trocado se a própria pessoa quiser, dentro da conversa.
- O resultado é menos exposição de telefone e menos golpe.

**Interesse com ciclo de vida.**
- No Caramelo, depois do envio, a pessoa não vê nem controla o próprio interesse.
- Na MEL, ela vê o status, edita, pausa e cancela. O interesse também expira sozinho (LGPD: guardar só pelo tempo necessário).

**Tudo pelo app, inclusive fotos.** As fotos são enviadas pelo próprio app, já reduzidas e sem EXIF. No Caramelo elas vão "depois, pelo WhatsApp".

**Estados vazios úteis.**
- Lá, o mural mostrava contadores zerados sem nenhuma ação.
- Na MEL, uma lista vazia sempre oferece um próximo passo, por exemplo "Nenhum animal agora: entre na lista de interessados".

**Parceiros com cadastro real.** Lá, o botão "Quero ser parceiro" não levava a lugar nenhum. A MEL já tem cadastro e moderação de parceiros.

---

## 1. Adoção

### Objetivo

Unir quem tem um animal para doar a quem quer adotar com responsabilidade. Isso vale também quando não há animal disponível, situação em que a pessoa entra numa fila de interessados.

### O que já existe

**Anúncios** (`adoption_listings`):
- status `PENDING_REVIEW → AVAILABLE → IN_PROCESS → ADOPTED` (ou `REJECTED`/`REMOVED`);
- de 1 a 4 fotos;
- localização pública aproximada: `fuzz_lat_lng(…, 250)`; o ponto exato fica privado;
- campos de saúde: castrado, vacinado e vermifugado.

**Interesse num anúncio** (`adoption_interests` + `submit_adoption_interest`):
- exige conta não anônima;
- pede moradia (`house`, `apartment` ou `other`), se tem outros animais, se tem crianças e uma mensagem de 10 a 1000 caracteres;
- limite de 10 interesses por dia;
- respeita bloqueio e suspensão;
- abre uma conversa no chat com quem doa.

**Moderação dos anúncios:** `admin_list_adoptions_for_review` e `admin_review_adoption`.

**Telas:** `/adocao` (lista), `/adocao/[code]` (detalhe) e `/publicar/adocao`.

### Jornada

**Visitante sem login**
1. Abre **Adoção** e vê os animais disponíveis, com filtros de espécie, porte e idade e as fotos.
2. Abre o detalhe de um animal. Vê as fotos, o bairro aproximado, a saúde, o temperamento e os requisitos de quem doa.
3. Clica em **"Quero adotar este pet"** ou, se a lista estiver vazia, em **"Entrar na lista de interessados"**. Antes de pedir login, a tela explica o que será pedido e por quê.
4. Faz login ou cria a conta e volta para o formulário com `next` preservado e o que já tinha preenchido mantido.

**Com conta: interesse num animal específico** (já existe)
1. Preenche moradia, outros animais, crianças e a mensagem.
2. Confirma o consentimento, por exemplo: "Concordo em compartilhar estas respostas e meu primeiro nome com quem está doando".
3. Uma conversa é aberta com quem doa. Quem envia acompanha tudo em **Meus interesses**.

**Com conta: fila de interessados** (novo, sem animal específico)
1. Preenche o formulário de **perfil de adoção** (campos abaixo).
2. Opcionalmente, permite aparecer na lista pública "Querem adotar", só com primeiro nome, bairro e preferências.
3. O perfil fica `PENDING_REVIEW` até a moderação aprovar.
4. Quando entra um anúncio compatível (espécie, porte, idade e distância), a pessoa recebe uma notificação no app. Isso pode reutilizar `notifications` e o mesmo raio usado pelo Guardião.
5. Pode **editar**, **pausar** ou **cancelar** a qualquer momento. Ao cancelar, os dados são apagados, não apenas escondidos.
6. O perfil expira em 90 dias. Uma semana antes, chega um lembrete "Ainda procura?".

**Quem doa**
1. Publica o anúncio, que vai para a moderação.
2. Vê os interessados do próprio anúncio: primeiro nome, respostas e mensagem.
3. Conversa pelo chat e muda o status para Em processo ou Adotado.

**Moderação**
- Já existe a fila de anúncios.
- Novo: a fila de perfis de interessados, com aprovar, recusar com motivo e suspender.
- As denúncias usam o `report_content` que já existe.

### Campos do perfil de adoção (fila)

| Campo | Obrig.? | Por quê / minimização |
|---|---|---|
| Espécie desejada (cão / gato / tanto faz) | Sim | Base do "compatível" |
| Porte (pequeno / médio / grande / tanto faz) | Não | Refina o compatível |
| Idade (filhote / adulto / idoso / tanto faz) | Não | Idem |
| Bairro e cidade | Sim | Usados para a distância. Guardamos apenas o ponto aproximado (250 m) ou só o rótulo. Nunca o endereço |
| Moradia (casa / apartamento / outro) | Sim | Adoção responsável. Já é usada no interesse atual |
| Tem outros animais? | Sim | Idem |
| Tem crianças em casa? | Não | Já existe no interesse atual. Responder deve ser opcional |
| Sobre a rotina (texto, 20–600) | Sim | Contexto para quem doa. Aviso: "não escreva telefone, endereço nem documentos" |
| Aparecer em "Querem adotar" | Não (padrão: **não**) | Opt-in explícito |
| Consentimento LGPD | Sim | Finalidade, prazo de 90 dias e como cancelar |

**Ficam de fora de propósito:**
- WhatsApp e telefone: o contato é pelo chat da MEL.
- CPF, renda e endereço completo.
- Fotos da casa: só se quem doa pedir, e pelo chat.

### Regras de privacidade

- **Contato:** nunca é público. A troca de contatos só acontece dentro da conversa e por iniciativa das pessoas.
- **Lista pública "Querem adotar":**
  - mostra só o primeiro nome, o bairro e as preferências;
  - aparece somente para quem fez opt-in e foi aprovado;
  - os outros campos ficam fora.
- **Quem doa vê** apenas os interessados do próprio anúncio. Isso já é garantido por RLS.
- **Cancelar o interesse** apaga a linha.
  - Hoje **não existe** policy de `delete` nem função para isso: é uma lacuna.
- **Retenção:** o perfil expira em 90 dias, e os interesses de anúncios encerrados são apagados X dias depois do encerramento (decisão do proprietário).
- **O anúncio público** mostra só a localização aproximada (já é assim).

### Estados vazios e erros

**Sem animais disponíveis.** Card com o texto "Nenhum pet esperando agora perto de você" e dois botões:
- **Entrar na lista de interessados**;
- **Ver também em outras cidades**.

**Interesse duplicado.** Hoje o `on conflict` atualiza o interesse anterior. A tela deve avisar "Você já enviou interesse; atualizamos sua mensagem".

**Mensagens dos erros que já existem no banco:**
- Limite diário: "Você enviou muitos interesses hoje".
- Anúncio encerrado: "Este pet já encontrou família ou não recebe mais interessados", com o botão **Entrar na fila**.

**Sessão anônima:** levar ao login, explicar o motivo e voltar ao formulário depois.

### Lacunas

| Item | Já existe | Falta (só código) | Exige migration (aprovação) |
|---|---|---|---|
| Lista e detalhe de animais | ✅ `list_adoptions`, `get_public_adoption` | Filtro de idade na UI | Filtro de idade no RPC (hoje só espécie e porte) |
| Interesse num anúncio | ✅ | Tela "Meus interesses" e consentimento explícito na UI | — |
| Cancelar interesse num anúncio | ❌ | — | Função `withdraw_adoption_interest` |
| Interesse **sem anúncio** (fila) | ❌ (o interesse exige `listing_id not null`) | — | Tabela `adoption_seekers` (preferências, área aproximada, opt-in público, status, expiração) + RLS + RPCs |
| Fila de moderação de interessados | ❌ | Tela de admin | RPCs `admin_list_seekers_for_review` e `admin_review_seeker` |
| Aviso de anúncio compatível | ❌ | — | Gatilho quando o anúncio vira `AVAILABLE` → `notifications` |
| Lista pública "Querem adotar" | ❌ | Tela | RPC `list_public_seekers` (só os campos públicos) |
| Retenção e expiração | ❌ | — | Rotina de limpeza no agendador que já existe |

---

## 2. Mural

### Objetivo

Uma vitrine única, com fotos, de animais **perdidos**, **encontrados ou vistos** e **para adoção** perto da pessoa, com filtros e detalhes. Não expõe animais privados nem dados sensíveis.

### O que já existe

**`search_public_cases(p_kinds …)`:**
- traz os tipos `lost` (alerta ativo), `found` (sob cuidado) e `sighting` (visto solto);
- devolve a distância calculada a partir do ponto público de 250 m;
- alimenta o `/mapa`, o `/perdidos` e o `/encontrados`.

**`list_adoptions`:** existe em separado. A adoção **não** faz parte de `search_public_cases`.

**Pets privados.** O cadastro de pets da pessoa nunca é público. O animal só aparece quando há um alerta ativo. Isso já é garantido por RLS e pelas funções.

### Jornada

1. Abre o **Mural**, que mostra por padrão "Todos" perto da localização ou do bairro escolhido.
2. Usa os filtros:
   - tipo: Todos, Perdidos, Encontrados, Vistos, Adoção;
   - período: 24 h, 7 dias, 30 dias;
   - espécie: Cão, Gato;
   - raio.
   - Os filtros ficam na URL, o que permite compartilhar o link.
3. Cada card mostra foto, selo do tipo (cor e texto, nunca só cor), nome ou "Sem nome", bairro aproximado e "há X dias".
4. O card abre o detalhe do tipo correspondente: `/alerta/[code]`, `/encontrado/[code]` ou `/adocao/[code]`.
5. Botão **Ver no mapa**, com os mesmos filtros.
6. Uma faixa fixa de **aviso anti-golpe**:
   - "a MEL nunca cobra";
   - "não pague antes de ver o animal";
   - "encontre em local público".

O visitante sem login vê tudo o que é público. O login só é pedido para agir: avistamento, contato ou interesse.

### Regras de privacidade

- **Só entra no mural** o que já é público: alerta ativo, encontrado ou visto publicado, adoção `AVAILABLE` ou `IN_PROCESS`.
- **Não entram** pets sem alerta, pendências de moderação, casos encerrados ou conteúdo removido por denúncia.
- **Nada de** endereço, telefone, nome completo do tutor ou ponto exato. A localização vem só da grade de 250 m e do rótulo do bairro.
- **Fotos** sempre reduzidas e sem EXIF (já é assim no upload).

### Estados

- **Carregando:** skeleton dos cards.
- **Vazio por filtro:** "Nada com esses filtros", com botões para ampliar o período ou o raio.
- **Vazio total:** convite para ativar o Guardião, que avisa quando aparecer algo perto.
- **Erro:** "Não conseguimos carregar agora", com **Tentar de novo**.

### Lacunas

| Item | Já existe | Falta (só código) | Exige migration |
|---|---|---|---|
| Perdidos, encontrados e vistos juntos | ✅ `search_public_cases` | Tela `/mural` em grade de fotos | — |
| Adoção no mesmo feed | Parcial (RPC separado) | **Opção A:** juntar no cliente as duas chamadas e ordenar por data. Sem migration, mas a paginação conjunta é aproximada | **Opção B:** incluir o tipo `adoption` no `search_public_cases`, com paginação correta |
| Filtro de período | Verificar os parâmetros do RPC | UI | Talvez, se o RPC não tiver `since` |
| Reencontros ("de volta pra casa") | Casos encerrados existem | Seção opcional | Talvez um RPC público de reencontros recentes, só com foto e bairro |

---

## 3. Parceiros

### Objetivo

Divulgar sem custo quem ajuda os animais: clínicas, pet shops, ONGs e protetores. A divulgação passa por moderação e não transforma a MEL em marketplace.

### O que já existe

**`businesses`:**
- categorias `vet | petshop | grooming | hotel | trainer | ngo | other`;
- status `PENDING_REVIEW → APPROVED/REJECTED/SUSPENDED`;
- endereço público ("é estabelecimento, não casa");
- telefone, WhatsApp, site e Instagram, todos opcionais;
- campo `helps_lost`;
- logo.

**`business_offers`:** inclui `is_sponsored`, com o selo "Patrocinado" nas telas e nos termos.

**Telas:**
- `/parceiros`: pública, abre sem login;
- `/parceiros/[code]`;
- `/publicar/parceiro`: protegida.

**Moderação:** `admin_review` / `reviewBusiness`.

**Ainda não existem:**
- CPF ou CNPJ;
- razão social;
- o tipo "protetor independente".

### Jornada

1. **Visitante sem login** abre **Parceiros** e encontra uma página explicativa:
   - o que é o programa e que ele é gratuito no piloto;
   - o que o parceiro ganha e o que a MEL exige;
   - como funciona a moderação;
   - quais dados ficam públicos.
   - Só depois aparece o botão **Quero ser parceiro**.
2. Escolhe o **tipo de parceiro**, e cada tipo leva a um formulário diferente:
   - **Empresa:** clínica, pet shop, banho e tosa, hotel, adestramento.
   - **ONG ou associação.**
   - **Protetor ou protetora independente.**
3. Faz login, que é exigido só neste passo, com `next` preservado.
4. Preenche o formulário do tipo escolhido (veja a tabela) e aceita os termos.
5. O cadastro entra em **Em análise**. A pessoa acompanha o status em **Perfil → Meus cadastros**.
6. **Moderação:**
   - confere os dados, com a checagem do CNPJ só quando ele é informado;
   - aprova, recusa com motivo ou pede correção;
   - parceiros aprovados aparecem na lista e no mapa.

### Campos por tipo

| Campo | Empresa | ONG | Protetor independente |
|---|---|---|---|
| Nome público | Obrig. | Obrig. | Obrig. (pode ser apelido, como "Protetora da Vila X") |
| Categoria do serviço | Obrig. | — | — |
| Descrição (20–800) | Obrig. | Obrig. | Obrig. |
| Razão social | Opcional | Opcional | **Não pedir** |
| CNPJ | Opcional, recomendado. Se informado, validar o dígito e, na moderação, a situação ativa | Opcional, recomendado | **Não pedir** |
| CPF | **Nunca** | **Nunca** | **Não pedir no piloto** (ver a decisão 7) |
| Endereço | Obrig. e público (estabelecimento) | Opcional. Se público, só o bairro | **Só bairro e cidade**, nunca o endereço (é a casa de alguém) |
| Contato público | Pelo menos 1: telefone, WhatsApp, site ou Instagram | Pelo menos 1 | Opcional. Padrão: contato só pelo chat da MEL |
| "Ajuda com perdidos" (leitor de chip, lar temporário) | Opcional | Opcional | Opcional |
| Logo ou foto | Opcional | Opcional | Opcional (sem rosto de pessoas) |

### Regras de privacidade

- **Protetor independente:** é pessoa física. Fica público só o bairro, sem endereço e sem documento. O contato é pelo chat por padrão.
- **Um CNPJ informado** não é exibido, só o selo "CNPJ verificado". Uma empresa pode optar por mostrar a razão social.
- **Dados de moderação** (nota de revisão, documentos) nunca são públicos.
- **Ofertas "Patrocinado":** pela condição do piloto (sem receita, anúncio ou patrocínio, por causa do MapTiler Free e da Vercel Hobby), o `is_sponsored` deve ficar **desativado na UI**. Ofertas, se existirem, seriam apenas gratuitas e informativas. Ver a decisão 9.

### Estados

- **Nenhum parceiro na região:** "Ainda não há parceiros aqui", com o botão **Indique ou cadastre um parceiro**.
- **Cadastro recusado:** mostrar o motivo e o botão **Corrigir e reenviar**.
- **CNPJ inválido:** erro no campo, de forma compreensível: "Confira os 14 números do CNPJ". O formulário não é bloqueado se o campo for apagado.

### Lacunas

| Item | Já existe | Falta (só código) | Exige migration |
|---|---|---|---|
| Página explicativa antes do login | `/parceiros` já é pública | Seção "Como funciona" e a escolha do tipo | — |
| Tipo empresa, ONG ou protetor | Parcial (`ngo` é uma categoria) | — | Coluna `partner_kind` (`company`/`ngo`/`independent`) ou novo valor no enum |
| Endereço só com bairro para protetor | ❌ (`address_label`, `lat` e `lng` são obrigatórios e públicos) | — | Tornar o ponto público aproximado para `independent` (reutilizar `fuzz_lat_lng`) |
| Razão social e CNPJ | ❌ | Validação do dígito no `@mel/core` | Colunas `legal_name` e `cnpj` (privadas, visíveis só ao dono e à moderação) + `cnpj_verified_at` |
| Pedir correção | Recusa com nota | UI de reenvio | Talvez o status `CHANGES_REQUESTED` |
| Ofertas patrocinadas | ✅ (`is_sponsored`) | Esconder ou desativar no piloto | — |

---

## 4. Decisões para o proprietário

1. **Fila de interessados.** Aprovar a criação da fila de interessados sem animal específico (nova tabela e moderação)?
2. **Contato na fila.** O contato fica **só pelo chat da MEL**, sem pedir WhatsApp, como recomendamos? Ou o WhatsApp deve ser pedido, em privado e visto só pela moderação?
3. **Lista pública "Querem adotar".** Ter a lista, com opt-in, mostrando só o primeiro nome, o bairro e as preferências? Ou deixar o perfil apenas privado?
4. **Retenção.** O perfil de interessado expira em 90 dias? Os interesses de anúncios encerrados são apagados depois de quantos dias (sugestão: 30)?
5. **Aviso de anúncio compatível.** Avisar no app quando surgir um animal compatível? Em qual raio (sugestão: o mesmo do Guardião)?
6. **Adoção no mural.** Usar a Opção A (sem migration, junta no cliente) ou a Opção B (incluir a adoção no `search_public_cases`)?
7. **CPF do protetor independente.** Confirmar que **nenhum** CPF será pedido no piloto, como recomendamos. Ou o CPF deve ser pedido, guardado em privado, para reduzir fraude?
8. **CNPJ.** Fica opcional, com o selo "verificado"? Ou é obrigatório para empresas?
9. **Ofertas.** Desativar as ofertas "Patrocinado" durante o piloto (coerente com MapTiler Free e Vercel Hobby)? Ou remover as ofertas inteiramente?
10. **Pergunta sobre crianças.** Manter "tem crianças em casa?" como **opcional**? Hoje ela é obrigatória no interesse.

## 5. Migrations propostas

Nenhuma foi escrita. Todas dependem das decisões acima.

| # | Nome sugerido | Finalidade |
|---|---|---|
| 1 | `adoption_interest_withdraw` | Permitir que quem enviou cancele o próprio interesse num anúncio (função `withdraw_adoption_interest`, que apaga a linha e avisa na conversa) e tornar `children` opcional |
| 2 | `adoption_seekers` | Tabela da fila de interessados: preferências, área aproximada de 250 m, rotina, opt-in público, status de moderação, `expires_at`; RLS; RPCs `upsert_my_seeker`, `pause`/`withdraw_my_seeker` e `list_public_seekers` |
| 3 | `adoption_seekers_moderation` | RPCs de moderação (listar e revisar) com registro em `moderation_actions` |
| 4 | `adoption_seeker_matches` | Ao virar `AVAILABLE`, notificar os interessados compatíveis no raio, com limite por dia |
| 5 | `adoption_retention` | Limpeza agendada: perfis expirados e interesses de anúncios encerrados |
| 6 | `public_feed_adoption` *(se Opção B)* | Incluir o tipo `adoption` (e o filtro de período) em `search_public_cases` |
| 7 | `partner_kind_and_documents` | `partner_kind` (empresa, ONG ou independente); `legal_name` e `cnpj` privados, com `cnpj_verified_at`; localização aproximada para `independent`; regras de campos obrigatórios por tipo no trigger |
| 8 | `partner_changes_requested` *(opcional)* | Status "pedir correção" na revisão de parceiros |
