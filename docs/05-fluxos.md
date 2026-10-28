# MEL — Fluxos críticos

Princípios: 1 pergunta por tela, botões ≥ 56 px, rascunho salvo a cada passo (`lost_cases.status = DRAFT`), "pular e completar depois" sempre que não for essencial, linguagem humana.

---

## 1. Perdi meu pet — meta: alerta ativo em ≤ 2 min

```
[Home] PERDI MEU PET
   │  (não logado → /entrar com Google 1 toque ou link no e-mail; volta ao fluxo)
   ▼
P1  Qual pet?            [cards dos meus pets]  ou  [+ Cadastrar rápido]
                          rápido = foto (câmera/galeria) · nome · espécie (Cão/Gato/Outro)
                          · porte · cor principal   → resto "depois"
   ▼
P2  Onde ele foi visto pela última vez?
                          mapa já centrado no GPS · pin arrastável · busca de endereço
                          ⓘ "Mostraremos um local aproximado. Seu endereço não aparece."
                          [ ] Mostrar local exato (opcional)
   ▼
P3  Quando?               [Agora há pouco] [Hoje] [Ontem] [Escolher data/hora]
                          [ ] Não sei exatamente
   ▼
P4  Detalhes que ajudam   chips: Coleira · Roupa · Peitoral · Plaquinha
                          "Algo marcante?" (texto curto, opcional)
   ▼
P5  Como podem falar com você?
                          [✔] Chat MEL (recomendado, padrão)
                          [ ] WhatsApp público   [ ] Telefone público
                          ⚠ "Desconfie de quem pedir PIX antes de mostrar o animal."
   ▼
P6  Revisão (foto grande + resumo editável)
                          [  ATIVAR ALERTA MEL  ]   ← botão gigante, status-lost
   ▼
Sucesso:  "Alerta MEL ativado. Agora outras pessoas poderão ajudar na busca.
           Compartilhe para alcançar ainda mais pessoas."
          [WhatsApp] [Compartilhar…] [Copiar link] [Baixar cartaz]
          → vai para /alerta/[code]
```
Backend: `lost_cases` ACTIVE + `public_point = fuzz_point()` → fila: `notify_guardians`, `run_matching` → evento `lost_alert_created`.

---

## 2. Encontrei um pet — sem conta obrigatória

```
[Home] ENCONTREI UM PET   (sessão anônima criada silenciosamente + Turnstile)
   ▼
E1  Foto                  câmera/galeria (pode pular, mas incentivado)
E2  Onde você encontrou?  GPS + pin + busca
E3  Quando?               [Agora] [Hoje] [Escolher]
E4  Como ele é?           Espécie · Porte · Cor principal · Sexo (Não sei) · Raça provável (opcional)
E5  Onde ele está agora?  Está comigo · Local seguro · Clínica · Continua na rua · Outro
E6  Detalhe para confirmar o tutor (privado, opcional)
                          "Anote algo que só o verdadeiro tutor saberia (ex.: mancha na barriga).
                           Ninguém verá isso. Use para conferir antes de devolver."
E7  Contato               Chat MEL (padrão). Para receber resposta fora do app: e-mail opcional
                          → converte sessão anônima em conta.
   [ PUBLICAR ]
   ▼
Resultado imediato: Radar MEL roda → "Encontramos 2 possíveis correspondências perto daqui"
   [MatchCard 82%] → ver alerta → [Falar com o tutor] (chat)
   Sem matches: "Ainda não há alerta parecido. Vamos avisar você se aparecer." + compartilhar
```
Backend: `found_cases` ACTIVE → `run_matching` também é reexecutado quando novos `lost_cases` surgirem perto (notifica as duas partes).

---

## 3. Avistamento — em ~30 segundos

```
/alerta/[code]  →  [EU VI ESTE PET]      (ou /avistamento/novo, sem alerta)
   ▼
A1  Onde?          [Usar minha localização]  ou mover pin
A2  Quando?        [Agora] [Há 15 min] [Há 1 h] [Escolher]
A3  Para onde ia?  rosa dos ventos: N · S · L · O · Não sei   (setas grandes)
A4  Como estava?   chips: andando · correndo · parado · com outra pessoa · machucado · assustado · outro
A5  Foto e observação (opcionais)
   [ ENVIAR AVISTAMENTO ]
   ▼
"Obrigado! O tutor já foi avisado. Cada pista aproxima a Mel de casa."
   (opcional) "Quer que o tutor possa responder você?" → chat (anônimo já funciona)
```
Backend: `sightings` (lat, lng, seen_at, case_id, direção, estado, foto, user_id anônimo) → `notifications` para o dono (Realtime + push) → aparece na timeline e no mapa, ligado cronologicamente por linha tracejada. Rate limit: 5 avistamentos/hora por sessão.

---

## 4. Reencontro

```
/alerta/[code] (dono)  →  [MEU PET FOI ENCONTRADO ❤️]
   ▼
R1  "Que notícia maravilhosa! ❤️  Vamos confirmar?"      [Sim, está em casa]  [Cancelar]
R2  Como foi encontrado? chips: Voltou sozinho · Alguém viu pelo MEL · Alguém encontrou pelo MEL
                         · Vizinho · Clínica/abrigo · Outro
R3  Alguma pista ajudou?  lista de avistamentos/matches (opcional)
R4  Onde? (opcional, aproximado)   ·   Quer contar a história? (opcional)
   [ CONFIRMAR REENCONTRO ]
   ▼
Página do alerta vira:  "MEL ESTÁ EM CASA! ❤️"  (status FOUND, timeline preservada)
   → notificação "Obrigado por ajudar!" para quem enviou avistamento/compartilhou/conversou
   → card "ENCONTRADO!" (1:1 e 9:16) para compartilhar
   → evento pet_reunited (KPI principal)
```
Backend: `lost_cases.status = FOUND`, `found_at`, `found_how`, `helpful_sighting_id`; matches abertos → DISMISSED; Guardiões notificados recebem "resolvido" (apenas in-app, sem push).
