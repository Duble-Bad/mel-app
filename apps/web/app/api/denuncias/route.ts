import { type NextRequest } from "next/server";
import { REPORTABLE, type ReportableTarget, reportSchema } from "@mel/core";
import { DataError, reportContent } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

/**
 * "Denunciar" em conteúdo público. Quem está sem cadastro (sessão anônima)
 * passa pelo captcha; a denúncia é gravada com a sessão da própria pessoa, então
 * as regras do banco (não duplica, agrupa anônimas, limite por hora) valem.
 */
export async function POST(request: NextRequest) {
  let body: { type?: unknown; key?: unknown; reason?: unknown; details?: unknown; turnstileToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Não entendemos o envio. Tente de novo." });
  }
  const type = REPORTABLE.includes(body.type as ReportableTarget) ? (body.type as ReportableTarget) : null;
  const key = typeof body.key === "string" && body.key.length > 0 && body.key.length <= 64 ? body.key : null;
  if (!type || !key) return json(422, { error: "Conteúdo inválido." });
  const parsed = reportSchema.pick({ reason: true, details: true }).safeParse({ reason: body.reason, details: body.details ?? null });
  if (!parsed.success) return json(422, { error: parsed.error.issues[0]?.message ?? "Escolha o motivo da denúncia." });

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
    const id = await reportContent(await createSessionClient(), { type, key }, parsed.data);
    return json(201, { id });
  } catch (err) {
    if (err instanceof DataError && err.code === "P0429") {
      console.warn("[api/denuncias] limite atingido", { user: user.id });
      return json(429, { error: err.message });
    }
    if (err instanceof DataError && (err.code === "22023" || err.code === "42501")) return json(422, { error: err.message });
    console.error("[api/denuncias] falhou", err);
    return json(500, { error: "Não conseguimos enviar agora. Verifique a conexão e tente de novo." });
  }
}
