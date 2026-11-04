#!/usr/bin/env bash
# Backup completo da MEL (banco + Auth + arquivos do Storage), criptografado com age.
#
# Entrada (variáveis de ambiente; nunca impressas):
#   DB_URL                 conexão Postgres do projeto (com senha, percent-encoded)
#   SUPABASE_URL           URL da API do projeto
#   SUPABASE_SECRET_KEY    chave secreta (lê o Storage)
#   BACKUP_AGE_RECIPIENT   chave PÚBLICA age (age1…); a privada fica fora daqui
#   BACKUP_OUT             pasta de saída
# Saída: $BACKUP_OUT/mel-backup-<data>.tar.gz.age e um .sha256 ao lado.
# Requer: docker, node, npx supabase, age.
#
# O que vai no arquivo:
#   data.sql      dados de public, auth (contas, identidades, sessões) e demais
#                 schemas do Supabase que o CLI inclui; sem o que as migrations já
#                 criam (buckets, planos) e sem storage.objects (vem com os arquivos)
#   schema.sql    schema atual (referência/perícia: a restauração usa as migrations)
#   migrations.txt versões aplicadas (a restauração exige as mesmas)
#   counts.csv    linhas por tabela (conferência depois de restaurar)
#   objects.csv   dono e data de cada arquivo (storage.objects)
#   source-url.txt URL do projeto (avatar_url guarda a URL completa)
#   storage/      os arquivos, nos mesmos caminhos, + files.json com sha256
# Logs: só totais, tamanhos e tempos. Nada de dados, caminhos ou segredos.
set -euo pipefail
umask 077
: "${DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SECRET_KEY:?}" "${BACKUP_AGE_RECIPIENT:?}" "${BACKUP_OUT:?}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
START=$SECONDS

# psql 17 num container (o banco é Postgres 17); a conexão vai por variável.
psql_() { docker run --rm -i --network host -e DB_URL -v "$WORK:/w" postgres:17 sh -c 'psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q "$@"' psql "$@"; }

echo "[backup] dados (pg_dump via Supabase CLI)"
npx supabase db dump --db-url "$DB_URL" --data-only --use-copy \
  -x storage.objects -x storage.buckets -x storage.buckets_vectors -x storage.vector_indexes -x storage.migrations \
  -x public.plans -x auth.schema_migrations -x supabase_migrations.schema_migrations -x supabase_migrations.seed_files \
  -f "$WORK/data.sql" >/dev/null
echo "[backup] schema (referência)"
npx supabase db dump --db-url "$DB_URL" -f "$WORK/schema.sql" >/dev/null

printf %s "$SUPABASE_URL" > "$WORK/source-url.txt"
psql_ -At -c "select version from supabase_migrations.schema_migrations order by version" > "$WORK/migrations.txt"
psql_ -At -F, -f - > "$WORK/counts.csv" < "$HERE/counts.sql"
psql_ -c "\copy (select bucket_id, name, owner, owner_id, created_at, updated_at from storage.objects order by bucket_id, name) to '/w/objects.csv' csv"

echo "[backup] arquivos do Storage"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" node "$HERE/storage.mjs" export "$WORK/storage"

mkdir -p "$BACKUP_OUT"
OUT="$BACKUP_OUT/mel-backup-$STAMP.tar.gz.age"
tar -C "$WORK" -czf - . | age -r "$BACKUP_AGE_RECIPIENT" -o "$OUT"
( cd "$BACKUP_OUT" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )
echo "[backup] ok: $(basename "$OUT") ($(stat -c %s "$OUT") bytes), $(wc -l < "$WORK/migrations.txt") migrations, $(wc -l < "$WORK/counts.csv") tabelas, $((SECONDS - START)) s"
