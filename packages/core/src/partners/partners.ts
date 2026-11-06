import { z } from "zod";
import { CNPJ_MESSAGE, cnpjField, cpfField, optionalPhoneField } from "../contact/schemas";
import { type DocumentReadState, isValidCnpj, normalizeCnpj } from "./documents";

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

/** Categorias de serviço de uma empresa (ONG e protetor entram como "ngo"). */
export const COMPANY_CATEGORIES = ["vet", "petshop", "grooming", "hotel", "trainer", "other"] as const;
export type CompanyCategory = (typeof COMPANY_CATEGORIES)[number];

export const PARTNER_KINDS = ["company", "ngo", "independent"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  company: "Empresa ou serviço pet",
  ngo: "ONG",
  independent: "Protetor(a) independente",
};

export const NGO_ACTIVITY_AREAS = ["Cães e gatos", "Só cães", "Só gatos", "Resgate e lar temporário"] as const;

export type BusinessStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";

/** Situação da consulta automática do CNPJ (desligada no piloto: fica PENDING). */
export type CnpjCheckStatus = "PENDING" | "VERIFIED" | "NOT_FOUND" | "INACTIVE" | "ERROR";
export const CNPJ_CHECK_LABELS: Record<CnpjCheckStatus, string> = {
  PENDING: "Verificação pendente",
  VERIFIED: "CNPJ ativo na fonte oficial",
  NOT_FOUND: "CNPJ não encontrado na fonte",
  INACTIVE: "CNPJ não está ativo",
  ERROR: "Consulta falhou (nova tentativa agendada)",
};

// Telefone: regra central (contact/phone.ts), a mesma do banco.
const optionalPhone = optionalPhoneField;

const website = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .default(null)
  .refine((v) => v === null || /^https:\/\/\S+\.\S+/.test(v), "Use um endereço que comece com https://");

const instagram = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, "") || null)
  .nullable()
  .default(null)
  .refine((v) => v === null || /^[A-Za-z0-9._]{1,30}$/.test(v), "Use só o usuário do Instagram (ex.: @meupetshop).");

const cnpj = cnpjField;

const optionalCnpj = z
  .string()
  .trim()
  .transform((v) => (v ? normalizeCnpj(v) : null))
  .nullable()
  .default(null)
  .refine((v) => v === null || isValidCnpj(v), CNPJ_MESSAGE);

const optionalText = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`).transform((v) => v || null).nullable().default(null);

const position = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }, { error: "Marque o local no mapa." });

export const businessInputSchema = z.object({
  name: z.string().trim().min(2, "Qual é o nome da empresa?").max(80, "Use até 80 caracteres."),
  category: z.enum(BUSINESS_CATEGORIES, { error: "Escolha a categoria." }),
  description: z.string().trim().min(20, "Conte um pouco sobre a empresa (pelo menos 20 caracteres).").max(800, "Use até 800 caracteres."),
  addressLabel: z.string().trim().min(5, "Informe o endereço.").max(200),
  position,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  website,
  instagram,
  hours: z.string().trim().max(200).transform((v) => v || null).nullable().default(null),
  helpsLost: z.boolean().default(false),
  logoPath: z.string().max(300).nullable().default(null),
  // Empresa (tipo padrão): CNPJ e razão social são exigidos pelo banco.
  cnpj: optionalCnpj,
  legalName: optionalText(150),
});
export type BusinessInput = z.output<typeof businessInputSchema>;

// ---------------------------------------------------------------------------
// Inscrição por tipo (página /parceiros). O servidor revalida tudo.
// ---------------------------------------------------------------------------
const common = {
  name: z.string().trim().min(2, "Qual é o nome público?").max(80, "Use até 80 caracteres."),
  description: z.string().trim().min(20, "Conte um pouco mais (pelo menos 20 caracteres).").max(800, "Use até 800 caracteres."),
  position,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  website,
  instagram,
  helpsLost: z.boolean().default(false),
  logoPath: z.string().max(300).nullable().default(null),
};
const place = {
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(80, "Use até 80 caracteres."),
  city: z.string().trim().min(2, "Informe a cidade (ex.: São Paulo – SP).").max(80, "Use até 80 caracteres."),
};

const companySchema = z.object({
  kind: z.literal("company"),
  ...common,
  category: z.enum(COMPANY_CATEGORIES, { error: "Escolha a categoria." }),
  cnpj,
  legalName: z.string().trim().min(2, "Informe a razão social.").max(150, "Use até 150 caracteres."),
  addressLabel: z.string().trim().min(5, "Informe o endereço do estabelecimento.").max(200),
  hours: optionalText(200),
});

const ngoSchema = z.object({
  kind: z.literal("ngo"),
  ...common,
  ...place,
  cnpj,
  legalName: optionalText(150),
  activityArea: z.enum(NGO_ACTIVITY_AREAS, { error: "Escolha a área de atuação." }),
  responsibleName: z.string().trim().min(2, "Quem responde pela ONG?").max(120, "Use até 120 caracteres."),
});

const independentSchema = z.object({
  kind: z.literal("independent"),
  ...common,
  ...place,
  cpf: cpfField,
});

const CONTACT_MESSAGE = "Informe ao menos um contato: telefone, WhatsApp, site ou Instagram.";

export const partnerInputSchema = z
  .discriminatedUnion("kind", [companySchema, ngoSchema, independentSchema], { error: "Escolha o tipo de parceiro." })
  .superRefine((p, ctx) => {
    if (p.kind !== "independent" && !p.phone && !p.whatsapp && !p.website && !p.instagram) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: CONTACT_MESSAGE });
    }
  });
export type PartnerInput = z.output<typeof partnerInputSchema>;

/** Linha de businesses a partir da inscrição (sem o CPF, que nunca vai em claro ao banco). */
export function partnerRecord(p: PartnerInput) {
  const base = {
    partnerKind: p.kind,
    name: p.name,
    description: p.description,
    position: p.position,
    phone: p.phone,
    whatsapp: p.whatsapp,
    website: p.website,
    instagram: p.instagram,
    helpsLost: p.helpsLost,
    logoPath: p.logoPath,
  };
  if (p.kind === "company") {
    return { ...base, category: p.category, cnpj: p.cnpj, legalName: p.legalName, addressLabel: p.addressLabel, hours: p.hours,
      city: null, neighborhood: null, activityArea: null, responsibleName: null };
  }
  const where = { city: p.city, neighborhood: p.neighborhood, addressLabel: `${p.neighborhood}, ${p.city}`, hours: null };
  if (p.kind === "ngo") {
    return { ...base, ...where, category: "ngo" as const, cnpj: p.cnpj, legalName: p.legalName, activityArea: p.activityArea, responsibleName: p.responsibleName };
  }
  return { ...base, ...where, category: "ngo" as const, cnpj: null, legalName: null, activityArea: null, responsibleName: null };
}
export type PartnerRecord = ReturnType<typeof partnerRecord>;

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
  /** Selo "Patrocinado": só aparece com a flag de patrocínio ligada (desligada no piloto). */
  isSponsored: boolean;
}

/** Dados de cadastro: só o dono e a moderação recebem (nunca o CPF). */
export interface BusinessPrivateData {
  cnpj: string | null;
  legalName: string | null;
  responsibleName: string | null;
  cnpjStatus: CnpjCheckStatus | null;
  /** Protetor: há CPF cifrado guardado. */
  hasDocument: boolean;
  /** Protetor: o CPF guardado abre? (a moderação vê só isto, nunca o número). */
  documentState: DocumentReadState | null;
}

export interface PublicBusiness {
  code: string;
  status: BusinessStatus;
  kind: PartnerKind;
  name: string;
  category: BusinessCategory;
  description: string;
  addressLabel: string;
  city: string | null;
  neighborhood: string | null;
  activityArea: string | null;
  position: { lat: number; lng: number };
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  hours: string | null;
  helpsLost: boolean;
  logoUrl: string | null;
  planCode: string;
  /** Selo "CNPJ verificado": consulta válida na fonte oficial E aprovação. */
  cnpjVerified: boolean;
  distanceM: number | null;
  isOwner: boolean;
  reviewNote: string | null;
  private: BusinessPrivateData | null;
  offers: BusinessOffer[];
}

/** ONG e protetor mostram só bairro/cidade e um ponto aproximado. */
export const hasApproximateLocation = (b: Pick<PublicBusiness, "kind">) => b.kind !== "company";
