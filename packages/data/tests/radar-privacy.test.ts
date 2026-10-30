// P0 da auditoria de 2026-10-30: o Radar não pode permitir triangular um ponto
// privado (último local do tutor ou local de quem encontrou).
//
// Prova: dois pontos privados DIFERENTES dentro da mesma célula pública de
// 250 m produzem respostas IDÊNTICAS do Radar, para qualquer sonda. Então nenhuma
// combinação de respostas (1, 3 ou N registros, de qualquer lado) distingue um
// do outro: o máximo que se aprende é a célula pública — que o mapa já mostra.
// E nenhuma resposta traz metros, coordenadas ou direção.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { foundInputSchema, fuzzPoint, petInputSchema, type LatLng } from "@mel/core";
import { ensureSession } from "../src/auth";
import type { MelClient } from "../src/client";
import { createFoundCase } from "../src/found";
import { activateLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { createPet } from "../src/pets";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Ponto fictício (bairro da Liberdade, São Paulo) e deslocamentos em metros.
const BASE: LatLng = { lat: -23.5578, lng: -46.6352 };
const offset = (p: LatLng, northM: number, eastM: number): LatLng => ({
  lat: p.lat + northM / 111_320,
  lng: p.lng + eastM / (111_320 * Math.cos((p.lat * Math.PI) / 180)),
});
const CELL = fuzzPoint(BASE);
// Dois pontos privados distintos (~110 m entre eles) na MESMA célula pública.
const SECRET_A = offset(CELL, 55, -30);
const SECRET_B = offset(CELL, -50, 40);

const LOST_AT = new Date(Date.now() - 3 * 3_600_000).toISOString();
const FOUND_AT = new Date(Date.now() - 600_000).toISOString();
const PET = { species: "dog", size: "small", sex: "female", colorPrimary: "caramelo", breed: "Vira-lata" } as const;

const users: string[] = [];
const cleanups: Array<() => Promise<unknown>> = [];

type Tutor = Awaited<ReturnType<typeof createTestUser>> & { code: string };

async function tutorWithAlertAt(label: string, at: LatLng): Promise<Tutor> {
  const t = await createTestUser(label);
  cleanups.push(t.cleanup);
  const pet = await createPet(t.client, t.id, petInputSchema.parse({ name: `Radar ${label}`, ...PET }));
  const draft = await startLostCase(t.client, t.id, pet.id);
  await updateLostCase(t.client, draft.id, { lastSeen: at, publicAreaLabel: "Liberdade, São Paulo – SP", lostAt: LOST_AT, contactChat: true });
  return { ...t, code: (await activateLostCase(t.client, draft.id)).code };
}

async function publishFound(client: MelClient, reporterId: string, at: LatLng) {
  return createFoundCase(
    client,
    reporterId,
    foundInputSchema.parse({ ...PET, breedGuess: PET.breed, position: at, areaLabel: "Liberdade, São Paulo – SP", foundAt: FOUND_AT, custody: "with_me" }),
  );
}

type RawMatch = { role: string; score: number; reasons: Record<string, unknown>; lost: { code: string }; found: { code: string } };

/** Resposta crua da API (exatamente o que o cliente recebe). */
async function rawMatches(client: MelClient): Promise<RawMatch[]> {
  const { data, error } = await client.rpc("get_my_matches", {});
  if (error) throw error;
  return data as unknown as RawMatch[];
}

/** Nenhum campo de distância numérica, coordenada ou direção, em nenhum nível. */
function assertNoLocationLeak(payload: unknown) {
  const forbidden = /^(distance_m|distance_km|meters|metros|lat|lng|latitude|longitude|point|public_point|last_seen_.*|bearing|heading|direction|dx|dy|delta.*)$/i;
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        expect(forbidden.test(k), `campo proibido ${path}.${k}`).toBe(false);
        walk(x, `${path}.${k}`);
      }
    }
  };
  walk(payload, "$");
  for (const m of payload as RawMatch[]) {
    expect(["NEAR", "MEDIUM", "AREA"]).toContain(m.reasons.distance);
    // Só "days" é número nos motivos (tempo, não lugar).
    const numeric = Object.entries(m.reasons).filter(([, x]) => typeof x === "number").map(([k]) => k);
    expect(numeric).toEqual(["days"]);
  }
}

const view = (m: RawMatch) => JSON.stringify({ score: m.score, reasons: m.reasons });

let tutorA: Tutor;
let tutorB: Tutor;

beforeAll(async () => {
  // Pré-condição do teste: os dois pontos privados caem na mesma célula pública.
  expect(fuzzPoint(SECRET_A)).toEqual(CELL);
  expect(fuzzPoint(SECRET_B)).toEqual(CELL);
  tutorA = await tutorWithAlertAt("radar-a", SECRET_A);
  tutorB = await tutorWithAlertAt("radar-b", SECRET_B);
});

afterAll(async () => {
  for (const id of users) await serviceClient().auth.admin.deleteUser(id);
  for (const c of cleanups) await c();
});

describe("finder side: probing cannot locate the tutor's private point", () => {
  it("anonymous attacker with 3 found posts in different directions learns nothing beyond the public cell", async () => {
    const attacker = anonClient();
    const anon = await ensureSession(attacker);
    users.push(anon.id);
    // Sondas: ~400 m ao norte, ~1,8 km a leste, ~5 km a sudoeste do ponto secreto.
    const probes = [offset(BASE, 400, 0), offset(BASE, 0, 1800), offset(BASE, -3500, -3500)];
    for (const q of probes) await publishFound(attacker, anon.id, q);

    const raw = await rawMatches(attacker);
    assertNoLocationLeak(raw);
    const mine = raw.filter((m) => m.role === "finder" && [tutorA.code, tutorB.code].includes(m.lost.code));
    const byFound = new Map<string, RawMatch[]>();
    for (const m of mine) byFound.set(m.found.code, [...(byFound.get(m.found.code) ?? []), m]);

    expect(byFound.size).toBe(3); // as 3 sondas viraram correspondência com os dois alertas
    const bands = [];
    for (const pair of byFound.values()) {
      expect(pair).toHaveLength(2);
      const [a, b] = [pair.find((m) => m.lost.code === tutorA.code)!, pair.find((m) => m.lost.code === tutorB.code)!];
      // Pontos privados diferentes → respostas idênticas: não há como separar A de B.
      expect(view(a)).toBe(view(b));
      bands.push(a.reasons.distance);
    }
    expect(new Set(bands)).toEqual(new Set(["NEAR", "MEDIUM", "AREA"]));
  });

  it("authenticated attacker with 1 post gets the same indistinguishable answer", async () => {
    const attacker = await createTestUser("radar-attacker");
    cleanups.push(attacker.cleanup);
    await publishFound(attacker.client, attacker.id, offset(BASE, 250, 250));
    const raw = await rawMatches(attacker.client);
    assertNoLocationLeak(raw);
    const mine = raw.filter((m) => [tutorA.code, tutorB.code].includes(m.lost.code));
    expect(mine).toHaveLength(2);
    expect(view(mine[0]!)).toBe(view(mine[1]!));
  });
});

describe("tutor side: the tutor cannot locate the finder's private point", () => {
  it("two finders at different private points in the same cell look identical to the tutor", async () => {
    const finder1 = await createTestUser("radar-finder-1");
    const finder2 = await createTestUser("radar-finder-2");
    cleanups.push(finder1.cleanup, finder2.cleanup);
    const near = fuzzPoint(offset(BASE, 700, 0)); // célula de quem encontrou
    const code1 = await publishFound(finder1.client, finder1.id, offset(near, 50, 40));
    const code2 = await publishFound(finder2.client, finder2.id, offset(near, -45, -50));
    expect(fuzzPoint(offset(near, 50, 40))).toEqual(near);
    expect(fuzzPoint(offset(near, -45, -50))).toEqual(near);

    const raw = await rawMatches(tutorA.client);
    assertNoLocationLeak(raw);
    const m1 = raw.find((m) => m.role === "owner" && m.found.code === code1)!;
    const m2 = raw.find((m) => m.role === "owner" && m.found.code === code2)!;
    expect(m1 && m2).toBeTruthy();
    expect(view(m1)).toBe(view(m2));

    // E quem encontrou também não recebe nada além da faixa sobre o tutor.
    assertNoLocationLeak(await rawMatches(finder1.client));
  });

  it("match notifications carry no score or location", async () => {
    const { data } = await serviceClient().from("notifications").select("payload").eq("user_id", tutorA.id).eq("kind", "match_new");
    expect(data?.length).toBeGreaterThan(0);
    for (const { payload } of data ?? []) {
      expect(Object.keys(payload as object).sort()).toEqual(["lost_code", "pet_name", "to"]);
    }
  });
});
