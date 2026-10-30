import type { ReportReason } from "../chat/chat";

/** Conteúdo público denunciável fora do chat. */
export const REPORTABLE = ["lost_case", "found_case", "sighting", "adoption", "business"] as const;
export type ReportableTarget = (typeof REPORTABLE)[number];

export type ReportTargetType = ReportableTarget | "user" | "message";

export const REPORT_TARGET_LABELS: Record<string, string> = {
  lost_case: "Alerta",
  found_case: "Encontrado",
  sighting: "Avistamento",
  user: "Pessoa (chat)",
  message: "Mensagem",
  adoption: "Adoção",
  business: "Parceiro",
};

export const MODERATION_ACTIONS = ["hide", "suspend", "dismiss", "approve", "reject"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_ACTION_LABELS: Record<ModerationAction, string> = {
  hide: "Conteúdo ocultado",
  suspend: "Autor suspenso",
  dismiss: "Denúncia descartada",
  approve: "Adoção aprovada",
  reject: "Adoção recusada",
};

export interface AdminOverview {
  activeLost: number;
  reunited: number;
  reunited30d: number;
  activeFound: number;
  sightings7d: number;
  users: number;
  guardians: number;
  openReports: number;
}

export interface AdminReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: "OPEN" | "REVIEWING" | "ACTIONED" | "DISMISSED";
  createdAt: string;
  handledAt: string | null;
  conversationId: string | null;
  reportsForTarget: number;
  target: { title?: string; href?: string | null; state?: string; author_id?: string } | null;
  authorSuspended: boolean;
}

export interface AuditEntry {
  id: number;
  action: ModerationAction;
  targetType: ReportTargetType;
  reason: string | null;
  createdAt: string;
  moderator: string;
  target: AdminReport["target"];
}

/** Ações sobre denúncias (aprovar/recusar são da revisão de adoção). */
export type ReportAction = Exclude<ModerationAction, "approve" | "reject">;

/** Ações possíveis para um tipo de alvo (pessoa do chat não tem "ocultar"). */
export function actionsFor(targetType: ReportTargetType): ReportAction[] {
  return targetType === "user" ? ["suspend", "dismiss"] : ["hide", "suspend", "dismiss"];
}
