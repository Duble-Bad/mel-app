import { z } from "zod";
import { GUARDIAN_RADII_M } from "../guardian/guardian";
import { PET_SIZES, type PetSize, type Species } from "../pet/pet";

/** Fila de interessados ("Quero adotar") sem animal específico. Espelha a migration 20261106122000. */

export const SEEKER_SPECIES = ["dog", "cat", "any"] as const;
export type SeekerSpecies = (typeof SEEKER_SPECIES)[number];
export const SEEKER_SPECIES_LABELS: Record<SeekerSpecies, string> = { dog: "Cão", cat: "Gato", any: "Tanto faz" };

/** Porte na tela (Pequeno/Médio/Grande) → portes do cadastro de pets. */
export const SEEKER_SIZE_GROUPS = {
  small: ["mini", "small"],
  medium: ["medium"],
  large: ["large", "giant"],
} as const satisfies Record<string, readonly PetSize[]>;
export type SeekerSizeGroup = keyof typeof SEEKER_SIZE_GROUPS;
export const SEEKER_SIZE_LABELS: Record<SeekerSizeGroup, string> = { small: "Pequeno", medium: "Médio", large: "Grande" };

export const SEEKER_AGES = ["puppy", "adult", "senior"] as const;
export type SeekerAge = (typeof SEEKER_AGES)[number];
export const SEEKER_AGE_LABELS: Record<SeekerAge, string> = { puppy: "Filhote", adult: "Adulto", senior: "Idoso" };

export const SEEKER_HOUSING = ["apartment", "house_yard", "house_no_yard", "rural", "other"] as const;
export type SeekerHousing = (typeof SEEKER_HOUSING)[number];
export const SEEKER_HOUSING_LABELS: Record<SeekerHousing, string> = {
  apartment: "Apartamento",
  house_yard: "Casa com quintal",
  house_no_yard: "Casa sem quintal",
  rural: "Chácara/sítio",
  other: "Outro",
};

export const SEEKER_OTHER_PETS = ["none", "dogs", "cats", "dogs_cats", "others"] as const;
export type SeekerOtherPets = (typeof SEEKER_OTHER_PETS)[number];
export const SEEKER_OTHER_PETS_LABELS: Record<SeekerOtherPets, string> = {
  none: "Não",
  dogs: "Sim, cães",
  cats: "Sim, gatos",
  dogs_cats: "Sim, cães e gatos",
  others: "Sim, outros animais",
};

export const SEEKER_STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED"] as const;
export type SeekerStatus = (typeof SEEKER_STATUSES)[number];
export const SEEKER_STATUS_LABELS: Record<SeekerStatus, string> = { PENDING_REVIEW: "Em análise", APPROVED: "Aprovado", REJECTED: "Não aprovado" };

/** Prazos (decisão do proprietário): mostrados na tela e aplicados pelo banco. */
export const SEEKER_VALID_DAYS = 90;
/** Sem renovação, o perfil vencido é apagado depois deste prazo. */
export const SEEKER_DELETE_AFTER_EXPIRY_DAYS = 30;
/** Interesses em anúncios encerrados são apagados depois deste prazo. */
export const CLOSED_INTEREST_RETENTION_DAYS = 30;
/** Máximo de avisos de "animal compatível" por pessoa em 24 h. */
export const SEEKER_MATCHES_PER_DAY = 3;

/** Faixa de idade do anúncio (filhote < 1 ano, adulto até 7, idoso 8+); igual a private.adoption_age_band. */
export function ageBand(months: number | null): SeekerAge | null {
  if (months == null) return null;
  return months < 12 ? "puppy" : months < 96 ? "adult" : "senior";
}

/** Telefone, e-mail ou link no texto livre (mesma regra do banco): o contato é pelo chat. */
export function hasContactInfo(text: string): boolean {
  return /[0-9][0-9 ().-]{7,}[0-9]/.test(text) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) || /(https?:\/\/|www\.)/i.test(text);
}

/** Só dígitos; vazio vira null. */
export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits || null;
}

const radii = GUARDIAN_RADII_M.map((r) => z.literal(r)) as unknown as [z.ZodLiteral<1000>, z.ZodLiteral<3000>, z.ZodLiteral<5000>, z.ZodLiteral<10000>];

export const seekerInputSchema = z.object({
  species: z.enum(SEEKER_SPECIES, { error: "Escolha a espécie." }),
  sizes: z.array(z.enum(PET_SIZES)).max(5).default([]),
  ages: z.array(z.enum(SEEKER_AGES)).max(3).default([]),
  area: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }, { error: "Marque o seu bairro." }),
  areaLabel: z.string({ error: "Informe bairro e cidade." }).trim().min(2, "Informe bairro e cidade.").max(120, "Use até 120 caracteres."),
  radiusM: z.union(radii).default(10000),
  housing: z.enum(SEEKER_HOUSING, { error: "Escolha o tipo de moradia." }),
  otherPets: z.enum(SEEKER_OTHER_PETS, { error: "Diga se já tem outros animais." }),
  /** Opcional (decisão do proprietário). */
  children: z.boolean().nullable().default(null),
  routine: z
    .string({ error: "Conte um pouco sobre sua rotina." })
    .trim()
    .min(20, "Conte um pouco mais (pelo menos 20 caracteres).")
    .max(600, "Use até 600 caracteres.")
    .refine((v) => !hasContactInfo(v), "Não escreva telefone, e-mail nem links aqui. O contato acontece pelo chat da MEL."),
  whatsapp: z
    .string()
    .nullable()
    .default(null)
    .transform(normalizeWhatsapp)
    .refine((v) => v === null || /^[0-9]{10,13}$/.test(v), "WhatsApp inválido. Use DDD e número."),
  notify: z.boolean().default(true),
  showPublic: z.boolean().default(false),
  consent: z.literal(true, { error: "Para entrar na fila, precisamos do seu consentimento." }),
});
export type SeekerInput = z.output<typeof seekerInputSchema>;

/** O próprio perfil (inclui o WhatsApp, que é dele). */
export interface AdoptionSeeker {
  id: string;
  status: SeekerStatus;
  species: SeekerSpecies;
  sizes: PetSize[];
  ages: SeekerAge[];
  area: { lat: number; lng: number };
  areaLabel: string;
  radiusM: number;
  housing: SeekerHousing;
  otherPets: SeekerOtherPets;
  children: boolean | null;
  routine: string;
  whatsapp: string | null;
  notify: boolean;
  showPublic: boolean;
  reviewNote: string | null;
  reviewedAt: string | null;
  expiresAt: string;
  createdAt: string;
  firstName: string | null;
}

/** Fila da moderação: o perfil completo (só a moderação recebe). */
export type SeekerForReview = AdoptionSeeker;

/** Lista pública "Querem adotar": só isto sai. */
export interface PublicSeeker {
  firstName: string | null;
  areaLabel: string;
  species: SeekerSpecies;
  sizes: PetSize[];
  ages: SeekerAge[];
}

/** Grupos de porte presentes na preferência (vazio = tanto faz). */
export function sizeGroupsOf(sizes: readonly PetSize[]): SeekerSizeGroup[] {
  return (Object.keys(SEEKER_SIZE_GROUPS) as SeekerSizeGroup[]).filter((g) => SEEKER_SIZE_GROUPS[g].some((s) => sizes.includes(s)));
}

/** "Cão · porte pequeno · filhote" (preferências legíveis). */
export function seekerPreferenceLabel(p: { species: SeekerSpecies; sizes: readonly PetSize[]; ages: readonly SeekerAge[] }): string {
  const species = p.species === "any" ? "Cão ou gato" : SEEKER_SPECIES_LABELS[p.species];
  const groups = sizeGroupsOf(p.sizes);
  const size = groups.length ? `porte ${groups.map((g) => SEEKER_SIZE_LABELS[g].toLowerCase()).join(" ou ")}` : "qualquer porte";
  const age = p.ages.length ? p.ages.map((a) => SEEKER_AGE_LABELS[a].toLowerCase()).join(" ou ") : "qualquer idade";
  return [species, size, age].join(" · ");
}

/** Combina com o anúncio? (espelho de private.notify_adoption_seekers, sem a distância). */
export function seekerMatchesListing(
  s: { species: SeekerSpecies; sizes: readonly PetSize[]; ages: readonly SeekerAge[] },
  a: { species: Species; size: PetSize | null; ageMonths: number | null },
): boolean {
  const band = ageBand(a.ageMonths);
  return (
    (s.species === "any" || s.species === a.species) &&
    (s.sizes.length === 0 || a.size === null || s.sizes.includes(a.size)) &&
    (s.ages.length === 0 || band === null || s.ages.includes(band))
  );
}
