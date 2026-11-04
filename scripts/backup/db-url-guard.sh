# Conferências da conexão antes de qualquer acesso (incluído por backup.sh e restore.sh).
# - Supabase hospedado: o banco direto só tem IPv6 e o runner do GitHub não; use o
#   Session pooler (porta 5432). O Transaction pooler (6543) não serve para pg_dump.
# - Fora da máquina local, TLS obrigatório: sslmode=require (ou verify-full).
check_db_url() {
  local url="$1" host
  host="$(printf %s "$url" | sed -E 's#^[a-z]+://([^@]*@)?([^:/?]+).*#\2#')"
  if printf %s "$url" | grep -qE ':6543(/|\?|$)'; then
    echo "[conexão] ABORTADO: porta 6543 é o Transaction pooler; use o Session pooler (porta 5432)." >&2
    return 1
  fi
  case "$host" in
    127.0.0.1|localhost|host.docker.internal) return 0 ;;
  esac
  if ! printf %s "$url" | grep -qE '[?&]sslmode=(require|verify-ca|verify-full)(&|$)'; then
    echo "[conexão] ABORTADO: conexão remota sem TLS obrigatório; acrescente ?sslmode=require à DB_URL." >&2
    return 1
  fi
  case "$host" in
    db.*.supabase.co) echo "[conexão] aviso: host direto do Supabase (só IPv6); no GitHub Actions use o Session pooler." >&2 ;;
  esac
}
