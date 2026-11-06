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

/** Passo a passo curto para o reencontro (abre sob o aviso fixo). Sem promessa de que a MEL evita golpes. */
export const ANTI_SCAM_TIPS = [
  "Antes de sair, peça uma foto ou vídeo de agora do animal.",
  "Confirme que é o mesmo pet: peça para descrever uma marca ou detalhe que não aparece nas fotos.",
  "Não pague nada adiantado: nem taxa, nem frete, nem recompensa antes de estar com o animal.",
  "Não envie documentos, dados do banco nem códigos que chegarem por SMS.",
  "Não precisa dar seu endereço. Se puder, combine num lugar movimentado e leve alguém com você.",
  "Ameaça ou chantagem? Ligue 190.",
] as const;

/** Só onde existe o botão Denunciar (conversa aberta). */
export const ANTI_SCAM_REPORT_TIP = "Algo estranho na conversa? Toque em Denunciar.";

/** Aviso junto da mensagem que fala de dinheiro ou de código. */
export const PAYMENT_WARNING =
  "Pedido de dinheiro ou de código? Não pague nada antes de estar com o animal e não repasse códigos de SMS. Se suspeitar, toque em Denunciar.";

export interface Conversation {
  id: string;
  /** Conversa sobre um alerta ("lost") ou um anúncio de adoção ("adoption"). */
  context: "lost" | "adoption";
  code: string;
  caseStatus: LostStatus;
  petName: string;
  petThumbUrl: string | null;
  myRole: "owner" | "helper";
  /** null em conversas abertas a partir da fila "Querem adotar" (dados mínimos). */
  peerId: string | null;
  /** Primeiro nome de quem ajuda (só para o tutor; nunca de conta anônima). */
  peerName: string | null;
  peerIsAnonymous: boolean;
  fromSighting: boolean;
  /** Tutor abriu a conversa a partir de uma correspondência do Radar. */
  fromFound: boolean;
  /** Quem anuncia abriu a conversa a partir da fila "Querem adotar". */
  fromSeekerQueue: boolean;
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
export function peerLabel(
  c: Pick<Conversation, "myRole" | "peerName" | "peerIsAnonymous" | "petName" | "fromSighting"> & { fromFound?: boolean; fromSeekerQueue?: boolean; context?: Conversation["context"] },
): string {
  if (c.myRole === "helper") return c.context === "adoption" ? `Quem está doando ${c.petName}` : `Tutor(a) de ${c.petName}`;
  if (c.peerName) return c.peerName;
  if (c.fromFound) return "Quem encontrou um pet parecido";
  if (c.context === "adoption") return c.fromSeekerQueue ? "Pessoa da fila “Querem adotar”" : "Pessoa interessada em adotar";
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
  // Golpe do código: "me passa o código que chegou no seu celular".
  /\bsms\b/i,
  /\bc[oó]digo\b[^.?!]{0,40}\b(chegou|recebeu|celular|whats|verifica|confirma)/i,
];

/** Mensagem que fala de dinheiro (ou pede código de SMS): o app mostra um alerta de golpe junto dela. */
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

/** Mesma regra do banco (start_adoption_seeker_conversation): a 1ª mensagem para a fila não leva contato nem link. */
export const FIRST_CONTACT_RULE =
  "Na primeira mensagem, não envie links, telefone nem e-mail. Apresente-se e conte sobre o animal; o contato continua pelo chat da MEL.";

const FIRST_CONTACT_PATTERNS = [
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|io|me|ly)\b)/i,
  /[0-9][0-9 ().-]{7,}[0-9]/,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
];

/** Primeira mensagem de quem anuncia para alguém da fila: null se pode enviar, ou o motivo. */
export function firstContactIssue(text: string): string | null {
  return FIRST_CONTACT_PATTERNS.some((re) => re.test(text)) ? FIRST_CONTACT_RULE : null;
}
