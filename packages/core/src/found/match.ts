import { distanceMeters, formatDistance, type LatLng } from "../geo/geo";
import { PET_SIZES, type PetSex, type PetSize, type Species } from "../pet/pet";

/**
 * Radar MEL v1 ("não sei" vale pouco, para relatos vagos não virarem alarme): pontuação heurística 0–100 entre um alerta de perdido e um
 * animal encontrado/visto. ESPELHO de private.match_score (SQL) — um teste de
 * banco confere a paridade. Mudou aqui? Mude lá (nova migração) e suba a versão.
 */
export const MATCH_ALGORITHM_VERSION = "v1";
export const MATCH_THRESHOLD = 50;
export const MATCH_MAX_DISTANCE_M = 10_000;

export interface MatchSide {
  species: Species;
  size: PetSize | null;
  sex: PetSex;
  colorPrimary: string | null;
  colorsSecondary: string[];
  breed: string | null;
  position: LatLng;
  /** Perdido: quando sumiu. Encontrado: quando foi encontrado/visto. */
  at: string;
}

export type MatchFacet = "same" | "close" | "partial" | "unknown" | "different";

export interface MatchReasons {
  distance_m: number;
  days: number;
  size: MatchFacet;
  sex: MatchFacet;
  color: MatchFacet;
  breed: MatchFacet;
}

export interface MatchResult {
  score: number;
  reasons: MatchReasons;
}

/** null = não é candidato (espécie diferente, longe demais ou tempo incompatível). */
export function computeMatchScore(lost: MatchSide, found: MatchSide): MatchResult | null {
  const d = distanceMeters(lost.position, found.position);
  const days = (new Date(found.at).getTime() - new Date(lost.at).getTime()) / 86_400_000;
  if (lost.species !== found.species || d > MATCH_MAX_DISTANCE_M || days < -1 || days > 60) return null;

  let score = Math.round(35 * (1 - d / MATCH_MAX_DISTANCE_M));
  score += Math.round(15 * Math.max(0, 1 - Math.max(days, 0) / 30));

  let size: MatchFacet;
  if (!lost.size || !found.size) {
    size = "unknown";
    score += 2;
  } else {
    const diff = Math.abs(PET_SIZES.indexOf(lost.size) - PET_SIZES.indexOf(found.size));
    size = diff === 0 ? "same" : diff === 1 ? "close" : "different";
    score += diff === 0 ? 15 : diff === 1 ? 7 : 0;
  }

  let sex: MatchFacet;
  if (lost.sex === "unknown" || found.sex === "unknown") {
    sex = "unknown";
    score += 2;
  } else if (lost.sex === found.sex) {
    sex = "same";
    score += 10;
  } else {
    sex = "different";
    score -= 15;
  }

  let color: MatchFacet;
  if (!lost.colorPrimary || !found.colorPrimary) {
    color = "unknown";
    score += 2;
  } else if (lost.colorPrimary === found.colorPrimary) {
    color = "same";
    score += 15;
  } else if (found.colorsSecondary.includes(lost.colorPrimary) || lost.colorsSecondary.includes(found.colorPrimary)) {
    color = "partial";
    score += 8;
  } else {
    color = "different";
  }

  let breed: MatchFacet;
  if (!lost.breed || !found.breed) {
    breed = "unknown";
    score += 1;
  } else if (lost.breed.trim().toLowerCase() === found.breed.trim().toLowerCase()) {
    breed = "same";
    score += 10;
  } else {
    breed = "different";
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reasons: { distance_m: Math.round(d), days: Math.round(days * 10) / 10, size, sex, color, breed },
  };
}

/** Motivos em linguagem humana para o MatchCard ("a 1,2 km", "mesmo porte"…). */
export function describeMatchReasons(r: MatchReasons): string[] {
  const out = [`a ${formatDistance(r.distance_m)} do último local`];
  if (r.days < 1) out.push("menos de 1 dia depois");
  else out.push(`${Math.round(r.days)} dia${Math.round(r.days) > 1 ? "s" : ""} depois`);
  if (r.size === "same") out.push("mesmo porte");
  else if (r.size === "close") out.push("porte parecido");
  if (r.sex === "same") out.push("mesmo sexo");
  if (r.color === "same") out.push("mesma cor");
  else if (r.color === "partial") out.push("cores parecidas");
  if (r.breed === "same") out.push("mesma raça");
  return out;
}

/** Sempre "possível": nunca afirmar que é o mesmo animal. */
export const matchLabel = (score: number) => `Possível correspondência · ${score}%`;

/** Uma correspondência como cada lado a vê (sem ponto exato nem dados privados). */
export interface MatchView {
  id: string;
  role: "owner" | "finder";
  score: number;
  reasons: MatchReasons;
  createdAt: string;
  lost: {
    code: string;
    status: string;
    petName: string;
    species: Species;
    breed: string | null;
    areaLabel: string | null;
    lostAt: string | null;
    contactChat: boolean;
    photoUrl: string | null;
  };
  found: {
    code: string;
    status: string;
    species: Species;
    breedGuess: string | null;
    size: PetSize | null;
    colorPrimary: string | null;
    areaLabel: string | null;
    foundAt: string;
    custody: string;
    photoUrl: string | null;
  };
}
