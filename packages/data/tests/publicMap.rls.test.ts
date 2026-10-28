import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { foundInputSchema, fuzzPoint, parseSearchParams, petInputSchema } from "@mel/core";
import { createFoundCase } from "../src/found";
import { activateLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { createPet } from "../src/pets";
import { searchPublicCases } from "../src/publicMap";
import { anonClient, createTestUser } from "./helpers";

// Um bairro "isolado" (Parque do Ibirapuera) para não colidir com dados de outros testes na Sé.
const HERE = { lat: -23.5874, lng: -46.6576 };
const near = (dLat: number, dLng: number) => ({ lat: HERE.lat + dLat, lng: HERE.lng + dLng });
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let finder: Awaited<ReturnType<typeof createTestUser>>;
const codes: Record<string, string> = {};

beforeAll(async () => {
  tutor = await createTestUser("map-tutor");
  finder = await createTestUser("map-finder");
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Pipoca", species: "dog" }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: near(0.001, 0.001), lostAt: minutesAgo(60), publicAreaLabel: "Ibirapuera, São Paulo – SP" });
  codes.lost = (await activateLostCase(tutor.client, c.id)).code;
  const base = { areaLabel: "Ibirapuera, São Paulo – SP", foundAt: minutesAgo(30) };
  codes.cat = await createFoundCase(finder.client, finder.id, foundInputSchema.parse({ ...base, species: "cat", position: near(0.004, 0), custody: "with_me" }));
  codes.street = await createFoundCase(finder.client, finder.id, foundInputSchema.parse({ ...base, species: "dog", position: near(-0.006, 0.002), custody: "street" }));
  // Antigo (45 dias) e longe (~6 km): ficam fora dos filtros abaixo.
  codes.old = await createFoundCase(finder.client, finder.id, foundInputSchema.parse({ ...base, species: "dog", position: near(0.002, 0.002), custody: "with_me", foundAt: minutesAgo(45 * 24 * 60) }));
  codes.far = await createFoundCase(finder.client, finder.id, foundInputSchema.parse({ ...base, species: "dog", position: near(0.055, 0), custody: "with_me" }));
});

afterAll(async () => {
  await tutor?.cleanup();
  await finder?.cleanup();
});

const search = (q: Record<string, string>) =>
  searchPublicCases(anonClient(), parseSearchParams({ lat: String(HERE.lat), lng: String(HERE.lng), raio: "3", ...q }), { pageSize: 50 });

describe("public map search", () => {
  it("anyone sees lost, found and loose pets nearby — only approximate points", async () => {
    const { items } = await search({});
    const byCode = Object.fromEntries(items.map((i) => [i.code, i]));
    expect(byCode[codes.lost!]).toMatchObject({ kind: "lost", title: "Pipoca", species: "dog" });
    expect(byCode[codes.cat!]).toMatchObject({ kind: "found", title: null, species: "cat" });
    expect(byCode[codes.street!]).toMatchObject({ kind: "sighting" });
    expect(byCode[codes.far!]).toBeUndefined(); // fora do raio
    // Ponto público = grade aproximada (nunca o exato).
    expect(byCode[codes.cat!]!.position).toEqual(fuzzPoint(near(0.004, 0)));
    // Ordenado por distância.
    const distances = items.map((i) => i.distanceM);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it("filters by kind, species and period", async () => {
    const lostOnly = (await search({ tipos: "lost" })).items;
    expect(lostOnly.every((i) => i.kind === "lost")).toBe(true);
    expect(lostOnly.some((i) => i.code === codes.lost)).toBe(true);

    const cats = (await search({ especie: "cat" })).items;
    expect(cats.map((i) => i.code)).toContain(codes.cat);
    expect(cats.every((i) => i.species === "cat")).toBe(true);

    const all = (await search({ periodo: "todos" })).items.map((i) => i.code);
    const month = (await search({ periodo: "30d" })).items.map((i) => i.code);
    expect(all).toContain(codes.old);
    expect(month).not.toContain(codes.old);
  });

  it("paginates with a total", async () => {
    const f = parseSearchParams({ lat: String(HERE.lat), lng: String(HERE.lng), raio: "3", periodo: "todos" });
    const p1 = await searchPublicCases(anonClient(), f, { pageSize: 2 });
    const p2 = await searchPublicCases(anonClient(), { ...f, page: 2 }, { pageSize: 2 });
    expect(p1.total).toBeGreaterThanOrEqual(4);
    expect(p1.items).toHaveLength(2);
    expect(p2.items.map((i) => i.code)).not.toContain(p1.items[0]!.code);
  });
});
