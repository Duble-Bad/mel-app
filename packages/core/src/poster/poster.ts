import { breedLabel } from "../pet/breeds";
import { SEX_LABELS, SIZE_LABELS } from "../pet/pet";
import { formatBrPhone, formatDateTimeBr, type PublicLostCase } from "../lost/lost";

/** Formatos de cartaz. Tamanhos em pixels (PNG). */
export const POSTER_FORMATS = {
  square: { width: 1080, height: 1080, label: "Quadrado", hint: "Feed do Instagram/Facebook e WhatsApp" },
  story: { width: 1080, height: 1920, label: "Stories / Status", hint: "Stories do Instagram e Status do WhatsApp (9:16)" },
  // Feed do Instagram (4:5): usado pelo compartilhamento no Instagram.
  portrait: { width: 1080, height: 1350, label: "Feed 4:5", hint: "Feed do Instagram (4:5)" },
  landscape: { width: 1920, height: 1080, label: "Horizontal", hint: "Telas, grupos e Facebook (16:9)" },
  // Prévia do link (Open Graph) — não aparece na lista de downloads.
  og: { width: 1200, height: 630, label: "Prévia do link", hint: "" },
} as const;

export type PosterFormat = keyof typeof POSTER_FORMATS;
export const DOWNLOADABLE_FORMATS = ["square", "story", "landscape"] as const satisfies readonly PosterFormat[];

export const isPosterFormat = (v: string): v is PosterFormat => v in POSTER_FORMATS;

export interface PosterContent {
  headline: string;
  name: string;
  details: string;
  lastSeen: string | null;
  when: string | null;
  marks: string | null;
  /** Só existe se o tutor autorizou contato público no alerta. */
  contact: string | null;
  cta: string;
  /** O que fazer (só no PROCURA-SE): corresponde ao botão real da página do alerta. */
  action: string | null;
  code: string;
  /** Código do alerta para digitar quando não dá para escanear (maiúsculas: mais legível; a rota aceita). */
  displayCode: string;
  found: boolean;
}

/** Texto do botão da página do alerta que abre o formulário de avistamento. */
export const SIGHTING_BUTTON_LABEL = "Eu vi este pet";

const truncate = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** Texto do cartaz a partir do alerta público (nunca usa dados privados). */
export function posterContent(c: Pick<PublicLostCase, "status" | "pet" | "areaLabel" | "lostAt" | "contactWhatsapp" | "contactPhone" | "notes" | "code">): PosterContent {
  const found = c.status === "FOUND";
  const p = c.pet;
  const details = [
    p.breed ? breedLabel(p.breed) : null,
    p.sex !== "unknown" ? SEX_LABELS[p.sex] : null,
    p.size ? `Porte ${SIZE_LABELS[p.size].label.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const marks = [p.uniqueMarks, c.notes].filter(Boolean).join(" ");
  const phone = c.contactWhatsapp ?? c.contactPhone;
  return {
    headline: found ? "ENCONTRADO!" : "PROCURA-SE",
    name: p.name,
    details: details || (p.species === "cat" ? "Gato" : p.species === "dog" ? "Cachorro" : "Pet"),
    lastSeen: c.areaLabel ? `Visto por último: ${c.areaLabel}` : null,
    when: c.lostAt ? `Desde ${formatDateTimeBr(c.lostAt)}` : null,
    marks: marks ? truncate(marks, 140) : null,
    contact: phone ? `${c.contactWhatsapp ? "WhatsApp" : "Telefone"}: ${formatBrPhone(phone)}` : null,
    cta: found ? "Obrigado a todos que ajudaram!" : "VIU ESTE PET?",
    action: found ? null : `Escaneie o QR Code e toque em “${SIGHTING_BUTTON_LABEL}”.`,
    code: c.code,
    displayCode: c.code.toUpperCase(),
    found,
  };
}
