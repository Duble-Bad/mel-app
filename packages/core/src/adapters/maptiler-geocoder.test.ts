import { describe, expect, it, vi } from "vitest";
import ibirapuera from "../geo/__fixtures__/maptiler-ibirapuera.json";
import reverseFixture from "../geo/__fixtures__/maptiler-reverse.json";
import searchFixture from "../geo/__fixtures__/maptiler-search.json";
import {
  createMapTilerGeocoder,
  rankResults,
  toGeocodeResult,
  ufFromStateName,
  type MapTilerFeature,
} from "./maptiler-geocoder";

// Respostas reais do MapTiler (Praça da Sé, São Paulo), reduzidas.
const searchFeatures = searchFixture.features as unknown as MapTilerFeature[];
const reverseFeatures = reverseFixture.features as unknown as MapTilerFeature[];

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & {
    mock: { calls: [string][] };
  };
}

describe("toGeocodeResult (real Brazilian responses)", () => {
  it("reads city from municipality and state from subregion (not the macro-region)", () => {
    const r = toGeocodeResult(searchFeatures[0]!)!;
    expect(r.city).toBe("São Paulo");
    expect(r.state).toBe("SP");
    expect(r.label).toBe("Praça da Sé, Sé, São Paulo – SP");
    expect(r.position.lat).toBeCloseTo(-23.5507, 3);
    expect(r.position.lng).toBeCloseTo(-46.6339, 3);
  });

  it("builds a short street label for reverse geocoding", () => {
    const r = toGeocodeResult(reverseFeatures[0]!)!;
    expect(r.label).toBe("Rua Santa Teresa, Sé, São Paulo – SP");
    expect(r.label).not.toMatch(/Brasil|\d{5}-\d{3}/);
  });

  it("maps state names to UF ignoring accents", () => {
    expect(ufFromStateName("São Paulo")).toBe("SP");
    expect(ufFromStateName("Paraná")).toBe("PR");
    expect(ufFromStateName("Parana")).toBe("PR");
    expect(ufFromStateName("Região Sudeste")).toBeUndefined();
  });
});

describe("rankResults (real 'Parque Ibirapuera' responses)", () => {
  const near = { lat: -23.55, lng: -46.63 }; // centro de São Paulo
  const all = [...ibirapuera.places, ...ibirapuera.pois] as unknown as MapTilerFeature[];

  it("puts the São Paulo park (a POI) before same-named places elsewhere", () => {
    const ranked = rankResults(all, near);
    expect(ranked[0]!.city).toBe("São Paulo");
    expect(ranked[0]!.label).toMatch(/^Parque Ibirapuera/);
    expect(ranked.findIndex((r) => r.city === "Aparecida de Goiânia")).toBeGreaterThan(0);
  });

  it("removes duplicates and limits the list", () => {
    const ranked = rankResults([...all, ...all], near);
    expect(new Set(ranked.map((r) => r.label)).size).toBe(ranked.length);
    expect(ranked.length).toBeLessThanOrEqual(6);
  });
});

describe("createMapTilerGeocoder", () => {
  it("queries addresses and points of interest, using IP proximity when no point is known", async () => {
    const f = fakeFetch(searchFixture);
    await createMapTilerGeocoder({ apiKey: "k", fetch: f }).search("Praça da Sé");
    const urls = f.mock.calls.map(([u]) => new URL(u));
    expect(urls).toHaveLength(2);
    expect(urls.map((u) => u.searchParams.get("types"))).toEqual([null, "poi"]);
    expect(urls.every((u) => u.searchParams.get("proximity") === "ip")).toBe(true);
  });

  it("searches in Brazil, in Portuguese, near the user", async () => {
    const f = fakeFetch(searchFixture);
    const geocoder = createMapTilerGeocoder({ apiKey: "k", fetch: f });
    const results = await geocoder.search("Praça da Sé", { lat: -23.5, lng: -46.6 });
    const url = new URL(f.mock.calls[0]![0]);
    expect(url.searchParams.get("country")).toBe("br");
    expect(url.searchParams.get("language")).toBe("pt");
    expect(url.searchParams.get("proximity")).toBe("-46.6,-23.5");
    expect(results[0]!.city).toBe("São Paulo");
  });

  it("does not call the API for very short queries", async () => {
    const f = fakeFetch(searchFixture);
    expect(await createMapTilerGeocoder({ apiKey: "k", fetch: f }).search("ab")).toEqual([]);
    expect(f.mock.calls).toHaveLength(0);
  });

  it("reverse geocodes a point", async () => {
    const f = fakeFetch(reverseFixture);
    const r = await createMapTilerGeocoder({ apiKey: "k", fetch: f }).reverse({ lat: -23.55052, lng: -46.633308 });
    expect(f.mock.calls[0]![0]).toContain("/-46.633308,-23.55052.json");
    expect(r?.state).toBe("SP");
  });

  it("fails loudly on HTTP errors", async () => {
    const geocoder = createMapTilerGeocoder({ apiKey: "k", fetch: fakeFetch({}, 403) });
    await expect(geocoder.search("Praça da Sé")).rejects.toThrow("403");
  });
});
