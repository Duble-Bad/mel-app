import { describe, expect, it, vi } from "vitest";
import type { GeocodeResult, Geocoder } from "../ports";
import { createViaCepLookup, parseCep, withCepSearch } from "./cep-geocoder";

const at = (lat: number, lng: number) => ({ lat, lng });
const r = (label: string, city: string, state: GeocodeResult["state"], lat = -23.55, lng = -46.36): GeocodeResult => ({ label, position: at(lat, lng), city, state });
const geocoder = (search: (q: string) => Promise<GeocodeResult[]>) => ({ search: vi.fn(search) }) as unknown as Geocoder & { search: ReturnType<typeof vi.fn> };

// CEP 08506-010 (caso real visto pelo proprietário): os Correios dizem Rua Dona Leopolda, Vila São
// Paulo; o mapa devolvia "Rua D" primeiro e a Rua Dona Leopolda no bairro "Sítio do Paiolzinho".
const LEOPOLDA = { street: "Rua Dona Leopolda", neighborhood: "Vila São Paulo", city: "Ferraz de Vasconcelos", state: "SP" };
const mapForLeopolda = async () => [
  r("Rua D, Vila São Paulo, Ferraz de Vasconcelos – SP", "Ferraz de Vasconcelos", "SP", -23.5542, -46.3651),
  r("Rua Dona Leopolda, Sítio do Paiolzinho, Ferraz de Vasconcelos – SP", "Ferraz de Vasconcelos", "SP", -23.558, -46.3635),
  r("Vila São Paulo, Ferraz de Vasconcelos – SP", "Ferraz de Vasconcelos", "SP", -23.5615, -46.3687),
  r("SPS veículos, Vila Andeyara, Ferraz de Vasconcelos – SP", "Ferraz de Vasconcelos", "SP"),
];

describe("CEP na busca de endereço", () => {
  it("reconhece CEP com ou sem hífen e ignora outros textos", () => {
    expect(parseCep("01001-000")).toBe("01001000");
    expect(parseCep(" 01001000 ")).toBe("01001000");
    expect(parseCep("01001 000")).toBe("01001000");
    expect(parseCep("Rua 25 de Março")).toBeNull();
    expect(parseCep("0100-1000")).toBeNull();
  });

  it("o endereço é o dos Correios (rua e bairro do CEP); do mapa vem só a posição da mesma rua", async () => {
    const geo = withCepSearch(geocoder(mapForLeopolda), async () => LEOPOLDA);
    const results = await geo.search("08506010");
    expect(results).toEqual([
      {
        label: "Rua Dona Leopolda, Vila São Paulo, Ferraz de Vasconcelos – SP",
        position: at(-23.558, -46.3635),
        neighborhood: "Vila São Paulo",
        city: "Ferraz de Vasconcelos",
        state: "SP",
      },
    ]);
  });

  it("sem a rua no mapa, o ponto fica no centro do bairro do CEP; sem o bairro, na cidade", async () => {
    const onlyOthers = geocoder(async (q) =>
      q.startsWith("Rua") ? [r("Rua D, Vila São Paulo, Ferraz de Vasconcelos – SP", "Ferraz de Vasconcelos", "SP")] : q.startsWith("Vila") ? [r("Vila São Paulo, Ferraz de Vasconcelos – SP", "Ferraz de Vasconcelos", "SP", -23.5615, -46.3687)] : [],
    );
    const [bairro] = await withCepSearch(onlyOthers, async () => LEOPOLDA).search("08506-010");
    expect(bairro).toMatchObject({ label: "Vila São Paulo, Ferraz de Vasconcelos – SP", position: at(-23.5615, -46.3687) });

    const cityOnly = geocoder(async (q) => (q === "Ferraz de Vasconcelos - SP" ? [r("Ferraz de Vasconcelos – SP", "Ferraz de Vasconcelos", "SP")] : []));
    const [cidade] = await withCepSearch(cityOnly, async () => LEOPOLDA).search("08506010");
    expect(cidade!.label).toBe("Ferraz de Vasconcelos – SP");
  });

  it("a mesma rua em outra cidade não serve; CEP inexistente não devolve nada", async () => {
    const elsewhere = geocoder(async () => [r("Rua Dona Leopolda, Centro, São Paulo – SP", "São Paulo", "SP")]);
    expect(await withCepSearch(elsewhere, async () => LEOPOLDA).search("08506010")).toEqual([]);
    expect(await withCepSearch(elsewhere, async () => null).search("99999-999")).toEqual([]);
  });

  it("nome de rua vai direto para o geocodificador, sem consultar CEP", async () => {
    const plain = geocoder(async () => []);
    const lookup = vi.fn();
    await withCepSearch(plain, lookup).search("Rua das Flores, 100");
    expect(lookup).not.toHaveBeenCalled();
    expect(plain.search).toHaveBeenCalledWith("Rua das Flores, 100", undefined);
  });

  it("o CEP não entra no rótulo (privacidade: partes do rótulo podem ficar públicas)", async () => {
    const [res] = await withCepSearch(geocoder(mapForLeopolda), async () => LEOPOLDA).search("08506-010");
    expect(res!.label).not.toMatch(/\d{5}-?\d{3}/);
  });

  it("ViaCEP: endereço do CEP e { erro: true } como não encontrado", async () => {
    const ok = createViaCepLookup({ fetch: (async () => Response.json({ logradouro: "", bairro: "Centro", localidade: "Cidade", uf: "MG" })) as typeof fetch });
    expect(await ok("35000000")).toEqual({ street: undefined, neighborhood: "Centro", city: "Cidade", state: "MG" });
    const missing = createViaCepLookup({ fetch: (async () => Response.json({ erro: "true" })) as typeof fetch });
    expect(await missing("99999999")).toBeNull();
  });
});
