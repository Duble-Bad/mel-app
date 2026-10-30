import { type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/session";
import { purgeOrphanSightingMedia } from "@mel/data";
import { dispatchPushQueue } from "@/lib/push/dispatch";
import { createServiceClient } from "@/lib/supabase/service";

/** Apaga fotos órfãs antigas do sighting-media. Falha aqui não impede o push. */
async function cleanOrphanMedia() {
  const service = createServiceClient();
  if (!service) return;
  try {
    const removed = await purgeOrphanSightingMedia(service);
    if (removed) console.info("[manutenção] fotos órfãs apagadas", { removed });
  } catch (err) {
    console.error("[manutenção] limpeza de fotos órfãs falhou", err);
  }
}

/**
 * Processa a fila de push. Chamado logo após ações que geram avisos (alerta
 * ativado) e, em produção, também por um agendador com
 * `Authorization: Bearer $PUSH_DISPATCH_SECRET`. Só envia o que o banco já
 * decidiu enviar (destinatários e antispam ficam no banco). Na chamada do
 * agendador, também apaga fotos órfãs antigas do sighting-media.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  const bearer = request.headers.get("authorization") === `Bearer ${secret}` && Boolean(secret);
  if (!bearer && !(await getSessionUser())) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    // Só o agendador (segredo) faz a faxina; quem chama logado só dispara o push.
    if (bearer) await cleanOrphanMedia();
    const result = await dispatchPushQueue();
    return Response.json(result, { status: result.disabled ? 503 : 200 });
  } catch (err) {
    console.error("[api/push/dispatch] falhou", err);
    return Response.json({ error: "Não foi possível processar os avisos agora." }, { status: 500 });
  }
}
