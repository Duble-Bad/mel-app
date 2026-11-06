import { type NextRequest } from "next/server";
import { isSchedulerAuthorized, runScheduledMaintenance } from "@mel/core";
import { purgeOrphanSightingMedia, runAdoptionRetention } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { dispatchPushQueue, type DispatchResult } from "@/lib/push/dispatch";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Agendador: `Authorization: Bearer <segredo>`, com PUSH_DISPATCH_SECRET ou
 * CRON_SECRET (o Vercel Cron manda este sozinho, via GET). Segredo na URL não
 * vale. O cabeçalho nunca vai para log.
 */
function fromScheduler(request: NextRequest): boolean {
  return isSchedulerAuthorized(request.headers.get("authorization"), [process.env.PUSH_DISPATCH_SECRET, process.env.CRON_SECRET]);
}

const unauthorized = () => Response.json({ error: "Não autorizado." }, { status: 401, headers: { "Cache-Control": "no-store" } });

function respond(result: DispatchResult, extra?: { orphansRemoved: number | null }) {
  return Response.json({ ...result, ...extra }, { status: result.disabled ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}

/**
 * Faxina do agendador: retenção da adoção (interesses de anúncios encerrados há
 * 30 dias, perfis da fila vencidos, lembrete "Ainda procura?") e fotos órfãs
 * antigas do sighting-media. Uma falha da adoção não impede a das fotos.
 */
async function cleanOrphans(): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;
  try {
    const r = await runAdoptionRetention(service);
    if (r.interestsRemoved || r.seekersRemoved || r.reminded) console.info("[manutenção] retenção da adoção", r);
  } catch (err) {
    console.error("[manutenção] retenção da adoção falhou", err instanceof Error ? err.message : String(err));
  }
  return purgeOrphanSightingMedia(service);
}

/**
 * Agendador (faxina de fotos órfãs + push que ficou para trás). Só envia o que
 * o banco já decidiu enviar; cada item é reservado no banco (SKIP LOCKED), então
 * execuções próximas ou simultâneas não duplicam envio.
 */
async function scheduled() {
  try {
    const { dispatch, orphansRemoved } = await runScheduledMaintenance({ cleanOrphans, dispatch: () => dispatchPushQueue() });
    return respond(dispatch, { orphansRemoved });
  } catch (err) {
    console.error("[api/push/dispatch] falhou", err);
    return Response.json({ error: "Não foi possível processar os avisos agora." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

/**
 * GET: só o agendador (Vercel Cron). Sessão não autoriza GET — um link ou
 * imagem em outro site não dispara nada em nome de quem está logado.
 */
export async function GET(request: NextRequest) {
  if (!fromScheduler(request)) return unauthorized();
  return scheduled();
}

/**
 * POST: o agendador (segredo) ou o app logo após ações que geram avisos
 * (sessão) — este só dispara o push, sem faxina.
 */
export async function POST(request: NextRequest) {
  if (fromScheduler(request)) return scheduled();
  if (!(await getSessionUser())) return unauthorized();
  try {
    return respond(await dispatchPushQueue());
  } catch (err) {
    console.error("[api/push/dispatch] falhou", err);
    return Response.json({ error: "Não foi possível processar os avisos agora." }, { status: 500 });
  }
}
