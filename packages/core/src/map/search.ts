import type { LatLng } from "../geo/geo";
import { SPECIES, SPECIES_LABELS, type PetSize, type Species } from "../pet/pet";

/** O que aparece no mapa/listas públicos. */
export const PUBLIC_KINDS = ["lost", "found", "sighting"] as const;
export type PublicKind = (typeof PUBLIC_KINDS)[number];

export const PUBLIC_KIND_LABELS: Record<PublicKind, string> = {
  lost: "Perdidos",
  found: "Encontrados",
  sighting: "Vistos soltos",
};

export const PERIODS = ["24h", "7d", "30d", "todos"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABELS: Record<Period, string> = { "24h": "24 horas", "7d": "7 dias", "30d": "30 dias", todos: "Qualquer data" };
const PERIOD_DAYS: Record<Period, number | null> = { "24h": 1, "7d": 7, "30d": 30, todos: null };

export const RADII_KM = [1, 3, 5, 10] as const;
export type RadiusKm = (typeof RADII_KM)[number];

/** Sem localização da pessoa: Praça da Sé (centro de São Paulo, local público). */
export const DEFAULT_CENTER: LatLng = { lat: -23.55052, lng: -46.633308 };
export const DEFAULT_CENTER_LABEL = "centro de São Paulo";
export const PAGE_SIZE = 12;

export interface SearchFilters {
  kinds: PublicKind[];
  species: Species[];
  period: Period;
  radiusKm: RadiusKm;
  center: LatLng;
  /** true quando o centro veio da pessoa (GPS/mapa), não do padrão. */
  hasCenter: boolean;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => (first(v) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Lê os filtros do endereço (?tipos=lost,found&especie=dog&periodo=7d&raio=5&lat=..&lng=..&pagina=2).
 * Valores inválidos viram o padrão — nunca erro na tela. `fixedKinds` = página com tipo fixo (/perdidos).
 */
export function parseSearchParams(params: Params, fixedKinds?: PublicKind[]): SearchFilters {
  const kinds = fixedKinds ?? (list(params.tipos).filter((k): k is PublicKind => (PUBLIC_KINDS as readonly string[]).includes(k)));
  const species = list(params.especie).filter((s): s is Species => (SPECIES as readonly string[]).includes(s));
  const periodRaw = first(params.periodo);
  const period = (PERIODS as readonly string[]).includes(periodRaw ?? "") ? (periodRaw as Period) : "30d";
  const radiusRaw = Number(first(params.raio));
  const radiusKm = (RADII_KM as readonly number[]).includes(radiusRaw) ? (radiusRaw as RadiusKm) : 5;
  const lat = Number(first(params.lat));
  const lng = Number(first(params.lng));
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && first(params.lat) !== undefined;
  const page = Math.max(1, Math.min(100, Math.floor(Number(first(params.pagina)) || 1)));
  return {
    kinds: kinds.length ? kinds : [...PUBLIC_KINDS],
    species,
    period,
    radiusKm,
    center: hasCenter ? { lat: round5(lat), lng: round5(lng) } : DEFAULT_CENTER,
    hasCenter,
    page,
  };
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Filtros → query string (só o que difere do padrão, para links curtos). */
export function toSearchParams(f: SearchFilters, fixedKinds?: PublicKind[]): string {
  const p = new URLSearchParams();
  if (!fixedKinds && f.kinds.length !== PUBLIC_KINDS.length) p.set("tipos", f.kinds.join(","));
  if (f.species.length) p.set("especie", f.species.join(","));
  if (f.period !== "30d") p.set("periodo", f.period);
  if (f.radiusKm !== 5) p.set("raio", String(f.radiusKm));
  if (f.hasCenter) {
    p.set("lat", String(round5(f.center.lat)));
    p.set("lng", String(round5(f.center.lng)));
  }
  if (f.page > 1) p.set("pagina", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function sinceFrom(period: Period, now: Date = new Date()): string | null {
  const days = PERIOD_DAYS[period];
  return days == null ? null : new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** Item do mapa/lista público (ponto aproximado). */
export interface PublicCaseItem {
  kind: PublicKind;
  code: string;
  /** Nome do pet (perdido); null para encontrados/vistos. */
  title: string | null;
  species: Species;
  breed: string | null;
  size: PetSize | null;
  colorPrimary: string | null;
  photoUrl: string | null;
  areaLabel: string | null;
  at: string;
  position: LatLng;
  distanceM: number;
}

export const itemHref = (i: Pick<PublicCaseItem, "kind" | "code">) => (i.kind === "lost" ? `/alerta/${i.code}` : `/encontrado/${i.code}`);

/** "Mel", "Cachorro encontrado", "Gato visto solto". */
export function itemTitle(i: Pick<PublicCaseItem, "kind" | "title" | "species">): string {
  if (i.kind === "lost" && i.title) return i.title;
  const s = SPECIES_LABELS[i.species];
  return i.kind === "sighting" ? `${s} visto solto` : `${s} encontrado`;
}
