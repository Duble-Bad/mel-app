import { z } from "zod";
import type { LostStatus } from "../lost/lost";

export const MESSAGE_MAX = 2000;

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, "Escreva uma mensagem.")
  .max(MESSAGE_MAX, `A mensagem pode ter até ${MESSAGE_MAX} caracteres.`);

/** Texto fixo no topo de toda conversa (golpe do "achei, mande PIX"). */
export const ANTI_SCAM_NOTICE =
  "A MEL nunca pede pagamento. Desconfie de quem pede PIX ou dinheiro antes de mostrar o animal.";

export interface Conversation {
  id: string;
  code: string;
  caseStatus: LostStatus;
  petName: string;
  petThumbUrl: string | null;
  myRole: "owner" | "helper";
  peerId: string;
  /** Primeiro nome de quem ajuda (só para o tutor; nunca de conta anônima). */
  peerName: string | null;
  peerIsAnonymous: boolean;
  fromSighting: boolean;
  blockedByMe: boolean;
  canSend: boolean;
  createdAt: string;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/** Como a outra pessoa aparece: o tutor nunca é exposto por nome a quem ajuda. */
export function peerLabel(c: Pick<Conversation, "myRole" | "peerName" | "peerIsAnonymous" | "petName" | "fromSighting">): string {
  if (c.myRole === "helper") return `Tutor(a) de ${c.petName}`;
  if (c.peerName) return c.peerName;
  return c.fromSighting ? "Quem enviou o avistamento" : "Visitante sem cadastro";
}

const PAYMENT_PATTERNS = [
  /\bpix\b/i,
  /\bchave\b/i,
  /\btransfer[eê]ncia\b/i,
  /\btransfer(e|ir)\b/i,
  /\bdep[oó]sit/i,
  /\bpag(ar|ue|amento|uem)\b/i,
  /\bboleto\b/i,
  /\bdinheiro\b/i,
  /\brecompensa\b/i,
  /\bfrete\b/i,
  /\bta(x|ch)a\b/i,
  /r\$\s?\d/i,
];

/** Mensagem que fala de dinheiro: o app mostra um alerta de golpe junto dela. */
export function mentionsPayment(text: string): boolean {
  return PAYMENT_PATTERNS.some((re) => re.test(text));
}

export const REPORT_REASONS = ["scam", "harassment", "spam", "fake", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  scam: "Pediu dinheiro ou parece golpe",
  harassment: "Ofensa, ameaça ou assédio",
  spam: "Spam ou propaganda",
  fake: "Informação falsa sobre o pet",
  inappropriate: "Conteúdo impróprio",
  other: "Outro motivo",
};

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { error: "Escolha o motivo da denúncia." }),
  details: z
    .string()
    .trim()
    .max(1000, "Use até 1000 caracteres.")
    .transform((v) => v || null)
    .nullable()
    .default(null),
  block: z.boolean().default(true),
});
export type ReportInput = z.infer<typeof reportSchema>;

/** "Hoje 14:05", "Ontem 09:12" ou "12/10 18:30" — horário curto para bolhas e lista. */
export function formatChatTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(d);
  const day = (x: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(x);
  const time = fmt({ hour: "2-digit", minute: "2-digit" });
  if (day(d) === day(now)) return `Hoje ${time}`;
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return `Ontem ${time}`;
  return `${fmt({ day: "2-digit", month: "2-digit" })} ${time}`;
}
