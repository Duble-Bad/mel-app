import { BR_STATES, type BrState } from "../profile/profile";
import { distanceMeters, isValidLatLng, type LatLng } from "../geo/geo";
import type { GeocodeResult, Geocoder } from "../ports";

/**
 * Geocoder do MapTiler (busca de endereço e endereço de um ponto).
 * Formato real das respostas no Brasil (ver __fixtures__):
 *   municipality → cidade · subregion → estado · region → macrorregião (ignorada)
 *   municipal_district / place → bairro
 */

interface MapTilerContext {
  id: string;
  text: string;
}

export interface MapTilerFeature {
  id: string;
  text: string;
  place_name?: string;
  place_type: string[];
  center: [number, number];
  relevance?: number;
  context?: MapTilerContext[];
}

interface MapTilerResponse {
  features?: MapTilerFeature[];
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export function ufFromStateName(name: string | undefined): BrState | undefined {
  if (!name) return undefined;
  return BR_STATES.find((s) => fold(s.name) === fold(name))?.uf;
}

const layer = (id: string) => id.split(".")[0] ?? "";

function pick(feature: MapTilerFeature, ...layers: string[]): string | undefined {
  for (const l of layers) {
    if (feature.place_type.includes(l)) return feature.text;
    const ctx = feature.context?.find((c) => layer(c.id) === l);
    if (ctx) return ctx.text;
  }
  return undefined;
}

/** Converte um resultado do MapTiler no formato da MEL. */
export function toGeocodeResult(feature: MapTilerFeature): GeocodeResult | null {
  const [lng, lat] = feature.center;
  const position = { lat, lng };
  if (!isValidLatLng(position)) return null;

  const city = pick(feature, "municipality");
  const state = ufFromStateName(pick(feature, "subregion"));
  const neighborhood = pick(feature, "municipal_district", "place", "neighbourhood");
  const isArea = feature.place_type.some((t) => ["municipality", "subregion", "region", "country"].includes(t));

  // "Rua Santa Teresa, Sé, São Paulo – SP": curto, sem CEP e sem "Brasil".
  const parts = isArea
    ? [feature.text, state && feature.text !== state ? state : undefined]
    : [feature.text, neighborhood !== feature.text ? neighborhood : undefined, city && state ? `${city} – ${state}` : city];
  const label = parts.filter(Boolean).join(", ");

  return { label, position, city, state };
}

/**
 * Ordena por relevância (arredondada) e, no empate, pela distância ao ponto de
 * referência; remove duplicados pelo texto exibido.
 */
export function rankResults(features: MapTilerFeature[], near?: LatLng, limit = 6): GeocodeResult[] {
  const scored = features
    .map((f) => ({ result: toGeocodeResult(f), relevance: Math.round((f.relevance ?? 0) * 100) }))
    .filter((x): x is { result: GeocodeResult; relevance: number } => x.result !== null)
    .map((x) => ({ ...x, distance: near ? distanceMeters(near, x.result.position) : 0 }))
    .sort((a, b) => b.relevance - a.relevance || a.distance - b.distance);
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const { result } of scored) {
    if (seen.has(result.label)) continue;
    seen.add(result.label);
    out.push(result);
    if (out.length === limit) break;
  }
  return out;
}

export interface MapTilerGeocoderOptions {
  apiKey: string;
  fetch?: typeof fetch;
  language?: string;
}

export function createMapTilerGeocoder({ apiKey, fetch: doFetch = fetch, language = "pt" }: MapTilerGeocoderOptions): Geocoder {
  const base = "https://api.maptiler.com/geocoding";

  async function call(path: string, params: Record<string, string>): Promise<MapTilerFeature[]> {
    const qs = new URLSearchParams({ key: apiKey, language, ...params });
    const res = await doFetch(`${base}/${path}.json?${qs}`);
    if (!res.ok) throw new Error(`Geocoding falhou (${res.status})`);
    return ((await res.json()) as MapTilerResponse).features ?? [];
  }

  return {
    async search(query: string, near?: LatLng) {
      const q = query.trim();
      if (q.length < 3) return [];
      const params = {
        country: "br",
        limit: "5",
        autocomplete: "true",
        // Sem ponto conhecido, favorece a região do usuário pela conexão.
        proximity: near ? `${near.lng},${near.lat}` : "ip",
      };
      // A busca padrão não inclui pontos de interesse (parques, praças, lojas),
      // muito usados para dizer onde o pet sumiu: consultamos os dois.
      const [places, pois] = await Promise.all([
        call(encodeURIComponent(q), params),
        call(encodeURIComponent(q), { ...params, types: "poi" }),
      ]);
      return rankResults([...places, ...pois], near);
    },

    async reverse(p: LatLng) {
      if (!isValidLatLng(p)) return null;
      const features = await call(`${p.lng},${p.lat}`, { limit: "1" });
      const first = features[0];
      return first ? toGeocodeResult(first) : null;
    },
  };
}
