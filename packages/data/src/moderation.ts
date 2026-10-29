import type { AdminOverview, AdminReport, AuditEntry, ModerationAction, ReportableTarget, ReportInput } from "@mel/core";
import { DataError, type MelClient } from "./client";

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

/** Denuncia um alerta (código), encontrado (código) ou avistamento (id). Não duplica denúncia aberta. */
export async function reportContent(
  client: MelClient,
  target: { type: ReportableTarget; key: string },
  input: Pick<ReportInput, "reason" | "details">,
): Promise<string> {
  const { data, error } = await client.rpc("report_content", {
    p_target_type: target.type,
    p_target: target.key,
    p_reason: input.reason,
    p_details: input.details ?? undefined,
  });
  if (error) fail(error);
  return data as string;
}

export async function getAdminOverview(client: MelClient): Promise<AdminOverview> {
  const { data, error } = await client.rpc("admin_overview");
  if (error) fail(error);
  const o = data as Record<string, number>;
  return {
    activeLost: o.active_lost ?? 0,
    reunited: o.reunited ?? 0,
    reunited30d: o.reunited_30d ?? 0,
    activeFound: o.active_found ?? 0,
    sightings7d: o.sightings_7d ?? 0,
    users: o.users ?? 0,
    guardians: o.guardians ?? 0,
    openReports: o.open_reports ?? 0,
  };
}

interface ReportJson {
  id: string;
  target_type: AdminReport["targetType"];
  target_id: string;
  reason: AdminReport["reason"];
  details: string | null;
  status: AdminReport["status"];
  created_at: string;
  handled_at: string | null;
  conversation_id: string | null;
  reports_for_target: number;
  target: AdminReport["target"];
  author_suspended: boolean;
}

export async function listAdminReports(client: MelClient, open = true): Promise<AdminReport[]> {
  const { data, error } = await client.rpc("admin_list_reports", { p_open: open });
  if (error) fail(error);
  return ((data as unknown as ReportJson[]) ?? []).map((r) => ({
    id: r.id,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.created_at,
    handledAt: r.handled_at,
    conversationId: r.conversation_id,
    reportsForTarget: r.reports_for_target,
    target: r.target,
    authorSuspended: r.author_suspended,
  }));
}

export async function moderate(client: MelClient, reportId: string, action: ModerationAction, reason?: string): Promise<void> {
  const { error } = await client.rpc("admin_moderate", { p_report_id: reportId, p_action: action, p_reason: reason });
  if (error) fail(error);
}

export async function getAuditLog(client: MelClient, limit = 30): Promise<AuditEntry[]> {
  const { data, error } = await client.rpc("admin_audit_log", { p_limit: limit });
  if (error) fail(error);
  return ((data as unknown as Record<string, unknown>[]) ?? []).map((a) => ({
    id: a.id as number,
    action: a.action as ModerationAction,
    targetType: a.target_type as AuditEntry["targetType"],
    reason: (a.reason as string | null) ?? null,
    createdAt: a.created_at as string,
    moderator: a.moderator as string,
    target: a.target as AuditEntry["target"],
  }));
}
