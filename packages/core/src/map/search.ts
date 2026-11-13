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

export const RADII_KM = [1, 3, 5, 10, 25, 50] as const;
/** "Toda a rede": sem limite de distância (no endereço, `raio=todos`; o banco recebe 0). Ordena pelo mais perto. */
export const RADIUS_ALL = 0 as const;
export type RadiusKm = (typeof RADII_KM)[number] | typeof RADIUS_ALL;
export const RADIUS_ALL_LABEL = "Toda a rede";

/** Texto do alcance da busca: "em até 10 km" ou "em toda a rede". */
export const radiusPhrase = (r: RadiusKm) => (r === RADIUS_ALL ? "em toda a rede" : `em até ${r} km`);
/** Rótulo curto: "até 10 km" ou "toda a rede". */
export const radiusShort = (r: RadiusKm) => (r === RADIUS_ALL ? "toda a rede" : `até ${r} km`);
/** Metros para o banco (0 = sem limite). */
export const radiusMeters = (r: RadiusKm) => r * 1000;

/** Nome do lugar escolhido na busca por cidade/bairro (no endereço, `local=`): curto e sem marcação. */
const cleanPlace = (s: string | undefined) => (s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);

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
  /** true quando o centro veio da pessoa (GPS/mapa/busca), não do padrão. */
  hasCenter: boolean;
  /** Nome do lugar quando o centro veio da busca por cidade/bairro ("Ferraz de Vasconcelos – SP"). */
  place?: string;
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
  const radiusParam = first(params.raio);
  const radiusRaw = Number(radiusParam);
  const radiusKm: RadiusKm = radiusParam === "todos" ? RADIUS_ALL : (RADII_KM as readonly number[]).includes(radiusRaw) ? (radiusRaw as RadiusKm) : 5;
  const lat = Number(first(params.lat));
  const lng = Number(first(params.lng));
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && first(params.lat) !== undefined;
  const page = Math.max(1, Math.min(100, Math.floor(Number(first(params.pagina)) || 1)));
  return {
    kinds: kinds.length ? kinds : [...PUBLIC_KINDS],
    species,
    period,
    radiusKm,
    center: hasCenter ? { lat: roundCenter(lat), lng: roundCenter(lng) } : DEFAULT_CENTER,
    hasCenter,
    ...(hasCenter && cleanPlace(first(params.local)) ? { place: cleanPlace(first(params.local)) } : {}),
    page,
  };
}

// Centro da busca no endereço com 3 casas (~110 m, a mesma ordem da grade pública de
// 100 m): o link compartilhado de "Perto de mim" não revela onde a pessoa está.
const roundCenter = (n: number) => Math.round(n * 1e3) / 1e3;

/** Filtros → query string (só o que difere do padrão, para links curtos). */
export function toSearchParams(f: SearchFilters, fixedKinds?: PublicKind[]): string {
  const p = new URLSearchParams();
  if (!fixedKinds && f.kinds.length !== PUBLIC_KINDS.length) p.set("tipos", f.kinds.join(","));
  if (f.species.length) p.set("especie", f.species.join(","));
  if (f.period !== "30d") p.set("periodo", f.period);
  if (f.radiusKm !== 5) p.set("raio", f.radiusKm === RADIUS_ALL ? "todos" : String(f.radiusKm));
  if (f.hasCenter) {
    p.set("lat", String(roundCenter(f.center.lat)));
    p.set("lng", String(roundCenter(f.center.lng)));
    const place = cleanPlace(f.place);
    if (place) p.set("local", place);
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
  /** Miniatura da capa (cartões e listas). */
  photoUrl: string | null;
  /** Mesma foto em tamanho normal (gaveta do mapa); sem ela, usa a miniatura. */
  photoFullUrl?: string | null;
  /** Ponto de foco da capa ajustado pelo tutor (0–100, em %); null = centro. */
  photoFocus?: PhotoFocus | null;
  areaLabel: string | null;
  at: string;
  position: LatLng;
  distanceM: number;
}

export interface PhotoFocus {
  x: number;
  y: number;
}

/** object-position para o recorte da foto (centro quando não há foco). */
export const focusPosition = (f?: PhotoFocus | null) => (f ? `${f.x}% ${f.y}%` : undefined);

export const itemHref = (i: Pick<PublicCaseItem, "kind" | "code">) => (i.kind === "lost" ? `/alerta/${i.code}` : `/encontrado/${i.code}`);

/** "Mel", "Cachorro encontrado", "Gato visto solto". */
export function itemTitle(i: Pick<PublicCaseItem, "kind" | "title" | "species">): string {
  if (i.kind === "lost" && i.title) return i.title;
  const s = SPECIES_LABELS[i.species];
  return i.kind === "sighting" ? `${s} visto solto` : `${s} encontrado`;
}
