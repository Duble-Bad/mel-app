# MEL — Product Spec

> **Uma rede inteira procurando com você.**
> Começou por uma Mel. Agora é por todos eles.

KPI norte: **pets reencontrados**. Tudo que não ajuda a reencontrar animais vem depois.

---

## 1. Problema

Quando um animal some, a busca se fragmenta entre WhatsApp, Instagram, Facebook, cartazes e grupos de bairro. Não há:

- um único link confiável para divulgar;
- um lugar para receber pistas com **local e horário**;
- um jeito de alcançar **quem está perto agora**;
- um cruzamento entre "perdi" e "encontrei" (os dois lados raramente se veem);
- proteção contra golpistas que exploram tutores desesperados.

## 2. Personas

| Persona | Contexto | Precisa de | Medo |
|---|---|---|---|
| **Tutora angustiada** (Ana, 52) | Pet sumiu há 15 min, pouca intimidade com apps | Publicar em ~2 min, alcançar vizinhos, gerar cartaz | Perder tempo; ser enganada |
| **Quem encontrou** (Bruno, 28) | Achou um cão na rua, está com ele no colo | Publicar rápido, achar o dono, não ser cobrado/exposto | Entregar para a pessoa errada |
| **Quem avistou** (Carla, 35) | Viu um gato assustado indo para a praça | Mandar a pista em 30 s, sem criar conta | Burocracia, expor o telefone |
| **Guardião** (Diego, 22) | Gosta de ajudar, mora num bairro movimentado | Alertas próximos, sem spam | Notificação demais |
| **Protetora / ONG** (Elisa) | Muitos animais para adoção | Divulgar, filtrar interessados | Adotante irresponsável |
| **Adotante** (Fábio, 30) | Quer adotar com responsabilidade | Ver animais próximos com informação honesta | Processo opaco |
| **Parceiro local** (Clínica Vet) | Quer ser lembrado no bairro | Perfil, mapa, ofertas | Investir sem retorno mensurável |
| **Admin MEL** | Moderação | Denúncias, suspender, auditoria | Golpes e conteúdo abusivo |

## 3. Jornadas principais

1. **Perdi meu pet** → alerta ativo em ~2 min → link + cartaz + WhatsApp → Guardiões próximos notificados → avistamentos chegam na timeline/mapa → chat com quem viu → **reencontro** → agradecimento à comunidade.
2. **Encontrei um pet** → foto + local + estado → FOUND_CASE → Radar MEL sugere *possíveis correspondências* → contato via chat → **prova de posse** → devolução.
3. **Vi um pet** (com ou sem conta) → onde/quando/direção → aparece na timeline do alerta (ou como avistamento solto no mapa).
4. **Guardião** → ativa raio e tipos → recebe alertas próximos com limite de frequência.
5. **Adoção** → listagem → página com compatibilidades → formulário de interesse → doador responde por chat.
6. **Parceiro** → cadastro → aprovação admin → aparece no mapa/diretório, sempre rotulado.

## 4. Funcionalidades por fase

### MVP (Fase 1) — "a busca funciona de ponta a ponta"
Os 22 itens do documento-mestre, **ordenados por impacto no reencontro** (ver `06-milestones.md`):

- Núcleo da busca: auth (inclui anônimo), onboarding curto, perfil, pets + MEL ID, alerta de desaparecimento, encontrei, avistamento, mapa com filtros, página pública + OG, timeline, compartilhamento, QR, cartaz (PNG 1:1, 9:16, A4 imprimível), chat, reencontro.
- Rede: Guardião MEL, notificações in-app + Web Push, Radar MEL (score heurístico).
- Confiança: denúncia, bloqueio, rate limit, captcha em ações anônimas, prova de posse, painel admin mínimo + audit log.
- Expansão: adoção básica (listar, cadastrar, interesse, status), diretório básico de parceiros (sem cobrança).

### Fase 2 — "rede maior e mais inteligente"
Matching visual por IA (embeddings de imagem), ONGs verificadas com fluxo administrativo, campanhas patrocinadas contextuais, painel empresarial com eventos reais, histórias de reencontro públicas, notificações por WhatsApp/SMS, app Expo (reaproveitando `packages/core`), login por telefone, Apple Sign-In.

### Fase 3 — "ecossistema"
Planos e assinaturas (Stripe/Mercado Pago), marketplace/ofertas avançadas, MEL Tag física (QR/NFC na coleira), integrações com clínicas (leitura de microchip), gamificação leve para Guardiões, API para ONGs/prefeituras.

## 5. Decisões do documento-mestre que eu ajustaria

| # | Ponto original | Problema | Proposta |
|---|---|---|---|
| A | Avistamento sem conta | Sem identidade não há como **responder** a quem viu, e abre spam | **Supabase Anonymous Sign-In**: a pessoa não preenche nada, mas ganha um `user_id` invisível → pode receber resposta no chat; depois converte em conta real sem perder histórico. + Cloudflare Turnstile + rate limit. |
| B | Prova de posse: "tutor registra características privadas" | Quem precisa da proteção é **quem encontrou** (para não entregar ao golpista). Se só o tutor cadastra, o finder não tem como conferir. | Dupla via: (1) **quem encontrou** registra um detalhe oculto do animal (ex.: "mancha na barriga") e pergunta ao suposto tutor no chat; (2) o tutor registra características privadas, usadas pelo Radar/admin em disputas. Ninguém vê a resposta do outro lado. |
| C | Golpe do "achei, mande PIX" | É o golpe mais comum no Brasil, não está no doc | Telefone oculto por padrão, aviso fixo no chat ("A MEL nunca pede pagamento. Desconfie de quem pede PIX antes de mostrar o animal"), denúncia em 1 toque. |
| D | Compartilhar "Instagram" | Não existe intent web para postar no Instagram | Web Share API (mobile abre o seletor nativo, incluindo Instagram) + **baixar imagem 9:16** para Stories. Botão diz "Stories (baixar imagem)". |
| E | Apple Sign-In no MVP | Exige conta Apple Developer paga + domínio configurado | Fase 2. MVP: e-mail (magic link + senha) e Google. |
| F | Push notifications em PWA | No iPhone, Web Push só funciona com o app **adicionado à tela inicial** (iOS 16.4+) | Notificação in-app sempre; push quando disponível; tela que ensina "Adicionar à tela inicial" no iOS. Canal WhatsApp na Fase 2. |
| G | Local "último visto" exato | Muitas vezes é a **casa do tutor** | Guardar o ponto exato (privado, para matching) e publicar um ponto **aproximado** (grade de ~150–300 m) por padrão; tutor pode optar por mostrar exato. |
| H | 22 itens no MVP | Arriscado entregar tudo ao mesmo tempo | Mantidos, mas em milestones; adoção e parceiros só entram depois do cenário "perdi há 15 min" passar inteiro no E2E. |
| I | Planos FREE/LOCAL/PRO/PREMIUM | — | Tabelas `plans`/`subscriptions` criadas desde já, sem UI de cobrança no MVP. |
