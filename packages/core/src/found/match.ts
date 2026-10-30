import { distanceMeters, type LatLng } from "../geo/geo";
import { PET_SIZES, type PetSex, type PetSize, type Species } from "../pet/pet";

/**
 * Radar MEL v2 ("não sei" vale pouco, para relatos vagos não virarem alarme): pontuação heurística 0–100 entre um alerta de perdido e um
 * animal encontrado/visto. ESPELHO de private.match_score (SQL) — um teste de
 * banco confere a paridade. Mudou aqui? Mude lá (nova migração) e suba a versão.
 *
 * PRIVACIDADE: as posições são os pontos PÚBLICOS (centro da célula de 250 m),
 * nunca os exatos; a distância sai só como faixa e a pontuação usa um degrau
 * por faixa — nada aqui permite reconstruir um ponto privado.
 */
export const MATCH_ALGORITHM_VERSION = "v2";
export const MATCH_THRESHOLD = 50;
export const MATCH_MAX_DISTANCE_M = 10_000;

/** Faixas de distância entre os pontos públicos (o Radar nunca devolve metros). */
export type MatchDistanceBand = "NEAR" | "MEDIUM" | "AREA";

export function matchDistanceBand(meters: number): MatchDistanceBand {
  return meters <= 1_000 ? "NEAR" : meters <= 3_000 ? "MEDIUM" : "AREA";
}

const BAND_POINTS: Record<MatchDistanceBand, number> = { NEAR: 35, MEDIUM: 22, AREA: 10 };

export interface MatchSide {
  species: Species;
  size: PetSize | null;
  sex: PetSex;
  colorPrimary: string | null;
  colorsSecondary: string[];
  breed: string | null;
  /** Ponto PÚBLICO (aproximado) do alerta ou da publicação. */
  position: LatLng;
  /** Perdido: quando sumiu. Encontrado: quando foi encontrado/visto. */
  at: string;
}

export type MatchFacet = "same" | "close" | "partial" | "unknown" | "different";

export interface MatchReasons {
  distance: MatchDistanceBand;
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

  const distance = matchDistanceBand(d);
  let score = BAND_POINTS[distance];
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
    reasons: { distance, days: Math.round(days * 10) / 10, size, sex, color, breed },
  };
}

const BAND_TEXT: Record<MatchDistanceBand, string> = {
  NEAR: "muito perto do último local",
  MEDIUM: "perto do último local",
  AREA: "na mesma região",
};

/** Motivos em linguagem humana para o MatchCard ("muito perto do último local", "mesmo porte"…). */
export function describeMatchReasons(r: MatchReasons): string[] {
  const out = [BAND_TEXT[r.distance] ?? BAND_TEXT.AREA];
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
