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

/**
 * Busca de endereço que também entende CEP: o CEP vira rua, bairro e cidade (pelo `lookup`) e
 * esse endereço é localizado pelo geocodificador de sempre. Qualquer outro texto (nome de rua,
 * lugar) vai direto para o geocodificador. O CEP NÃO entra no rótulo: partes do rótulo podem virar
 * texto público (docs/13-mapas-fornecedores.md, §2) e o CEP é quase tão preciso quanto a rua.
 */
export function withCepSearch(geocoder: Geocoder, lookup: CepLookup): Geocoder {
  return {
    ...geocoder,
    async search(query: string, near?: LatLng): Promise<GeocodeResult[]> {
      const cep = parseCep(query);
      if (!cep) return geocoder.search(query, near);
      const address = await lookup(cep);
      if (!address) return [];
      const place = `${address.city} - ${address.state}`;
      const tries = [
        [address.street, address.neighborhood, place],
        [address.neighborhood, place],
        [place],
      ].map((parts) => parts.filter(Boolean).join(", "));
      // O CEP já diz a cidade e o estado: resultados de outros lugares saem (se sobrar algum).
      const norm = (s?: string) => (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      const sameState = (r: GeocodeResult) => !r.state || r.state === address.state;
      const sameCity = (r: GeocodeResult) => !r.city || norm(r.city) === norm(address.city);
      for (const text of [...new Set(tries)]) {
        const found = await geocoder.search(text, near);
        const local = found.filter((r) => sameState(r) && sameCity(r));
        const list = local.length ? local : found.filter(sameState);
        if (list.length) return list;
      }
      return [];
    },
  };
}
