import { z } from "zod";
import { PET_COLORS, PET_SEXES, PET_SIZES, SPECIES, type PetColor, type PetSex, type PetSize, type Species } from "../pet/pet";
import type { LatLng } from "../geo/geo";

export const FOUND_CUSTODY = ["with_me", "safe_place", "clinic", "street", "other"] as const;
export type FoundCustody = (typeof FOUND_CUSTODY)[number];

export const FOUND_CUSTODY_LABELS: Record<FoundCustody, string> = {
  with_me: "Está comigo",
  safe_place: "Em um local seguro",
  clinic: "Em uma clínica ou abrigo",
  street: "Continua na rua",
  other: "Outro",
};

/** Frase pública ("Está com quem encontrou", "Foi visto solto na rua"…). */
export const FOUND_CUSTODY_PUBLIC: Record<FoundCustody, string> = {
  with_me: "Está com quem encontrou",
  safe_place: "Está em um local seguro",
  clinic: "Está em uma clínica ou abrigo",
  street: "Foi visto solto na rua",
  other: "Situação informada por quem encontrou",
};

export const FOUND_STATUSES = ["ACTIVE", "REUNITED", "CLOSED", "REMOVED"] as const;
export type FoundStatus = (typeof FOUND_STATUSES)[number];

const colorIds = PET_COLORS.map((c) => c.id) as [PetColor, ...PetColor[]];
const optionalText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .transform((v) => v || null)
    .nullable()
    .default(null);

/** O que o assistente "Encontrei um pet" envia (validado no navegador e no servidor). */
export const foundInputSchema = z.object({
  species: z.enum(SPECIES, { error: "Diga se é cachorro, gato ou outro." }),
  size: z.enum(PET_SIZES).nullable().default(null),
  sex: z.enum(PET_SEXES).default("unknown"),
  colorPrimary: z.enum(colorIds).nullable().default(null),
  colorsSecondary: z.array(z.enum(colorIds)).max(5).default([]),
  breedGuess: optionalText(80, "Use até 80 caracteres."),
  description: optionalText(500, "Use até 500 caracteres."),
  position: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }, {
    error: "Marque no mapa onde você encontrou.",
  }),
  areaLabel: z.string().max(200).nullable().default(null),
  foundAt: z.iso.datetime({ offset: true, error: "Diga quando foi." }),
  custody: z.enum(FOUND_CUSTODY, { error: "Conte onde ele está agora." }),
  custodyNotes: optionalText(300, "Use até 300 caracteres."),
  verificationHint: optionalText(200, "Use até 200 caracteres."),
  photoPath: z.string().max(300).nullable().default(null),
});
export type FoundInput = z.output<typeof foundInputSchema>;

/** Página pública do encontrado (sem ponto exato; prova de posse só para quem publicou). */
export interface PublicFoundCase {
  code: string;
  status: FoundStatus;
  species: Species;
  breedGuess: string | null;
  sex: PetSex;
  size: PetSize | null;
  colorPrimary: PetColor | null;
  colorsSecondary: PetColor[];
  description: string | null;
  point: LatLng | null;
  areaLabel: string | null;
  foundAt: string;
  custody: FoundCustody;
  photoUrl: string | null;
  isReporter: boolean;
  /** Só para quem publicou. */
  verificationHint: string | null;
}

export const foundPath = (code: string) => `/encontrado/${code}`;
