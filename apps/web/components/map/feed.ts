import {
  ageLabel,
  colorLabel,
  itemHref,
  itemTitle,
  PET_SIZES,
  PUBLIC_KINDS,
  SEX_LABELS,
  SIZE_LABELS,
  SPECIES_LABELS,
  timeAgo,
  toSearchParams,
  type PetSize,
  type PublicAdoption,
  type PublicCaseItem,
  type PublicKind,
  type SearchFilters,
} from "@mel/core";

// Filtros do mapa e do mural além dos de @mel/core: o tipo "Adoção" (que não
// passa pela busca de casos) e o porte. Ficam no endereço, como os demais:
//   ?tipos=adocao  → só anúncios de adoção
//   ?porte=medium  → porte (casos e adoção)

/** Um tipo por vez, como no protótipo: Todos, Perdidos, Encontrados, Vistos, Adoção. */
export type FeedKind = "all" | PublicKind | "adoption";

export const FEED_KINDS: { value: FeedKind; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "lost", label: "Perdidos" },
  { value: "found", label: "Encontrados" },
  { value: "sighting", label: "Vistos" },
  { value: "adoption", label: "Adoção" },
];

export interface FeedState {
  filters: SearchFilters;
  feed: FeedKind;
  size: PetSize | null;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lê o tipo e o porte do endereço (os demais filtros vêm de parseSearchParams). */
export function parseFeed(params: Params, filters: SearchFilters): Omit<FeedState, "filters"> {
  const tipos = first(params.tipos);
  const porte = first(params.porte);
  const size = (PET_SIZES as readonly string[]).includes(porte ?? "") ? (porte as PetSize) : null;
  if (tipos === "adocao") return { feed: "adoption", size };
  return { feed: filters.kinds.length === 1 ? filters.kinds[0]! : "all", size };
}

/** Os tipos de caso a buscar para um tipo do filtro (adoção não busca casos). */
export const kindsFor = (feed: FeedKind): PublicKind[] => (feed === "all" || feed === "adoption" ? [...PUBLIC_KINDS] : [feed]);

/** Estado → query string. Mantém o formato de toSearchParams (links antigos continuam valendo). */
export function feedQuery({ filters, feed, size }: FeedState): string {
  const p = new URLSearchParams(toSearchParams({ ...filters, kinds: kindsFor(feed) }).slice(1));
  if (feed === "adoption") p.set("tipos", "adocao");
  if (size) p.set("porte", size);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const includesAdoption = (feed: FeedKind) => feed === "all" || feed === "adoption";
export const includesCases = (feed: FeedKind) => feed !== "adoption";

export type EntryKind = PublicKind | "adoption";

/** Rótulo do selo (singular, como no protótipo). */
export const KIND_BADGE: Record<EntryKind, string> = { lost: "Perdido", found: "Encontrado", sighting: "Visto", adoption: "Adoção" };

/**
 * Caso ou anúncio de adoção num formato só, para cartões, lista do mapa e gaveta.
 * Tudo aqui já é público (área aproximada, nunca endereço ou telefone).
 */
export interface FeedEntry {
  id: string;
  kind: EntryKind;
  href: string;
  title: string;
  photoUrl: string | null;
  areaLabel: string | null;
  /** "a 1,2 km daqui" (só casos: adoção não tem ponto público). */
  distanceM: number | null;
  /** Linha de tempo do cartão: "Sumiu há 2 dias", "2 anos · Porte médio". */
  when: string;
  /** Data para ordenar e para "há quanto tempo" na gaveta. */
  at: string | null;
  facts: { label: string; value: string }[];
  description: string | null;
  /** Ponto público aproximado (grade de ~100 m); null = fica só na lista. */
  position: PublicCaseItem["position"] | null;
}

const VERB: Record<PublicKind, string> = { lost: "Sumiu", found: "Encontrado", sighting: "Visto" };

export function caseEntry(i: PublicCaseItem): FeedEntry {
  const facts = [
    { label: "Espécie", value: SPECIES_LABELS[i.species] },
    { label: "Raça", value: i.breed ?? "" },
    { label: "Porte", value: i.size ? SIZE_LABELS[i.size].label : "" },
    { label: "Cor", value: i.colorPrimary ? colorLabel(i.colorPrimary) : "" },
  ].filter((f) => f.value);
  return {
    id: `${i.kind}-${i.code}`,
    kind: i.kind,
    href: itemHref(i),
    title: itemTitle(i),
    photoUrl: i.photoUrl,
    areaLabel: i.areaLabel,
    distanceM: i.distanceM,
    when: `${VERB[i.kind]} ${timeAgo(i.at)}`,
    at: i.at,
    facts,
    description: null,
    position: i.position,
  };
}

export function adoptionEntry(a: PublicAdoption): FeedEntry {
  const facts = [
    { label: "Espécie", value: SPECIES_LABELS[a.species] },
    { label: "Sexo", value: a.sex !== "unknown" ? SEX_LABELS[a.sex] : "" },
    { label: "Porte", value: a.size ? SIZE_LABELS[a.size].label : "" },
    { label: "Idade", value: a.ageMonths != null ? ageLabel(a.ageMonths) : "" },
    { label: "Raça", value: a.breed ?? "" },
    { label: "Cor", value: a.colorPrimary ? colorLabel(a.colorPrimary) : "" },
  ].filter((f) => f.value);
  return {
    id: `adoption-${a.code}`,
    kind: "adoption",
    href: `/adocao/${a.code}`,
    title: a.name,
    photoUrl: a.photoUrls[0] ?? null,
    areaLabel: a.areaLabel,
    distanceM: null,
    when: [ageLabel(a.ageMonths), a.size && `Porte ${SIZE_LABELS[a.size].label.toLowerCase()}`].filter(Boolean).join(" · "),
    at: a.publishedAt,
    facts,
    description: a.description,
    // A listagem pública de adoção não traz ponto (nem aproximado): só na lista.
    position: null,
  };
}
