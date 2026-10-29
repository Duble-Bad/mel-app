import "server-only";
import webpush from "web-push";
import { isQuietHour, pushPayload } from "@mel/core";
import { claimPushBatch, finishPush } from "@mel/data";
import { createServiceClient } from "@/lib/supabase/service";

export interface DispatchResult {
  sent: number;
  skipped: number;
  failed: number;
  /** Motivo quando o push está desligado (sem chaves) — nunca falha em silêncio. */
  disabled?: string;
}

let configured = false;
function configure(): string | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:rede.mel.pets@outlook.com";
  if (!publicKey || !privateKey) return "Chaves VAPID ausentes (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).";
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return null;
}

/**
 * Envia os pushes pendentes da fila. Idempotente: cada item é "reservado" no
 * banco (SKIP LOCKED), então chamadas simultâneas não duplicam envio.
 * Silêncio noturno: o aviso fica no app, o celular não toca.
 */
export async function dispatchPushQueue(limit = 50, now = new Date()): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  const disabled = configure();
  if (disabled) {
    console.warn("[push] desativado:", disabled);
    return { ...result, disabled };
  }
  const service = createServiceClient();
  if (!service) return { ...result, disabled: "SUPABASE_SECRET_KEY ausente." };

  const jobs = await claimPushBatch(service, limit);
  for (const job of jobs) {
    if (!job.subscriptions.length) {
      await finishPush(service, job.outboxId, "SKIPPED", "sem aparelho inscrito");
      result.skipped++;
      continue;
    }
    if (job.quietNight && isQuietHour(now)) {
      await finishPush(service, job.outboxId, "SKIPPED", "silêncio noturno");
      result.skipped++;
      continue;
    }
    const body = JSON.stringify(pushPayload(job.notification));
    const ok: string[] = [];
    const dead: string[] = [];
    let lastError = "";
    for (const s of job.subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 6, urgency: "high" });
        ok.push(s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: o aparelho cancelou a inscrição — remove.
        if (status === 404 || status === 410) dead.push(s.id);
        lastError = `${status ?? "erro"}: ${(err as Error).message}`.slice(0, 200);
        console.error("[push] envio falhou", lastError);
      }
    }
    const status = ok.length ? "SENT" : "FAILED";
    await finishPush(service, job.outboxId, status, ok.length ? undefined : lastError, { ok, dead });
    if (ok.length) result.sent++;
    else result.failed++;
  }
  return result;
}
