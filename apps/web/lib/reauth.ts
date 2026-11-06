import "server-only";
import { isRecentAuth, lastStrongAuthAt, REAUTH_MAX_AGE_S } from "@mel/core";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Login recente da sessão desta requisição (claim amr do JWT VERIFICADO por
 * getClaims). Mudanças sensíveis (CPF, CNPJ, telefones, e-mail) só passam com
 * login nos últimos 10 minutos; o banco confere a mesma regra
 * (private.has_recent_auth) nas tabelas e RPCs que alteram esses dados.
 */
export async function getAuthFreshness(): Promise<{ recent: boolean; lastAuthAt: number | null; maxAgeS: number }> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims as { amr?: unknown } | undefined)?.amr;
  return { recent: isRecentAuth(amr), lastAuthAt: lastStrongAuthAt(amr), maxAgeS: REAUTH_MAX_AGE_S };
}
