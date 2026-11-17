import "server-only";
import { fetchWithTimeout, verifyTurnstileToken } from "@mel/core";

/** Verifica o token do Cloudflare Turnstile no servidor (nunca confiar no navegador). */
export async function verifyTurnstile(token: string | undefined, remoteIp?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY ausente: envios bloqueados até configurar.");
    return false;
  }
  // Tempo limite SEM nova tentativa: o token do captcha só vale uma vez. Sem resposta, reprova.
  const verdict = await verifyTurnstileToken({ secret, token, remoteIp, fetch: fetchWithTimeout(5_000) });
  // Só os códigos do Cloudflare (sem token nem IP): ajuda a separar robô de token expirado.
  if (!verdict.ok && token) console.warn("[turnstile] reprovado", { codes: verdict.codes });
  return verdict.ok;
}
