import { z } from "zod";
import type { LatLng } from "../geo/geo";

export const GUARDIAN_RADII_M = [1000, 3000, 5000, 10000] as const;
export type GuardianRadius = (typeof GUARDIAN_RADII_M)[number];
export const DAILY_LIMITS = [3, 5, 10] as const;

export interface GuardianSettings {
  enabled: boolean;
  /** Já aproximado (grade de 250 m) — o banco nunca guarda o ponto exato. */
  area: LatLng;
  areaLabel: string | null;
  radiusM: GuardianRadius;
  alertLost: boolean;
  alertFound: boolean;
  maxPerDay: number;
  quietNight: boolean;
}

export const guardianSettingsSchema = z
  .object({
    enabled: z.boolean().default(true),
    area: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }, {
      error: "Escolha a área que você quer proteger.",
    }),
    areaLabel: z.string().max(200).nullable().default(null),
    radiusM: z.union(GUARDIAN_RADII_M.map((r) => z.literal(r)) as [z.ZodLiteral<1000>, z.ZodLiteral<3000>, z.ZodLiteral<5000>, z.ZodLiteral<10000>]).default(3000),
    alertLost: z.boolean().default(true),
    alertFound: z.boolean().default(true),
    maxPerDay: z.number().int().min(1).max(20).default(5),
    quietNight: z.boolean().default(true),
  })
  .refine((s) => !s.enabled || s.alertLost || s.alertFound, {
    path: ["alertLost"],
    message: "Escolha pelo menos um tipo de aviso.",
  });

/**
 * Silêncio noturno (22h–7h no fuso informado): o aviso continua no app, mas o
 * celular não toca. Antispam do push.
 */
export function isQuietHour(at: Date, timeZone = "America/Sao_Paulo", startHour = 22, endHour = 7): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(at));
  return startHour > endHour ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
}

/** Corpo da notificação do sistema (service worker). Curto: o sistema corta textos longos. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export function pushPayload(n: { id: string; title: string; body: string; href: string }): PushPayload {
  const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
  return { title: clip(n.title, 70), body: clip(n.body, 140), url: n.href.startsWith("/") ? n.href : "/", tag: n.id };
}

export const radiusLabel = (m: number) => `${m / 1000} km`;
