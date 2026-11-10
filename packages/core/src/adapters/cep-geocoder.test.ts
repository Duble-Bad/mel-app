import { describe, expect, it, vi } from "vitest";
import type { Geocoder } from "../ports";
import { createViaCepLookup, parseCep, withCepSearch } from "./cep-geocoder";

const result = (label: string) => ({ label, position: { lat: -23.55, lng: -46.63 } });

describe("CEP na busca de endereço", () => {
  it("reconhece CEP com ou sem hífen e ignora outros textos", () => {
    expect(parseCep("01001-000")).toBe("01001000");
    expect(parseCep(" 01001000 ")).toBe("01001000");
    expect(parseCep("01001 000")).toBe("01001000");
    expect(parseCep("Rua 25 de Março")).toBeNull();
    expect(parseCep("0100-1000")).toBeNull();
  });

  it("CEP vira rua, bairro e cidade e é localizado pelo geocodificador; o CEP não entra no rótulo (privacidade)", async () => {
    const search = vi.fn(async () => [result("Praça da Sé, Sé, São Paulo – SP")]);
    const geo = withCepSearch({ search } as unknown as Geocoder, async () => ({ street: "Praça da Sé", neighborhood: "Sé", city: "São Paulo", state: "SP" }));
    const [r] = await geo.search("01001-000");
    expect(search).toHaveBeenCalledWith("Praça da Sé, Sé, São Paulo - SP", undefined);
    expect(r!.label).toBe("Praça da Sé, Sé, São Paulo – SP");
  });

  it("resultados de outra cidade ou estado saem: o CEP já diz onde é", async () => {
    const search = vi.fn(async () => [
      { ...result("Praça da Fé, Sorocaba – SP"), city: "Sorocaba", state: "SP" as const },
      { ...result("Praça da Sé, Crato – CE"), city: "Crato", state: "CE" as const },
      { ...result("Praça da Sé, São Paulo – SP"), city: "São Paulo", state: "SP" as const },
    ]);
    const geo = withCepSearch({ search } as unknown as Geocoder, async () => ({ street: "Praça da Sé", neighborhood: "Sé", city: "Sao Paulo", state: "SP" }));
    expect((await geo.search("01001000")).map((r) => r.city)).toEqual(["São Paulo"]);
  });

  it("sem resultado para a rua, tenta o bairro e depois a cidade; CEP inexistente não devolve nada", async () => {
    const search = vi.fn(async (q: string) => (q === "Centro, Cidade - MG" ? [result("Centro, Cidade – MG")] : []));
    const geo = withCepSearch({ search } as unknown as Geocoder, async () => ({ street: "Rua Sem Mapa", neighborhood: "Centro", city: "Cidade", state: "MG" }));
    expect(await geo.search("35000000")).toHaveLength(1);
    expect(search).toHaveBeenCalledTimes(2);
    expect(await withCepSearch({ search } as unknown as Geocoder, async () => null).search("99999-999")).toEqual([]);
  });

  it("nome de rua vai direto para o geocodificador, sem consultar CEP", async () => {
    const search = vi.fn(async () => []);
    const lookup = vi.fn();
    await withCepSearch({ search } as unknown as Geocoder, lookup).search("Rua das Flores, 100");
    expect(lookup).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledWith("Rua das Flores, 100", undefined);
  });

  it("ViaCEP: endereço do CEP e { erro: true } como não encontrado", async () => {
    const ok = createViaCepLookup({ fetch: (async () => Response.json({ logradouro: "", bairro: "Centro", localidade: "Cidade", uf: "MG" })) as typeof fetch });
    expect(await ok("35000000")).toEqual({ street: undefined, neighborhood: "Centro", city: "Cidade", state: "MG" });
    const missing = createViaCepLookup({ fetch: (async () => Response.json({ erro: "true" })) as typeof fetch });
    expect(await missing("99999999")).toBeNull();
  });
});
