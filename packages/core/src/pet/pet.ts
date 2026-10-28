import { z } from "zod";
import { BR_STATES, type BrState } from "../profile/profile";
import { isValidBreed, normalizeBreed } from "./breeds";

export const SPECIES = ["dog", "cat", "other"] as const;
export const PET_SEXES = ["male", "female", "unknown"] as const;
export const PET_SIZES = ["mini", "small", "medium", "large", "giant"] as const;

export type Species = (typeof SPECIES)[number];
export type PetSex = (typeof PET_SEXES)[number];
export type PetSize = (typeof PET_SIZES)[number];

export const SPECIES_LABELS: Record<Species, string> = { dog: "Cachorro", cat: "Gato", other: "Outro" };

export const SEX_LABELS: Record<PetSex, string> = { male: "Macho", female: "Fêmea", unknown: "Não sei" };

export const SIZE_LABELS: Record<PetSize, { label: string; hint: string }> = {
  mini: { label: "Mini", hint: "até 4 kg" },
  small: { label: "Pequeno", hint: "4 a 10 kg" },
  medium: { label: "Médio", hint: "10 a 25 kg" },
  large: { label: "Grande", hint: "25 a 45 kg" },
  giant: { label: "Gigante", hint: "mais de 45 kg" },
};

/**
 * Cores em vocabulário fechado: deixa o cadastro rápido e permite que o
 * Radar MEL compare "perdido" × "encontrado" sem depender de texto livre.
 */
export const PET_COLORS = [
  { id: "preto", label: "Preto" },
  { id: "branco", label: "Branco" },
  { id: "marrom", label: "Marrom" },
  { id: "caramelo", label: "Caramelo" },
  { id: "dourado", label: "Dourado" },
  { id: "creme", label: "Creme" },
  { id: "cinza", label: "Cinza" },
  { id: "laranja", label: "Laranja" },
  { id: "tigrado", label: "Tigrado" },
  { id: "malhado", label: "Malhado" },
  { id: "tricolor", label: "Tricolor" },
  { id: "outro", label: "Outra cor" },
] as const;

export type PetColor = (typeof PET_COLORS)[number]["id"];
const COLOR_IDS = PET_COLORS.map((c) => c.id) as [PetColor, ...PetColor[]];

export const colorLabel = (id: string | null | undefined) => PET_COLORS.find((c) => c.id === id)?.label ?? id ?? "";

/** Opções de idade aproximada (em meses) para quem não sabe a data de nascimento. */
export const AGE_OPTIONS = [
  { months: 3, label: "Filhote (menos de 6 meses)" },
  { months: 9, label: "Entre 6 meses e 1 ano" },
  { months: 18, label: "1 a 2 anos" },
  { months: 36, label: "3 anos" },
  { months: 60, label: "4 a 6 anos" },
  { months: 96, label: "7 a 9 anos" },
  { months: 132, label: "10 a 12 anos" },
  { months: 168, label: "13 anos ou mais" },
] as const;

export interface PetPhoto {
  id: string;
  url: string;
  thumbUrl: string;
  isPrimary: boolean;
  position: number;
}

export interface Pet {
  id: string;
  ownerId: string;
  melId: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: PetSex;
  birthDate: string | null;
  ageEstimateMonths: number | null;
  size: PetSize | null;
  weightKg: number | null;
  colorPrimary: PetColor | null;
  colorsSecondary: PetColor[];
  description: string | null;
  uniqueMarks: string | null;
  neutered: boolean | null;
  hasMicrochip: boolean | null;
  city: string | null;
  state: BrState | null;
  isPublic: boolean;
  photos: PetPhoto[];
}

export interface PetPrivateDetails {
  microchipNumber: string | null;
  hiddenMarks: string | null;
  ownershipNotes: string | null;
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const UFS = BR_STATES.map((s) => s.uf) as [BrState, ...BrState[]];

/**
 * Cadastro de pet. Só nome e espécie são obrigatórios: no fluxo
 * "Perdi meu pet" o tutor precisa cadastrar em segundos e completar depois.
 */
export const petInputSchema = z
  .object({
    name: z.string().trim().min(1, "Qual é o nome do seu pet?").max(60, "Use no máximo 60 caracteres."),
    species: z.enum(SPECIES, { error: "Escolha cachorro, gato ou outro." }),
    breed: optionalText(80, "Use no máximo 80 caracteres.").transform(normalizeBreed),
    sex: z.enum(PET_SEXES).default("unknown"),
    birthDate: z.iso
      .date("Data inválida.")
      .refine((d) => d <= new Date().toISOString().slice(0, 10), "A data não pode estar no futuro.")
      .nullable()
      .default(null),
    ageEstimateMonths: z.number().int().min(0).max(360).nullable().default(null),
    size: z.enum(PET_SIZES).nullable().default(null),
    weightKg: z
      .number({ error: "Informe o peso em kg, por exemplo 3,5." })
      .gt(0, "O peso precisa ser maior que zero.")
      .lt(150, "Confira o peso.")
      .nullable()
      .default(null),
    colorPrimary: z.enum(COLOR_IDS).nullable().default(null),
    colorsSecondary: z.array(z.enum(COLOR_IDS)).max(5, "Escolha até 5 cores.").default([]),
    description: optionalText(1000, "Use no máximo 1000 caracteres."),
    uniqueMarks: optionalText(500, "Use no máximo 500 caracteres."),
    neutered: z.boolean().nullable().default(null),
    hasMicrochip: z.boolean().nullable().default(null),
    city: optionalText(80, "Use no máximo 80 caracteres."),
    state: z.enum(UFS).nullable().default(null),
    isPublic: z.boolean().default(false),
  })
  .superRefine((pet, ctx) => {
    if (pet.breed && !isValidBreed(pet.species, pet.breed)) {
      ctx.addIssue({ code: "custom", path: ["breed"], message: "Escolha uma raça da lista ou “Sem raça definida”." });
    }
  })
  .transform((pet) => ({
    ...pet,
    // A cor principal não se repete nas secundárias.
    colorsSecondary: [...new Set(pet.colorsSecondary)].filter((c) => c !== pet.colorPrimary),
  }));

export type PetInput = z.output<typeof petInputSchema>;
export type PetFormValues = z.input<typeof petInputSchema>;

export const petPrivateInputSchema = z.object({
  microchipNumber: optionalText(30, "Use no máximo 30 caracteres."),
  hiddenMarks: optionalText(500, "Use no máximo 500 caracteres."),
  ownershipNotes: optionalText(1000, "Use no máximo 1000 caracteres."),
});

export type PetPrivateInput = z.output<typeof petPrivateInputSchema>;

/** Converte "3,5" ou "3.5" em número; vazio vira null. */
export function parseDecimal(value: string | null | undefined): number | null {
  if (!value || !value.trim()) return null;
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Idade em texto humano a partir da data de nascimento ou da estimativa. */
export function describeAge(
  pet: Pick<Pet, "birthDate" | "ageEstimateMonths">,
  today: Date = new Date(),
): string | null {
  let months: number | null = pet.ageEstimateMonths;
  let approximate = true;
  if (pet.birthDate) {
    const birth = new Date(`${pet.birthDate}T12:00:00`);
    months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (today.getDate() < birth.getDate()) months -= 1;
    approximate = false;
  }
  if (months == null || months < 0) return null;
  const prefix = approximate ? "cerca de " : "";
  if (months < 1) return approximate ? "filhote" : "menos de 1 mês";
  if (months < 12) return `${prefix}${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${prefix}${years} ${years === 1 ? "ano" : "anos"}`;
}

/** "Cachorro · Yorkshire Terrier · Fêmea · Mini" — resumo usado em cards e cartazes. */
export function petSummary(pet: Pick<Pet, "species" | "breed" | "sex" | "size">): string {
  return [
    SPECIES_LABELS[pet.species],
    // No resumo compacto, "SRD" basta; o rótulo longo aparece na página do pet.
    pet.breed,
    pet.sex !== "unknown" ? SEX_LABELS[pet.sex] : null,
    pet.size ? SIZE_LABELS[pet.size].label : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const primaryPhoto = (pet: Pick<Pet, "photos">): PetPhoto | undefined =>
  pet.photos.find((p) => p.isPrimary) ?? pet.photos[0];

/** Valida o formato MEL-XXXXXX (sem caracteres ambíguos). */
export const isMelId = (value: string) => /^MEL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(value);

export const MAX_PET_PHOTOS = 6;
