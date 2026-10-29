import { type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/session";
import { dispatchPushQueue } from "@/lib/push/dispatch";

/**
 * Processa a fila de push. Chamado logo após ações que geram avisos (alerta
 * ativado) e, em produção, também por um agendador com
 * `Authorization: Bearer $PUSH_DISPATCH_SECRET`. Só envia o que o banco já
 * decidiu enviar (destinatários e antispam ficam no banco).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  const bearer = request.headers.get("authorization") === `Bearer ${secret}` && Boolean(secret);
  if (!bearer && !(await getSessionUser())) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const result = await dispatchPushQueue();
    return Response.json(result, { status: result.disabled ? 503 : 200 });
  } catch (err) {
    console.error("[api/push/dispatch] falhou", err);
    return Response.json({ error: "Não foi possível processar os avisos agora." }, { status: 500 });
  }
}
