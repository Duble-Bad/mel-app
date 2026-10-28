# MEL — Schema inicial do banco (PostgreSQL + PostGIS)

Convenções: `id uuid primary key default gen_random_uuid()`, `created_at`/`updated_at timestamptz default now()` (trigger `set_updated_at`), soft delete via `deleted_at` onde há moderação. Localização em `geography(Point, 4326)`. Extensões: `postgis`, `pg_trgm`, `pg_cron`, `vector` (reservada).

## 1. Enums

```
species            : dog | cat | other
pet_sex            : male | female | unknown
pet_size           : mini | small | medium | large | giant
lost_case_status   : DRAFT | ACTIVE | FOUND | CLOSED | REMOVED
found_case_status  : ACTIVE | REUNITED | CLOSED | REMOVED
found_custody      : with_me | safe_place | clinic | still_on_street | other
sighting_direction : N | S | E | W | NE | NW | SE | SW | unknown
sighting_state     : walking | running | stopped | with_person | injured | scared | other
adoption_status    : AVAILABLE | IN_PROCESS | ADOPTED | REMOVED
application_status : SENT | IN_REVIEW | APPROVED | DECLINED | WITHDRAWN
user_role          : user | moderator | admin
match_status       : SUGGESTED | VIEWED | CONFIRMED | DISMISSED
report_target      : user | lost_case | found_case | sighting | adoption | message | business
report_status      : OPEN | REVIEWING | ACTIONED | DISMISSED
business_category  : pet_shop | vet | clinic | hospital | grooming | hotel | daycare | trainer | photographer | other
```

## 2. Tabelas

### Identidade
| Tabela | Colunas principais | Notas |
|---|---|---|
| **profiles** | id (=auth.users.id), display_name, avatar_url, city, state, role, is_anonymous, phone_private, whatsapp_private, suspended_at | Telefone **nunca** público direto |
| **consents** | id, user_id→profiles, kind, version, granted_at, revoked_at | LGPD |
| **blocks** | blocker_id, blocked_id, created_at (PK composta) | |

### Pets
| Tabela | Colunas principais | Notas |
|---|---|---|
| **pets** | id, owner_id→profiles, **mel_id** (text único, ex. `MEL-7K3Q9`), slug, name, species, breed, sex, birth_date, age_estimate_months, size, weight_kg, color_primary, colors_secondary text[], description, unique_marks, neutered, has_microchip, city, state, is_public | |
| **pet_private_details** | pet_id (PK)→pets, microchip_number, ownership_notes, hidden_marks | **RLS: só o dono**. Separado para não vazar por `select *` |
| **pet_photos** | id, pet_id, storage_path, is_primary, position, width, height | |

### Casos
| Tabela | Colunas principais | Notas |
|---|---|---|
| **lost_cases** | id, short_code (ex. `abc123`), pet_id→pets, owner_id, status, last_seen_point (geography, **privado**), public_point (geography, aproximado), public_point_exact bool, last_seen_address_label, lost_at, lost_at_uncertain bool, wearing (collar/clothes/harness), notes, contact_chat bool, contact_whatsapp_public bool, contact_phone_public bool, indexable bool, found_at, found_point, found_how, helpful_sighting_id, reunion_story, published_at | |
| **found_cases** | id, short_code, reporter_id, status, species, breed_guess, color_primary, colors_secondary, size, sex, description, point (privado), public_point, found_at, custody, custody_notes, **verification_hint** (privado — prova de posse do lado de quem achou), photo_paths text[] | |
| **sightings** | id, lost_case_id (nullable — avistamento solto permitido), reporter_id (nullable p/ legado, normalmente anônimo), point, seen_at, direction, state, notes, photo_path, status (VISIBLE/HIDDEN), species/color/size (quando solto) | |
| **case_matches** | id, lost_case_id, found_case_id (nullable), sighting_id (nullable), score smallint, reasons jsonb, algorithm_version, status, created_at | check: exatamente um de found/sighting |
| **case_timeline_v** (view) | union de lost (último visto), sightings, fotos, found → ordenada por tempo | Alimenta timeline e caminho no mapa |
| **poster_assets** | id, lost_case_id, format (a4/square/story/landscape/whatsapp), storage_path, generated_at | cache |

### Adoção / ONGs / Negócios
| Tabela | Colunas principais |
|---|---|
| **organizations** | id, name, slug, logo_url, description, city, state, contact_email, socials jsonb, verified_at, verified_by |
| **organization_members** | org_id, user_id, role (owner/member) |
| **adoption_listings** | id, pet_id→pets, publisher_id, organization_id (nullable), status, story, personality, vaccines, neutered, special_needs, good_with_kids/dogs/cats (yes/no/unknown), public_point, moderation_status |
| **adoption_applications** | id, listing_id, applicant_id, status, answers jsonb, message, created_at — **unique(listing_id, applicant_id)** |
| **businesses** | id, owner_id, name, slug, category, description, logo_url, phone, whatsapp, website, approved_at |
| **business_locations** | id, business_id, address_label, point, opening_hours jsonb |
| **business_offers** | id, business_id, title, description, starts_at, ends_at, is_sponsored |
| **campaigns** | id, business_id, name, placement, starts_at, ends_at, budget_cents (nullable), status |
| **plans** | id, code (FREE/LOCAL/PRO/PREMIUM), name, features jsonb, price_cents (nullable), active |
| **subscriptions** | id, business_id, plan_id, status, provider, provider_ref, current_period_end |

### Comunicação
| Tabela | Colunas principais |
|---|---|
| **conversations** | id, lost_case_id (found_case_id / adoption_listing_id virão no M10/M14), owner_id, helper_id, sighting_id (origem opcional), created_by, created_at, last_message_at, owner_last_read_at, helper_last_read_at — conversa de 2 pessoas, única por (caso, quem ajuda) |
| **messages** | id, conversation_id, sender_id, body (≤2000), image_path (futuro), created_at, hidden_at |
| **notifications** | id, user_id, kind, payload jsonb, read_at, created_at |
| **notification_preferences** | user_id (PK), email bool, push bool, quiet_hours int4range, max_alerts_per_day |
| **guardian_settings** | user_id (PK), enabled, area_point (aproximado), radius_m (1000/3000/5000/10000), alert_lost, alert_sightings, alert_found |
| **push_subscriptions** | id, user_id, endpoint, keys jsonb, user_agent |

### Confiança / Operação
| Tabela | Colunas principais |
|---|---|
| **reports** | id, reporter_id, target_type, target_id, reason, details, status, handled_by |
| **moderation_actions** | id, moderator_id, target_type, target_id, action (hide/remove/suspend/restore), reason, report_id |
| **audit_logs** | id, actor_id, action, entity, entity_id, diff jsonb, ip_hash, created_at — **insert-only** |
| **rate_limits** | key (user/ip + ação), window_start, count |
| **job_queue** | id, kind, payload, run_after, attempts, done_at |
| **events** | id, name, user_id (nullable), session_id, props jsonb (sem PII), city, created_at |

## 3. Índices

- GiST: `lost_cases(public_point)`, `lost_cases(last_seen_point)`, `found_cases(point)`, `sightings(point)`, `guardian_settings(area_point)`, `business_locations(point)`, `adoption_listings(public_point)`.
- B-tree: `lost_cases(status, lost_at desc)`, `found_cases(status, found_at desc)`, `sightings(lost_case_id, seen_at)`, `case_matches(lost_case_id, score desc)`, `messages(conversation_id, created_at)`, `notifications(user_id, read_at, created_at desc)`, `reports(status, created_at)`, `events(name, created_at)`.
- Únicos: `pets(mel_id)`, `pets(slug)`, `lost_cases(short_code)`, `found_cases(short_code)`.
- Trigram: `pets(breed)` para busca/matching fuzzy.
- Parcial: `lost_cases(public_point) where status = 'ACTIVE'`.

## 4. RLS (resumo)

| Tabela | SELECT | INSERT | UPDATE / DELETE |
|---|---|---|---|
| profiles | próprio; demais via view `public_profiles_v` (nome, avatar, cidade) | trigger | próprio (sem mudar `role`) / admin |
| pets | público se `is_public`; dono sempre | autenticado não-anônimo, `owner_id = auth.uid()` | dono |
| pet_private_details | **somente dono** | dono | dono |
| lost_cases | público via `public_lost_cases_v` se status ∈ (ACTIVE, FOUND); tabela base: dono + admin | dono do pet | dono (status), admin |
| found_cases | público via view (sem `point`, sem `verification_hint`); base: reporter + admin | autenticado (inclui anônimo) + rate limit | reporter, admin |
| sightings | público se `status = VISIBLE` e caso público | autenticado (inclui anônimo) + rate limit | reporter; dono do caso pode ocultar |
| case_matches | dono do lost_case e reporter do found_case | só service role | partes (status VIEWED/DISMISSED) |
| conversations / messages | só membros (e não bloqueados) | membro | remetente oculta a própria; admin |
| notifications | próprio | service role | próprio (`read_at`) |
| guardian_settings / prefs / push | próprio | próprio | próprio |
| adoption_listings | público se AVAILABLE/IN_PROCESS e aprovado | não-anônimo | publisher / membro da ORG / admin |
| adoption_applications | candidato e publisher | não-anônimo | candidato (withdraw), publisher (status) |
| businesses / locations / offers | público se `approved_at` não nulo | não-anônimo | owner / admin |
| reports | próprio reporter; admin todos | autenticado | admin |
| moderation_actions / audit_logs | admin | via funções `security definer` | **ninguém** (audit insert-only) |
| plans | público | admin | admin |
| subscriptions | owner do business, admin | service role | service role |
| events | ninguém (só admin agregado) | via função `track_event` | — |

## 5. Funções / triggers chave

- `handle_new_user()` → cria `profiles`.
- `generate_mel_id()`, `generate_short_code()`.
- `fuzz_point(geography, meters)` → snap em grade para `public_point`.
- `on_lost_case_activated` → `job_queue(notify_guardians)`, `job_queue(run_matching)`.
- `on_found_case_created` / `on_sighting_created` → `job_queue(run_matching)`; sighting gera `notifications` para o dono.
- `compute_match_score(...)`, `nearby_cases(lat, lng, radius_m, kinds[], species[], since)` (RPC para o mapa).
- `check_rate_limit(action, limit, window)`.
- `admin_*` (suspender, ocultar…) gravam `moderation_actions` + `audit_logs` numa transação.
