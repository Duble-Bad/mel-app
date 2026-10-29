import { z } from "zod";
import { PET_COLORS, PET_SEXES, PET_SIZES, SPECIES, type PetColor, type PetSex, type PetSize, type Species } from "../pet/pet";
import type { LatLng } from "../geo/geo";

export const ADOPTION_STATUSES = ["PENDING_REVIEW", "AVAILABLE", "IN_PROCESS", "ADOPTED", "REJECTED", "REMOVED"] as const;
export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];

export const ADOPTION_STATUS_LABELS: Record<AdoptionStatus, string> = {
  PENDING_REVIEW: "Em análise",
  AVAILABLE: "Disponível",
  IN_PROCESS: "Em processo de adoção",
  ADOPTED: "Adotado",
  REJECTED: "Não aprovado",
  REMOVED: "Removido",
};

export const TEMPERAMENTS = ["docil", "brincalhao", "calmo", "ativo", "timido", "caes", "gatos", "criancas"] as const;
export type Temperament = (typeof TEMPERAMENTS)[number];
export const TEMPERAMENT_LABELS: Record<Temperament, string> = {
  docil: "Dócil",
  brincalhao: "Brincalhão",
  calmo: "Calmo",
  ativo: "Cheio de energia",
  timido: "Tímido no começo",
  caes: "Convive com cães",
  gatos: "Convive com gatos",
  criancas: "Convive com crianças",
};

export const HOUSING = ["house", "apartment", "other"] as const;
export type Housing = (typeof HOUSING)[number];
export const HOUSING_LABELS: Record<Housing, string> = { house: "Casa", apartment: "Apartamento", other: "Outro" };

const colorIds = PET_COLORS.map((c) => c.id) as [PetColor, ...PetColor[]];
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((v) => v || null)
    .nullable()
    .default(null);

export const adoptionInputSchema = z.object({
  name: z.string().trim().min(1, "Qual é o nome dele?").max(60, "Use até 60 caracteres."),
  species: z.enum(SPECIES, { error: "Diga se é cachorro, gato ou outro." }),
  sex: z.enum(PET_SEXES).default("unknown"),
  size: z.enum(PET_SIZES).nullable().default(null),
  ageMonths: z.number().int().min(0).max(360).nullable().default(null),
  breed: optionalText(80),
  colorPrimary: z.enum(colorIds).nullable().default(null),
  temperament: z.array(z.enum(TEMPERAMENTS)).max(8).default([]),
  neutered: z.boolean().nullable().default(null),
  vaccinated: z.boolean().nullable().default(null),
  dewormed: z.boolean().nullable().default(null),
  description: z.string().trim().min(20, "Conte um pouco mais sobre ele (pelo menos 20 caracteres).").max(1500, "Use até 1500 caracteres."),
  requirements: optionalText(500),
  position: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }, { error: "Marque a região onde ele está." }),
  areaLabel: z.string().max(200).nullable().default(null),
  photoPaths: z.array(z.string().max(300)).min(1, "Adicione pelo menos uma foto.").max(4, "Use até 4 fotos."),
});
export type AdoptionInput = z.output<typeof adoptionInputSchema>;

export const interestSchema = z.object({
  housing: z.enum(HOUSING, { error: "Conte onde você mora." }),
  otherPets: z.boolean({ error: "Diga se já tem outros pets." }),
  children: z.boolean({ error: "Diga se há crianças em casa." }),
  message: z.string().trim().min(10, "Conte um pouco sobre você (pelo menos 10 caracteres).").max(1000, "Use até 1000 caracteres."),
});
export type InterestInput = z.output<typeof interestSchema>;

export interface PublicAdoption {
  code: string;
  status: AdoptionStatus;
  name: string;
  species: Species;
  sex: PetSex;
  size: PetSize | null;
  ageMonths: number | null;
  breed: string | null;
  colorPrimary: PetColor | null;
  temperament: Temperament[];
  neutered: boolean | null;
  vaccinated: boolean | null;
  dewormed: boolean | null;
  description: string;
  requirements: string | null;
  areaLabel: string | null;
  photoUrls: string[];
  publishedAt: string | null;
  isOwner: boolean;
  reviewNote: string | null;
  /** Só para quem doa. */
  interests: number | null;
}

/** "Filhote (4 meses)", "2 anos", "Idade não informada". */
export function ageLabel(months: number | null): string {
  if (months == null) return "Idade não informada";
  if (months < 12) return months <= 1 ? "Filhote (1 mês)" : `Filhote (${months} meses)`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 ano" : `${years} anos`;
}

export type AdoptionPlace = LatLng;
