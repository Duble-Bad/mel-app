#!/usr/bin/env bash
# Restaura um backup da MEL (backup.sh) num projeto NOVO e VAZIO.
#
# Pré-requisito: no destino, as migrations versionadas já aplicadas (as mesmas
# do backup) e nenhum dado (nenhuma conta). Nunca restaura por cima de banco em uso.
#
# Entrada (variáveis de ambiente; nunca impressas):
#   DB_URL, SUPABASE_URL, SUPABASE_SECRET_KEY   do projeto DE DESTINO
#   BACKUP_FILE            o .tar.gz.age
#   BACKUP_AGE_IDENTITY    arquivo com a chave PRIVADA age
# Requer: docker, node, npx supabase, age.
set -euo pipefail
umask 077
: "${DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SECRET_KEY:?}" "${BACKUP_FILE:?}" "${BACKUP_AGE_IDENTITY:?}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
START=$SECONDS

psql_() { docker run --rm -i --network host -e DB_URL -v "$WORK:/w" postgres:17 sh -c 'psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q "$@"' psql "$@"; }

if [ -f "$BACKUP_FILE.sha256" ]; then
  ( cd "$(dirname "$BACKUP_FILE")" && sha256sum -c --quiet "$(basename "$BACKUP_FILE").sha256" )
fi
echo "[restore] descriptografando"
age -d -i "$BACKUP_AGE_IDENTITY" "$BACKUP_FILE" | tar -C "$WORK" -xzf -

echo "[restore] conferindo o destino"
psql_ -At -c "select version from supabase_migrations.schema_migrations order by version" > "$WORK/target-migrations.txt"
if ! cmp -s "$WORK/migrations.txt" "$WORK/target-migrations.txt"; then
  echo "[restore] ABORTADO: as migrations do destino não são as do backup ($(wc -l < "$WORK/target-migrations.txt") × $(wc -l < "$WORK/migrations.txt"))." >&2
  exit 1
fi
USERS="$(psql_ -At -c "select count(*) from auth.users")"
if [ "$USERS" != "0" ]; then
  echo "[restore] ABORTADO: o destino já tem contas ($USERS). Restaure só num projeto novo e vazio." >&2
  exit 1
fi

echo "[restore] dados (uma transação; gatilhos desligados durante a carga)"
psql_ --single-transaction -c "set session_replication_role = replica" -f /w/data.sql >/dev/null

# avatar_url guarda a URL completa do projeto: num projeto novo, aponta para o novo.
SOURCE_URL="$(cat "$WORK/source-url.txt")"
if [ "$SOURCE_URL" != "$SUPABASE_URL" ]; then
  MOVED="$(psql_ -At -v old="$SOURCE_URL/storage/v1/object/public/avatars/" -v new="$SUPABASE_URL/storage/v1/object/public/avatars/" <<'SQL'
with u as (
  update public.profiles set avatar_url = :'new' || substr(avatar_url, length(:'old') + 1)
   where starts_with(avatar_url, :'old')
  returning 1)
select count(*) from u;
SQL
)"
  echo "[restore] avatares apontados para o projeto novo: $MOVED"
fi

echo "[restore] arquivos do Storage"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" node "$HERE/storage.mjs" import "$WORK/storage"

echo "[restore] dono e data originais de cada arquivo (posse do sighting-media, faxina de órfãs)"
UPDATED="$(psql_ -At <<'SQL'
create temp table b (bucket_id text, name text, owner uuid, owner_id text, created_at timestamptz, updated_at timestamptz);
\copy b from '/w/objects.csv' csv
with u as (
  update storage.objects o
     set owner = b.owner, owner_id = b.owner_id, created_at = b.created_at, updated_at = b.updated_at
    from b where o.bucket_id = b.bucket_id and o.name = b.name
  returning 1)
select count(*) from u;
SQL
)"
EXPECTED="$(wc -l < "$WORK/objects.csv")"
echo "[restore] arquivos com dono/data restaurados: $UPDATED/$EXPECTED"
[ "$UPDATED" = "$EXPECTED" ] || { echo "[restore] FALHA: nem todo arquivo voltou com o dono original" >&2; exit 1; }

echo "[restore] conferindo linhas por tabela"
psql_ -At -F, -f - > "$WORK/target-counts.csv" < "$HERE/counts.sql"
if ! diff "$WORK/counts.csv" "$WORK/target-counts.csv" > "$WORK/counts.diff"; then
  echo "[restore] FALHA: contagens diferentes (tabela,linhas):" >&2
  cat "$WORK/counts.diff" >&2
  exit 1
fi
echo "[restore] $(wc -l < "$WORK/counts.csv") tabelas com as mesmas contagens"

echo "[restore] referências do banco × arquivos"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" node "$HERE/storage.mjs" check
echo "[restore] ok em $((SECONDS - START)) s"
