#!/usr/bin/env bash
# Backup da MEL (banco + Auth + arquivos do Storage) num repositório incremental,
# criptografado com age. Ver incremental.mjs (estrutura) e docs/14-backup-restauracao.md.
#
# Entrada (variáveis de ambiente; nunca impressas):
#   DB_URL                 conexão Postgres (Session pooler, porta 5432, ?sslmode=require)
#   SUPABASE_URL           URL da API do projeto
#   SUPABASE_SECRET_KEY    chave secreta (lê o Storage)
#   BACKUP_AGE_RECIPIENT   chave PÚBLICA age (age1…); a privada fica fora daqui
#   BACKUP_REPO            destino do rclone (pasta local ou bucket, ex.: r2:mel-backup)
# Requer: docker, node, npx supabase, age, rclone.
#
# Ordem (consistência): 1) dump do banco; 2) lista e envia os arquivos; 3) dono e data
# dos arquivos; 4) sela o ponto. Tudo que o dump referencia já existia em 1 e é
# listado em 2, a não ser que tenha sido apagado nesses segundos; arquivo novo entre 1
# e 2 fica sem referência (órfão, que a faxina apaga). O ponto só vale com o .ok,
# escrito por último: backup interrompido nunca aparece como completo.
set -euo pipefail
umask 077
: "${DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SECRET_KEY:?}" "${BACKUP_AGE_RECIPIENT:?}" "${BACKUP_REPO:?}"
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/db-url-guard.sh"
check_db_url "$DB_URL"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
START=$SECONDS

# psql 17 num container (o banco é Postgres 17); a conexão vai por variável.
psql_() { docker run --rm -i --network host -e DB_URL -v "$WORK:/w" postgres:17 sh -c 'psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q "$@"' psql "$@"; }

echo "[backup] 1/4 banco (pg_dump via Supabase CLI)"
npx supabase db dump --db-url "$DB_URL" --data-only --use-copy \
  -x storage.objects -x storage.buckets -x storage.buckets_vectors -x storage.vector_indexes -x storage.migrations \
  -x public.plans -x auth.schema_migrations -x supabase_migrations.schema_migrations -x supabase_migrations.seed_files \
  -f "$WORK/data.sql" >/dev/null
npx supabase db dump --db-url "$DB_URL" -f "$WORK/schema.sql" >/dev/null
printf %s "$SUPABASE_URL" > "$WORK/source-url.txt"
node "$HERE/dump-inspect.mjs" "$WORK/data.sql" "$WORK" "$SUPABASE_URL"
psql_ -At -c "select version from supabase_migrations.schema_migrations order by version" > "$WORK/migrations.txt"

echo "[backup] 2/4 arquivos do Storage (só os novos ou alterados)"
node "$HERE/incremental.mjs" store-files "$WORK"

echo "[backup] 3/4 dono e data de cada arquivo"
psql_ -c "\copy (select bucket_id, name, owner, owner_id, created_at, updated_at from storage.objects order by bucket_id, name) to '/w/objects.csv' csv"

echo "[backup] 4/4 selando o ponto"
node "$HERE/incremental.mjs" seal "$WORK" "$STAMP"
echo "[backup] ok: ponto $STAMP, $(wc -l < "$WORK/migrations.txt") migrations, $(wc -l < "$WORK/dump-counts.csv") tabelas, $((SECONDS - START)) s"
