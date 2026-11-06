import { type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/origin";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store, private" } });

/**
 * Confirmar a identidade com a SENHA antes de uma mudança sensível. O login
 * acontece aqui, no servidor, com o e-mail da PRÓPRIA sessão (o navegador não
 * precisa conhecer o e-mail completo nem pode escolher outra conta): a sessão
 * nova traz um claim amr com horário atual, que libera as mudanças por 10 min.
 * Contas Google confirmam pelo Google (signInWithOAuth no navegador).
 * A senha nunca é registrada em log.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json(403, { error: "Origem não permitida." });
  if (!request.headers.get("content-type")?.includes("application/json")) return json(415, { error: "Formato inválido." });

  const user = await getSessionUser();
  if (!user || user.isAnonymous) return json(401, { error: "Entre na sua conta." });
  const body = (await request.json().catch(() => null)) as { senha?: unknown; captchaToken?: unknown } | null;
  const password = typeof body?.senha === "string" ? body.senha : "";
  if (!password || password.length > 200) return json(422, { error: "Digite sua senha.", fields: { senha: "Digite sua senha." } });
  const captchaToken = typeof body?.captchaToken === "string" && body.captchaToken.length <= 4096 ? body.captchaToken : undefined;

  const supabase = await createSessionClient();
  const { data: current } = await supabase.auth.getUser();
  const email = current.user?.email;
  if (!email || current.user?.id !== user.id) return json(401, { error: "Entre na sua conta." });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined });
  if (error || data.user?.id !== user.id) {
    if (error?.status === 429) return json(429, { error: "Muitas tentativas. Espere alguns minutos e tente de novo." });
    if (error?.code === "captcha_failed") return json(400, { error: "Não conseguimos confirmar que você não é um robô. Tente de novo.", captcha: true });
    return json(401, { error: "Senha incorreta.", fields: { senha: "Senha incorreta." } });
  }
  return json(200, { ok: true });
}
