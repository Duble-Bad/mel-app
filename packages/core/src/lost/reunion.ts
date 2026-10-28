import { z } from "zod";

export const FOUND_HOW = ["came_back", "sighting_mel", "found_mel", "neighbor", "clinic_shelter", "other"] as const;
export type FoundHow = (typeof FOUND_HOW)[number];

export const FOUND_HOW_LABELS: Record<FoundHow, string> = {
  came_back: "Voltou por conta própria",
  sighting_mel: "Alguém viu pelo MEL",
  found_mel: "Alguém encontrou pelo MEL",
  neighbor: "Vizinho ou conhecido",
  clinic_shelter: "Clínica ou abrigo",
  other: "Outro jeito",
};

/** Frase pública, sem gênero (o pet pode não ter sexo informado). */
export const FOUND_HOW_PUBLIC: Record<FoundHow, string> = {
  came_back: "voltou para casa por conta própria",
  sighting_mel: "voltou para casa graças a um avistamento na MEL",
  found_mel: "voltou para casa com a ajuda de alguém da rede MEL",
  neighbor: "voltou para casa com a ajuda de um vizinho ou conhecido",
  clinic_shelter: "estava em uma clínica ou abrigo",
  other: "voltou para casa",
};

export const reunionSchema = z.object({
  how: z.enum(FOUND_HOW, { error: "Conte como foi o reencontro." }),
  helpfulSightingId: z.uuid().nullable().default(null),
  foundAreaLabel: z
    .string()
    .trim()
    .max(120, "Use até 120 caracteres.")
    .transform((v) => v || null)
    .nullable()
    .default(null),
  story: z
    .string()
    .trim()
    .max(2000, "A história pode ter até 2000 caracteres.")
    .transform((v) => v || null)
    .nullable()
    .default(null),
});
export type ReunionInput = z.infer<typeof reunionSchema>;

/** "1 pessoa ajudou" / "12 pessoas ajudaram" (null/0 → null). */
export function helpersLine(count: number | null | undefined): string | null {
  if (!count) return null;
  return count === 1 ? "1 pessoa ajudou nesta busca" : `${count} pessoas ajudaram nesta busca`;
}
