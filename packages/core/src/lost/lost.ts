import { z } from "zod";
import type { LatLng } from "../geo/geo";
import type { BrState } from "../profile/profile";
import type { PetColor, PetSex, PetSize, Species } from "../pet/pet";

export const LOST_STATUSES = ["DRAFT", "ACTIVE", "FOUND", "CLOSED", "REMOVED"] as const;
export type LostStatus = (typeof LOST_STATUSES)[number];

export const WEARING = ["collar", "clothes", "harness", "tag"] as const;
export type Wearing = (typeof WEARING)[number];
export const WEARING_LABELS: Record<Wearing, string> = {
  collar: "Coleira",
  clothes: "Roupinha",
  harness: "Peitoral",
  tag: "Plaquinha de identificação",
};

/** Alerta como o tutor vê (tabela base, inclui dados privados). */
export interface LostCase {
  id: string;
  code: string;
  petId: string;
  ownerId: string;
  status: LostStatus;
  lastSeen: LatLng | null;
  lastSeenLabel: string | null;
  publicPointExact: boolean;
  publicAreaLabel: string | null;
  city: string | null;
  state: string | null;
  lostAt: string | null;
  lostAtUncertain: boolean;
  wearing: Wearing[];
  notes: string | null;
  contactWhatsappPublic: boolean;
  contactPhonePublic: boolean;
  contactPhone: string | null;
  publishedAt: string | null;
}

/** Alerta como qualquer pessoa vê (sem local exato, sem contato não autorizado). */
export interface PublicLostCase {
  code: string;
  status: LostStatus;
  lostAt: string | null;
  lostAtUncertain: boolean;
  publishedAt: string | null;
  foundAt: string | null;
  point: LatLng | null;
  pointIsExact: boolean;
  areaLabel: string | null;
  city: string | null;
  state: string | null;
  wearing: Wearing[];
  notes: string | null;
  contactWhatsapp: string | null;
  contactPhone: string | null;
  indexable: boolean;
  isOwner: boolean;
  pet: {
    name: string;
    species: Species;
    breed: string | null;
    sex: PetSex;
    size: PetSize | null;
    colorPrimary: PetColor | null;
    colorsSecondary: PetColor[];
    uniqueMarks: string | null;
    description: string | null;
    melId: string;
    birthDate: string | null;
    ageEstimateMonths: number | null;
    weightKg: number | null;
    photos: { url: string; thumbUrl: string; isPrimary: boolean }[];
  };
}

// ---------------------------------------------------------------------------
// Passos do assistente: cada um valida só o que pede.
// ---------------------------------------------------------------------------

export const whereStepSchema = z.object({
  lastSeen: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }, {
    error: "Marque no mapa onde ele foi visto pela última vez.",
  }),
  lastSeenLabel: z.string().max(200).nullable().default(null),
  publicAreaLabel: z.string().max(120).nullable().default(null),
  city: z.string().max(80).nullable().default(null),
  state: z.string().length(2).nullable().default(null),
  publicPointExact: z.boolean().default(false),
});

export const whenStepSchema = z.object({
  lostAt: z.iso.datetime({ offset: true, error: "Diga quando ele sumiu (mesmo que aproximado)." }).refine(
    (v) => new Date(v).getTime() <= Date.now() + 5 * 60_000,
    "O horário não pode estar no futuro.",
  ),
  lostAtUncertain: z.boolean().default(false),
});

export const detailsStepSchema = z.object({
  wearing: z.array(z.enum(WEARING)).default([]),
  notes: z
    .string()
    .trim()
    .max(500, "Use no máximo 500 caracteres.")
    .transform((v) => v || null)
    .nullable()
    .default(null),
});

/** Telefone brasileiro só com dígitos (DDD + número), sem +55. */
export function normalizeBrPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return /^[1-9][0-9][0-9]{8,9}$/.test(digits) ? digits : null;
}

/** "(11) 98765-4321" */
export function formatBrPhone(digits: string): string {
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

export const contactStepSchema = z
  .object({
    contactWhatsappPublic: z.boolean().default(false),
    contactPhonePublic: z.boolean().default(false),
    contactPhone: z.string().nullable().default(null),
  })
  .transform((c, ctx) => {
    const wantsPhone = c.contactWhatsappPublic || c.contactPhonePublic;
    const phone = c.contactPhone ? normalizeBrPhone(c.contactPhone) : null;
    if (wantsPhone && !phone) {
      ctx.addIssue({
        code: "custom",
        path: ["contactPhone"],
        message: "Informe um celular com DDD, por exemplo (11) 98765-4321.",
      });
      return z.NEVER;
    }
    return { ...c, contactPhone: wantsPhone ? phone : null };
  });

export const LOST_STEPS = ["pet", "where", "when", "details", "contact", "review"] as const;
export type LostStep = (typeof LOST_STEPS)[number];

/** Primeiro passo que ainda falta, para retomar um rascunho de onde parou. */
export function firstIncompleteStep(c: Pick<LostCase, "lastSeen" | "lostAt"> | null): LostStep {
  if (!c) return "pet";
  if (!c.lastSeen) return "where";
  if (!c.lostAt) return "when";
  return "details";
}

// ---------------------------------------------------------------------------
// Texto humano
// ---------------------------------------------------------------------------

/** "há 35 minutos", "há 2 horas", "há 3 dias", "agora há pouco". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 2) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.floor(days / 30);
  return `há ${months} ${months === 1 ? "mês" : "meses"}`;
}

/** "28/10 às 22:04" no fuso de Brasília. */
export function formatDateTimeBr(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${date} às ${time}`;
}

/** Só bairro e cidade (nunca a rua) para o texto público. */
export function publicAreaFrom(place: { neighborhood?: string; city?: string; state?: BrState }): string | null {
  const city = place.city && place.state ? `${place.city} – ${place.state}` : place.city;
  return [place.neighborhood, city].filter(Boolean).join(", ") || null;
}

export const alertPath = (code: string) => `/alerta/${code}`;

/** Mensagem pronta para WhatsApp/redes. */
export function shareText(c: Pick<PublicLostCase, "pet" | "areaLabel" | "lostAt">, url: string): string {
  const where = c.areaLabel ? ` perto de ${c.areaLabel}` : "";
  const when = c.lostAt ? ` (${formatDateTimeBr(c.lostAt)})` : "";
  return `🚨 PROCURA-SE: ${c.pet.name}, desaparecido(a)${where}${when}. Viu? Veja fotos e ajude: ${url}`;
}

export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const whatsappChatUrl = (digits: string, text?: string) =>
  `https://wa.me/55${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
