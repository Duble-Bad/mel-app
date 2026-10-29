import { z } from "zod";
import { normalizeBrPhone } from "../lost/lost";

export const BUSINESS_CATEGORIES = ["vet", "petshop", "grooming", "hotel", "trainer", "ngo", "other"] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  vet: "Clínica veterinária",
  petshop: "Pet shop",
  grooming: "Banho e tosa",
  hotel: "Hotel e creche",
  trainer: "Adestramento",
  ngo: "ONG / protetor",
  other: "Outro",
};

export type BusinessStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";

const optionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeBrPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Informe um telefone com DDD, ex.: (11) 3333-4444." });
      return z.NEVER;
    }
    return n;
  })
  .nullable()
  .default(null);

export const businessInputSchema = z.object({
  name: z.string().trim().min(2, "Qual é o nome da empresa?").max(80, "Use até 80 caracteres."),
  category: z.enum(BUSINESS_CATEGORIES, { error: "Escolha a categoria." }),
  description: z.string().trim().min(20, "Conte um pouco sobre a empresa (pelo menos 20 caracteres).").max(800, "Use até 800 caracteres."),
  addressLabel: z.string().trim().min(5, "Informe o endereço.").max(200),
  position: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }, { error: "Marque o endereço no mapa." }),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  website: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .default(null)
    .refine((v) => v === null || /^https:\/\/\S+\.\S+/.test(v), "Use um endereço que comece com https://"),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, "") || null)
    .nullable()
    .default(null)
    .refine((v) => v === null || /^[A-Za-z0-9._]{1,30}$/.test(v), "Use só o usuário do Instagram (ex.: @meupetshop)."),
  hours: z.string().trim().max(200).transform((v) => v || null).nullable().default(null),
  helpsLost: z.boolean().default(false),
  logoPath: z.string().max(300).nullable().default(null),
});
export type BusinessInput = z.output<typeof businessInputSchema>;

export const offerSchema = z.object({
  title: z.string().trim().min(3, "Dê um título à oferta.").max(80, "Use até 80 caracteres."),
  description: z.string().trim().max(300).transform((v) => v || null).nullable().default(null),
  endsAt: z.iso.date().nullable().default(null),
});
export type OfferInput = z.output<typeof offerSchema>;

export interface BusinessOffer {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Sempre exibido como "Patrocinado". */
  isSponsored: boolean;
}

export interface PublicBusiness {
  code: string;
  status: BusinessStatus;
  name: string;
  category: BusinessCategory;
  description: string;
  addressLabel: string;
  position: { lat: number; lng: number };
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  hours: string | null;
  helpsLost: boolean;
  logoUrl: string | null;
  planCode: string;
  distanceM: number | null;
  isOwner: boolean;
  reviewNote: string | null;
  offers: BusinessOffer[];
}
