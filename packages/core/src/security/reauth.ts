// Confirmação recente de identidade para mudanças sensíveis (CPF, CNPJ,
// telefones, e-mail). Usa o claim "amr" do JWT do Supabase: lista de métodos
// de login com o horário (segundos) em que cada um aconteceu. Renovar o token
// mantém o horário original, então só um login novo (senha de novo, Google de
// novo, link do e-mail) conta como recente. O banco aplica a mesma regra em
// private.has_recent_auth (até 10 min).

export const REAUTH_MAX_AGE_S = 600;

/** Métodos que NÃO provam quem é a pessoa. */
const WEAK_METHODS = new Set(["", "anonymous", "token_refresh"]);

/** Horário (segundos) do login mais recente que prova a identidade, ou null. */
export function lastStrongAuthAt(amr: unknown): number | null {
  if (!Array.isArray(amr)) return null;
  let best: number | null = null;
  for (const e of amr) {
    if (!e || typeof e !== "object") continue;
    const { method, timestamp } = e as { method?: unknown; timestamp?: unknown };
    if (typeof method !== "string" || WEAK_METHODS.has(method)) continue;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) continue;
    if (best === null || timestamp > best) best = timestamp;
  }
  return best;
}

export function isRecentAuth(amr: unknown, nowS = Math.floor(Date.now() / 1000), maxAgeS = REAUTH_MAX_AGE_S): boolean {
  const at = lastStrongAuthAt(amr);
  return at !== null && at >= nowS - maxAgeS && at <= nowS + 60;
}

export const REAUTH_REQUIRED_MESSAGE = "Para alterar este dado, confirme sua identidade de novo.";
