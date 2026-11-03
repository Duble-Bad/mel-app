/**
 * Verificação do token do Cloudflare Turnstile (siteverify). Função pura: o
 * servidor do app passa o segredo; os testes passam um `fetch` simulado.
 * Qualquer coisa diferente de `success: true` reprova — token ausente,
 * inválido (`invalid-input-response`), expirado ou já usado
 * (`timeout-or-duplicate`), segredo errado ou falha de rede.
 */
export interface TurnstileVerdict {
  ok: boolean;
  /** Códigos de erro do Cloudflare (ou "missing-input-response"/"network-error"), para log. */
  codes: string[];
}

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(input: {
  secret: string;
  token: string | null | undefined;
  remoteIp?: string | null;
  fetch?: typeof fetch;
}): Promise<TurnstileVerdict> {
  if (!input.token) return { ok: false, codes: ["missing-input-response"] };
  const body = new URLSearchParams({ secret: input.secret, response: input.token });
  if (input.remoteIp) body.set("remoteip", input.remoteIp);
  try {
    const res = await (input.fetch ?? fetch)(TURNSTILE_VERIFY_URL, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return { ok: data.success === true, codes: data["error-codes"] ?? [] };
  } catch {
    return { ok: false, codes: ["network-error"] };
  }
}
