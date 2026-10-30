import { type NextRequest } from "next/server";
import { messageBodySchema } from "@mel/core";
import { DataError, startConversation } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

/**
 * "Conversar com o tutor". Quem está sem cadastro (sessão anônima) passa pelo
 * captcha; a conversa é criada com a sessão da própria pessoa, então as regras
 * do banco (bloqueio, limites, alerta ativo) valem.
 */
export async function POST(request: NextRequest) {
  let body: { code?: unknown; body?: unknown; turnstileToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Não entendemos o envio. Tente de novo." });
  }
  const code = typeof body.code === "string" && /^[a-z2-9]{6}$/i.test(body.code) ? body.code : null;
  if (!code) return json(422, { error: "Alerta inválido." });
  const message = messageBodySchema.safeParse(body.body);
  if (!message.success) return json(422, { error: message.error.issues[0]?.message ?? "Escreva uma mensagem." });

  const user = await getSessionUser();
  if (!user) return json(401, { error: "Sua sessão expirou. Recarregue a página e envie de novo." });
  if (user.isAnonymous) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const token = typeof body.turnstileToken === "string" ? body.turnstileToken : undefined;
    if (!(await verifyTurnstile(token, ip))) {
      return json(403, { error: "Não conseguimos confirmar que você não é um robô. Tente enviar de novo." });
    }
  }

  try {
    const id = await startConversation(await createSessionClient(), code, message.data);
    return json(201, { id });
  } catch (err) {
    if (err instanceof DataError && err.code === "P0429") {
      // Sem conteúdo nem IP: só que um limite foi atingido (calibrar limites).
      console.warn("[api/conversas] limite atingido", { user: user.id });
      return json(429, { error: err.message });
    }
    if (err instanceof DataError && (err.code === "22023" || err.code === "42501")) return json(422, { error: err.message });
    console.error("[api/conversas] falhou", err);
    return json(500, { error: "Não conseguimos enviar agora. Verifique a conexão e tente de novo." });
  }
}
