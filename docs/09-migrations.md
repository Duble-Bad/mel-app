# MEL — Migrations do banco

Fonte única do schema: `supabase/migrations/*.sql`, aplicadas em ordem de nome (timestamp).
Estado: **26 migrations**, validadas do zero. As 23 primeiras estão no `mel-dev` e no `mel-prod` (2026-10-29); a 24ª (Radar v2), a 25ª (ciclo de vida do alerta) e a 26ª (moderação de adoção e parceiros) só no `mel-dev` — **pendentes para produção** (fase de lançamento).

## Regras

- **Nunca edite uma migration já aplicada.** Correção = migration nova (ex.: `*_fix_*`).
- **Nada de dados de demo/seed** em migration. INSERT só em tabelas de referência (`storage.buckets`, `public.plans`). Dados fictícios vão no `npm run db:seed` (só desenvolvimento).
- Toda tabela em `public` com **RLS ligado** e primary key; leitura pública sensível só por funções que devolvem dados **aproximados** (nunca o ponto exato).
- Toda função `SECURITY DEFINER` com `search_path` fixo. Helpers internos ficam no schema `private` (fora da API).
- Banco nunca é alterado pelo painel nem por SQL manual: só por migration versionada.

## Lista

| # | Arquivo | Milestone | O que faz |
|---|---|---|---|
| 1 | `20261028120000_foundation.sql` | M1 | Extensões, schema `private`, helpers, `profiles` (+ RLS), health check |
| 2 | `20261028130000_avatars.sql` | M2 | Bucket `avatars` (2 MB), escrita só na própria pasta e só por contas reais |
| 3 | `20261028140000_pets.sql` | M3 | Pets, MEL ID, fotos (`pet-photos`), dados privados separados |
| 4 | `20261028150000_lost_cases.sql` | M5 | Alerta "Perdi meu pet": ponto exato privado, público aproximado (grade 250 m) |
| 5 | `20261028151000_fix_is_owner.sql` | M5 | `is_owner` falso (não nulo) para visitantes sem sessão |
| 6 | `20261028160000_sightings.sql` | M6 | Avistamentos (inclusive anônimos), linha do tempo, notificações in-app, antispam |
| 7 | `20261028161000_submit_sighting.sql` | M6 | `submit_sighting` resolve o código público e grava com as permissões de quem envia |
| 8 | `20261028170000_chat.sql` | M8 | Chat por alerta, bloqueio, denúncia; Realtime em `messages` |
| 9 | `20261029120000_reunion.sql` | M9 | Reencontro ("ESTÁ EM CASA"), agradecimento, KPI |
| 10 | `20261029121000_fix_is_owner_reunion.sql` | M9 | Restaura a correção de `is_owner` perdida na migration anterior |
| 11 | `20261029130000_found_cases.sql` | M10 | "Encontrei um pet" / "Vi um pet solto" + Radar MEL (correspondências) |
| 12 | `20261029131000_match_score_radius.sql` | M10 | Raio da Terra igual ao do código (`distanceMeters`) |
| 13 | `20261029132000_match_score_unknowns.sql` | M10 | "Não sei" vale menos no score |
| 14 | `20261029133000_match_score_unknowns_v2.sql` | M10 | Ajuste final dos pesos de "Não sei" (espelho de `computeMatchScore`) |
| 15 | `20261029140000_public_map.sql` | M11 | Mapa/radar público e listas com filtros, só pontos aproximados |
| 16 | `20261029150000_guardians.sql` | M12 | Guardião MEL, fila de push (`push_outbox`), assinaturas Web Push |
| 17 | `20261029151000_guardian_upsert_grant.sql` | M12 | Grant de UPDATE em `user_id` para o upsert do Guardião (protegido pela política) |
| 18 | `20261029160000_moderation.sql` | M13 | Denúncias em todo conteúdo, painel de moderação, audit log |
| 19 | `20261029161000_admin_overview_events.sql` | M13 | Contagem de reencontros do painel a partir dos eventos |
| 20 | `20261029170000_adoption.sql` | M14 | Adoção: anúncio moderado, interesse que abre conversa |
| 21 | `20261029180000_partners.sql` | M15 | Parceiros: cadastro aprovado pela moderação, diretório, ofertas "Patrocinado" |
| 22 | `20261029181000_partners_list_limit.sql` | M15 | Limite de `list_businesses` aplicado às empresas, não à linha agregada |
| 23 | `20261029190000_lgpd.sql` | M16 | Consentimentos e exportação dos próprios dados (LGPD) |
| 24 | `20261030120000_radar_public_distance.sql` | P0 auditoria | Radar v2: pontuação, faixa de distância (NEAR/MEDIUM/AREA) e existência da correspondência só pelos pontos públicos; recalcula correspondências antigas; avisos sem pontuação. **Pendente no `mel-prod`.** |
| 25 | `20261030140000_lost_case_close_edit.sql` | P1 auditoria | Ciclo de vida do alerta: `closed_at`; CLOSED só de ACTIVE; conteúdo travado após FOUND/CLOSED/REMOVED; página pública de encerrado mínima; linha do tempo de encerrado só do tutor; Radar recalculado ao editar local/data ou o pet. **Pendente no `mel-prod`.** |
| 26 | `20261030160000_adoption_partner_moderation.sql` | P1 auditoria | Moderação de adoção e parceiros: mudar conteúdo de anúncio aprovado (mesmo junto com o status) ou qualquer campo público de parceiro aprovado volta para revisão; `review_note` (e status/plano do parceiro) só pela moderação; denúncia de anúncio e de parceiro; "ocultar" remove o anúncio (`REMOVED`) ou suspende o parceiro (`SUSPENDED`). **Pendente no `mel-prod`.** |

Inventário resultante (banco reconstruído = `mel-prod`): 24 tabelas, 291 colunas, 43 FKs, 16 enums, 40 funções `public` + 46 `private`, 24 triggers (incl. `on_auth_user_created` e `on_auth_user_converted` em `auth.users`), 60 políticas `public` + 9 de Storage, 45 índices declarados, 3 buckets (`avatars` 2 MB, `pet-photos` 5 MB, `sighting-media` 5 MB), Realtime em `messages` e `notifications`.

## Garantias versionadas

| Arquivo | Papel |
|---|---|
| `supabase/migrations.manifest.json` | nome, ordem e sha256 de cada migration validada. O pre-flight de produção recusa qualquer diferença |
| `supabase/schema-fingerprint.json` | hash da definição completa do schema (13 categorias), gerado do banco reconstruído do zero. O pós-deploy compara a produção com ele |
| `.github/workflows/schema-rebuild.yml` | a cada push: sobe Supabase local vazio, aplica as migrations, audita objeto a objeto, compara com os tipos do dev, `db diff`, roda testes de banco (RLS/Storage/Auth/negativos) |
| `scripts/schema-audit/` | auditoria do catálogo (somente leitura), usada no CI e no pós-deploy |

## Como criar uma migration nova

1. `npx supabase migration new <nome>` e escreva o SQL (com RLS, grants e `search_path`).
2. `npm run db:push` (só aplica no `mel-dev`; a trava recusa qualquer outro alvo) e `npm run db:types`.
3. Testes: `npm run check`, `npm run test:db`, E2E se tocar em fluxo.
4. Atualize `supabase/migrations.manifest.json` (nova entrada com o sha256) e os números esperados em `scripts/prod/postdeploy-check.mjs` (`EXPECTED`) e no pre-flight (`EXPECTED_MIGRATIONS` em `scripts/prod/preflight.mjs`, hoje 26).
5. Push na `main`. O workflow de reconstrução gera `schema-fingerprint.generated.json`; versione-o como `supabase/schema-fingerprint.json` (ou rode `node scripts/schema-audit/audit.mjs --write-fingerprint` contra um Supabase local).
6. Produção: só com autorização explícita, pelo procedimento de [08-deploy-producao.md](08-deploy-producao.md).

## Produção: objetos fora das migrations

O `mel-prod` tem `public.rls_auto_enable()` + event trigger `ensure_rls` (liga RLS em tabelas novas do `public`), que já existiam antes do primeiro deploy. Decisão: **MANTER**. Aceitos só pela definição auditada exata; detalhes em [08-deploy-producao.md](08-deploy-producao.md#objetos-de-plataforma-não-são-migrations-da-mel).
