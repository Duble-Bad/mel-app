import type { LatLng } from "../geo/geo";
import type { GeocodeResult, Geocoder } from "../ports";

/** "01001-000", "01001000", " 01001 000 " → "01001000"; qualquer outro texto → null. */
export function parseCep(text: string): string | null {
  const m = /^\s*(\d{5})[\s.-]?(\d{3})\s*$/.exec(text);
  return m ? `${m[1]}${m[2]}` : null;
}

export const formatCep = (cep: string) => `${cep.slice(0, 5)}-${cep.slice(5)}`;

/** Endereço de um CEP (logradouro pode faltar: CEP geral de cidade pequena). */
export interface CepAddress {
  street?: string;
  neighborhood?: string;
  city: string;
  state: string;
}

export type CepLookup = (cep: string) => Promise<CepAddress | null>;

/** ViaCEP: serviço público e gratuito, sem chave. Só o CEP digitado é enviado. */
export function createViaCepLookup({ fetch: doFetch = fetch }: { fetch?: typeof fetch } = {}): CepLookup {
  return async (cep) => {
    const res = await doFetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) throw new Error(`ViaCEP respondeu ${res.status}`);
    const data = (await res.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (data.erro || !data.localidade || !data.uf) return null;
    return { street: data.logradouro || undefined, neighborhood: data.bairro || undefined, city: data.localidade, state: data.uf };
  };
}

const norm = (s?: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Busca de endereço que também entende CEP. Com um CEP, o endereço vem dos **Correios** (pelo
 * `lookup`): rua, bairro e cidade são exatamente os do CEP. Do geocodificador (mapa) só se usa a
 * POSIÇÃO, e só de um resultado que seja a mesma rua, na mesma cidade — ele responde por
 * semelhança de texto (traria "Rua D" para "Rua Dona Leopolda") e usa os bairros do mapa aberto,
 * que às vezes divergem dos Correios. Sem a rua no mapa, o ponto fica no bairro (e, sem ele, na
 * cidade), para a pessoa ajustar o pino. Qualquer outro texto vai direto para o geocodificador.
 * O CEP NÃO entra no rótulo: partes do rótulo podem virar texto público (docs/13, §2).
 */
export function withCepSearch(geocoder: Geocoder, lookup: CepLookup): Geocoder {
  return {
    ...geocoder,
    async search(query: string, near?: LatLng): Promise<GeocodeResult[]> {
      const cep = parseCep(query);
      if (!cep) return geocoder.search(query, near);
      const address = await lookup(cep);
      if (!address) return [];
      const { street, neighborhood, city, state } = address;
      const uf = state as GeocodeResult["state"];
      const inCity = (r: GeocodeResult) => (!r.state || r.state === uf) && (!r.city || norm(r.city) === norm(city));
      const firstPart = (r: GeocodeResult) => norm(r.label.split(",")[0]);
      const tail = `${city} – ${state}`;
      const result = (label: string, position: LatLng): GeocodeResult => ({ label, position, neighborhood, city, state: uf });

      // 1) A rua do CEP, no mapa: mesmo nome e mesma cidade.
      if (street) {
        const found = await geocoder.search([street, neighborhood, `${city} - ${state}`].filter(Boolean).join(", "), near);
        const match = found.find((r) => inCity(r) && firstPart(r) === norm(street));
        if (match) return [result([street, neighborhood, tail].filter(Boolean).join(", "), match.position)];
      }
      // 2) O bairro do CEP (centro do bairro); 3) a cidade.
      if (neighborhood) {
        const found = await geocoder.search(`${neighborhood}, ${city} - ${state}`, near);
        const match = found.find((r) => inCity(r) && firstPart(r) === norm(neighborhood));
        if (match) return [result(`${neighborhood}, ${tail}`, match.position)];
      }
      const found = await geocoder.search(`${city} - ${state}`, near);
      const match = found.find(inCity);
      return match ? [result(tail, match.position)] : [];
    },
  };
}
