import type { GuardianRadius, GuardianSettings } from "@mel/core";
import { DataError, type MelClient } from "./client";
import { toAppNotification, type AppNotification } from "./notifications";

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

interface SettingsRow {
  enabled: boolean;
  area_lat: number;
  area_lng: number;
  area_label: string | null;
  radius_m: number;
  alert_lost: boolean;
  alert_found: boolean;
  max_per_day: number;
  quiet_night: boolean;
}

/** null = ainda não é Guardião. */
export async function getGuardianSettings(client: MelClient, userId: string): Promise<GuardianSettings | null> {
  const { data, error } = await client
    .from("guardian_settings")
    .select("enabled, area_lat, area_lng, area_label, radius_m, alert_lost, alert_found, max_per_day, quiet_night")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail(error);
  const r = data as SettingsRow | null;
  if (!r) return null;
  return {
    enabled: r.enabled,
    area: { lat: r.area_lat, lng: r.area_lng },
    areaLabel: r.area_label,
    radiusM: r.radius_m as GuardianRadius,
    alertLost: r.alert_lost,
    alertFound: r.alert_found,
    maxPerDay: r.max_per_day,
    quietNight: r.quiet_night,
  };
}

/** Cria ou atualiza. O banco guarda a área já aproximada (250 m). */
export async function saveGuardianSettings(client: MelClient, userId: string, s: GuardianSettings): Promise<void> {
  const { error } = await client.from("guardian_settings").upsert({
    user_id: userId,
    enabled: s.enabled,
    area_lat: s.area.lat,
    area_lng: s.area.lng,
    area_label: s.areaLabel,
    radius_m: s.radiusM,
    alert_lost: s.alertLost,
    alert_found: s.alertFound,
    max_per_day: s.maxPerDay,
    quiet_night: s.quietNight,
  } as never);
  if (error) fail(error);
}

/** Inscrição de push deste aparelho (Web Push). */
export async function savePushSubscription(
  client: MelClient,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
): Promise<void> {
  const { error } = await client.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
    p_user_agent: userAgent,
  });
  if (error) fail(error);
}

export async function removePushSubscription(client: MelClient, endpoint: string): Promise<void> {
  const { error } = await client.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) fail(error);
}

export async function countMyPushDevices(client: MelClient): Promise<number> {
  const { count, error } = await client.from("push_subscriptions").select("id", { count: "exact", head: true });
  if (error) fail(error);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Despachante (SÓ servidor, com a chave secreta).
// ---------------------------------------------------------------------------
export interface PushJob {
  outboxId: number;
  userId: string;
  notification: AppNotification;
  quietNight: boolean;
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
}

interface ClaimRow {
  outbox_id: number;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  notification_id: string;
  quiet_night: boolean;
  subscriptions: PushJob["subscriptions"];
}

export async function claimPushBatch(service: MelClient, limit = 50): Promise<PushJob[]> {
  const { data, error } = await service.rpc("claim_push_batch", { p_limit: limit });
  if (error) fail(error);
  return ((data as unknown as ClaimRow[]) ?? []).map((r) => ({
    outboxId: r.outbox_id,
    userId: r.user_id,
    notification: toAppNotification({ id: r.notification_id, kind: r.kind, payload: r.payload, read_at: r.read_at, created_at: r.created_at }),
    quietNight: r.quiet_night,
    subscriptions: r.subscriptions ?? [],
  }));
}

export async function finishPush(
  service: MelClient,
  outboxId: number,
  status: "SENT" | "SKIPPED" | "FAILED",
  reason?: string,
  subs: { dead?: string[]; ok?: string[] } = {},
): Promise<void> {
  const { error } = await service.rpc("finish_push", {
    p_outbox_id: outboxId,
    p_status: status,
    p_reason: reason,
    p_dead_subscriptions: subs.dead ?? [],
    p_ok_subscriptions: subs.ok ?? [],
  });
  if (error) fail(error);
}
