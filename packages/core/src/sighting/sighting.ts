import { z } from "zod";
import type { LatLng } from "../geo/geo";

export const DIRECTIONS = ["N", "S", "E", "W", "unknown"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const DIRECTION_LABELS: Record<Direction, { label: string; arrow: string }> = {
  N: { label: "Norte", arrow: "↑" },
  S: { label: "Sul", arrow: "↓" },
  E: { label: "Leste", arrow: "→" },
  W: { label: "Oeste", arrow: "←" },
  unknown: { label: "Não sei", arrow: "?" },
};

export const SIGHTING_STATES = ["walking", "running", "stopped", "with_person", "injured", "scared", "other"] as const;
export type SightingState = (typeof SIGHTING_STATES)[number];
export const SIGHTING_STATE_LABELS: Record<SightingState, string> = {
  walking: "Andando",
  running: "Correndo",
  stopped: "Parado",
  with_person: "Com outra pessoa",
  injured: "Machucado",
  scared: "Assustado",
  other: "Outro",
};

/** "Quando você viu?" — atalhos rápidos; "outro" pede data e hora. */
export const SEEN_WHEN = ["now", "15min", "1h", "other"] as const;
export type SeenWhen = (typeof SEEN_WHEN)[number];
export const SEEN_WHEN_LABELS: Record<SeenWhen, string> = {
  now: "Agora",
  "15min": "Há uns 15 min",
  "1h": "Há mais ou menos 1 hora",
  other: "Outro horário",
};

export function seenAtFrom(choice: SeenWhen, other?: string, now: Date = new Date()): string | null {
  if (choice === "now") return now.toISOString();
  if (choice === "15min") return new Date(now.getTime() - 15 * 60_000).toISOString();
  if (choice === "1h") return new Date(now.getTime() - 60 * 60_000).toISOString();
  if (!other) return null;
  const d = new Date(other);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** O que o formulário "Eu vi este pet" envia (validado no navegador e de novo no servidor). */
export const sightingInputSchema = z.object({
  code: z.string().regex(/^[a-z2-9]{6}$/i, "Alerta inválido."),
  position: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }, {
    error: "Marque onde você viu o pet (use o GPS ou o mapa).",
  }),
  placeLabel: z.string().max(200).nullable().default(null),
  seenAt: z.iso.datetime({ offset: true, error: "Diga quando você viu." }),
  direction: z.enum(DIRECTIONS).default("unknown"),
  states: z.array(z.enum(SIGHTING_STATES)).max(SIGHTING_STATES.length).default([]),
  notes: z
    .string()
    .trim()
    .max(500, "Use no máximo 500 caracteres.")
    .transform((v) => v || null)
    .nullable()
    .default(null),
  photoPath: z.string().max(300).nullable().default(null),
});

export type SightingInput = z.output<typeof sightingInputSchema>;

/** Item da linha do tempo de um alerta. */
export interface TimelineSighting {
  id: string;
  seenAt: string;
  position: LatLng;
  placeLabel: string | null;
  direction: Direction;
  states: SightingState[];
  notes: string | null;
  photoUrl: string | null;
  hidden: boolean;
  mine: boolean;
}

/** Resumo curto de um avistamento ("Correndo, assustado · seguia para o Norte"). */
export function describeSighting(s: Pick<TimelineSighting, "states" | "direction">): string {
  const states = s.states.map((st) => SIGHTING_STATE_LABELS[st].toLowerCase()).join(", ");
  const dir = s.direction !== "unknown" ? `seguia para o ${DIRECTION_LABELS[s.direction].label}` : "";
  const text = [states, dir].filter(Boolean).join(" · ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Avistamento";
}
