#!/usr/bin/env bash
# Restaura um ponto do repositório de backups da MEL num projeto NOVO e VAZIO.
#
# Pré-requisito: no destino, as migrations versionadas já aplicadas (as mesmas
# do backup) e nenhum dado (nenhuma conta). Nunca restaura por cima de banco em uso.
#
# Entrada (variáveis de ambiente; nunca impressas):
#   DB_URL, SUPABASE_URL, SUPABASE_SECRET_KEY   do projeto DE DESTINO
#   RESTORE_CONFIRM        o host de SUPABASE_URL, digitado: confirmação explícita do destino
#   BACKUP_REPO            repositório (rclone)
#   BACKUP_POINT           data do ponto (padrão: o mais recente completo)
#   BACKUP_AGE_IDENTITY    arquivo com a chave PRIVADA age
# Requer: docker, node, npx supabase, age, rclone.
set -euo pipefail
umask 077
: "${DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SECRET_KEY:?}" "${BACKUP_REPO:?}" "${BACKUP_AGE_IDENTITY:?}"
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/db-url-guard.sh"
check_db_url "$DB_URL"
TARGET_HOST="$(printf %s "$SUPABASE_URL" | sed -E 's#^[a-z]+://([^/:]+).*#\1#')"
if [ "${RESTORE_CONFIRM:-}" != "$TARGET_HOST" ]; then
  echo "[restore] ABORTADO: confirme o destino com RESTORE_CONFIRM=<host da SUPABASE_URL>." >&2
  exit 1
fi
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
START=$SECONDS

psql_() { docker run --rm -i --network host -e DB_URL -v "$WORK:/w" postgres:17 sh -c 'psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q "$@"' psql "$@"; }

echo "[restore] abrindo e conferindo o ponto (antes de tocar no destino)"
node "$HERE/incremental.mjs" fetch "${BACKUP_POINT:-latest}" "$WORK"

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

echo "[restore] dono e data originais de cada arquivo"
RESULT="$(psql_ -At -F' ' <<'SQL'
create temp table b (bucket_id text, name text, owner uuid, owner_id text, created_at timestamptz, updated_at timestamptz);
\copy b from '/w/objects.csv' csv
update storage.objects o
   set owner = b.owner, owner_id = b.owner_id, created_at = b.created_at, updated_at = b.updated_at
  from b where o.bucket_id = b.bucket_id and o.name = b.name;
-- arquivos restaurados; com dono diferente do original; sem registro de dono (enviado entre o dump e a listagem)
select (select count(*) from storage.objects),
       (select count(*) from storage.objects o join b using (bucket_id, name) where o.owner_id is distinct from b.owner_id),
       (select count(*) from storage.objects o where not exists (select 1 from b where b.bucket_id = o.bucket_id and b.name = o.name));
SQL
)"
read -r TOTAL WRONG NOREC <<< "$RESULT"
FILES="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)' "$WORK/storage/files.json")"
echo "[restore] arquivos: $TOTAL no destino, $FILES no ponto, $WRONG com dono diferente, $NOREC sem registro de dono"
[ "$TOTAL" = "$FILES" ] && [ "$WRONG" = "0" ] || { echo "[restore] FALHA: arquivos ou donos não conferem" >&2; exit 1; }

echo "[restore] conferindo linhas por tabela (contagem do próprio dump)"
psql_ -At -F, -f - < "$HERE/counts.sql" > "$WORK/target-counts.csv"
MISMATCH=0
COMPARED=0
while IFS=, read -r table rows; do
  got="$(awk -F, -v t="$table" '$1 == t { print $2 }' "$WORK/target-counts.csv")"
  # Escopo: o de counts.sql (public, auth, storage, sem tabelas internas que mudam sozinhas).
  [ -n "$got" ] || continue
  COMPARED=$((COMPARED + 1))
  if [ "$got" != "$rows" ]; then echo "[restore] diferente: $table (ponto $rows, destino ${got:-ausente})" >&2; MISMATCH=1; fi
done < "$WORK/dump-counts.csv"
[ "$MISMATCH" = "0" ] || { echo "[restore] FALHA: contagens diferentes" >&2; exit 1; }
echo "[restore] $COMPARED tabelas com as mesmas contagens do dump"

echo "[restore] referências do banco × arquivos"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" node "$HERE/storage.mjs" check
echo "[restore] ok: ponto $(cat "$WORK/point.txt") em $((SECONDS - START)) s"
