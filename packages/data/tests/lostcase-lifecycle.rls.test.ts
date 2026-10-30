// Ciclo de vida do alerta de perdido: editar o ativo, ENCERRAR sem reencontro
// (CLOSED) e o reencontro (FOUND) continuando separado.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { foundInputSchema, parseSearchParams, petInputSchema, reunionSchema, sightingInputSchema, type LatLng } from "@mel/core";
import { ensureSession } from "../src/auth";
import { listMessages, sendMessage, startConversation } from "../src/chat";
import { createFoundCase } from "../src/found";
import { activateLostCase, closeLostCase, confirmReunion, getMyLostCaseByCode, getPublicLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { createPet, updatePet } from "../src/pets";
import { searchPublicCases } from "../src/publicMap";
import { createSighting, getTimeline } from "../src/sightings";
import { anonClient, createTestUser, serviceClient } from "./helpers";

const SE: LatLng = { lat: -23.55052, lng: -46.633308 };
const NEAR: LatLng = { lat: -23.5489, lng: -46.6388 }; // ~600 m
const FAR: LatLng = { lat: -23.6, lng: -46.633308 }; // ~5,5 km
const VERY_FAR: LatLng = { lat: -23.7, lng: -46.633308 }; // ~16 km
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const PET = { species: "dog", size: "small", sex: "female", colorPrimary: "caramelo", breed: "Vira-lata" } as const;

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let helper: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
let moderator: Awaited<ReturnType<typeof createTestUser>>;
const anonUsers: string[] = [];

async function activeAlert(name: string, at: LatLng = SE) {
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name, ...PET }));
  const draft = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, draft.id, { lastSeen: at, publicAreaLabel: "Sé, São Paulo – SP", lostAt: minutesAgo(90), contactChat: true, contactWhatsappPublic: true, contactPhone: "11900000001" });
  const active = await activateLostCase(tutor.client, draft.id);
  return { pet, id: active.id, code: active.code };
}

const foundNear = (at: LatLng = NEAR) =>
  foundInputSchema.parse({ ...PET, breedGuess: PET.breed, position: at, areaLabel: "Sé, São Paulo – SP", foundAt: minutesAgo(10), custody: "with_me" });

const matchesOf = async (lostId: string) =>
  (await serviceClient().from("case_matches").select("found_case_id, score, reasons").eq("lost_case_id", lostId)).data ?? [];
const rowOf = async (id: string) => (await serviceClient().from("lost_cases").select("*").eq("id", id).single()).data!;

beforeAll(async () => {
  tutor = await createTestUser("life-tutor");
  helper = await createTestUser("life-helper");
  stranger = await createTestUser("life-stranger");
  moderator = await createTestUser("life-mod");
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
});

afterAll(async () => {
  for (const id of anonUsers) await serviceClient().auth.admin.deleteUser(id);
  await tutor?.cleanup();
  await helper?.cleanup();
  await stranger?.cleanup();
  await moderator?.cleanup();
});

describe("editing an active alert", () => {
  it("the owner edits allowed fields; protected fields cannot be touched", async () => {
    const a = await activeAlert("Edita");
    const before = await rowOf(a.id);
    const edited = await updateLostCase(tutor.client, a.id, { notes: "Atende por Edi.", contactChat: false, lostAt: minutesAgo(120) });
    expect(edited).toMatchObject({ notes: "Atende por Edi.", contactChat: false, status: "ACTIVE" });

    // Colunas de sistema/identidade: sem privilégio (nem pelo cliente direto).
    for (const patch of [{ owner_id: stranger.id }, { short_code: "zzzzzz" }, { published_at: minutesAgo(999) }, { closed_at: minutesAgo(1) }, { pet_id: crypto.randomUUID() }]) {
      const { error } = await tutor.client.from("lost_cases").update(patch as never).eq("id", a.id);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
    // Status arbitrário (voltar a rascunho) também não.
    await expect(updateLostCase(tutor.client, a.id, { status: "DRAFT" } as never)).rejects.toThrow();
    const after = await rowOf(a.id);
    expect(after).toMatchObject({ owner_id: before.owner_id, short_code: before.short_code, published_at: before.published_at, pet_id: before.pet_id, closed_at: null });
  });

  it("someone else (or a moderator) cannot edit", async () => {
    const a = await activeAlert("Alheio");
    await expect(updateLostCase(stranger.client, a.id, { notes: "invadido" })).rejects.toThrow();
    await expect(updateLostCase(moderator.client, a.id, { notes: "moderação" })).rejects.toThrow();
    expect((await rowOf(a.id)).notes).toBeNull();
  });

  it("moving the last-seen location recalculates the Radar (and drops what no longer fits)", async () => {
    const a = await activeAlert("Radar");
    const code = await createFoundCase(helper.client, helper.id, foundNear());
    const fc = (await serviceClient().from("found_cases").select("id").eq("short_code", code).single()).data!;
    expect((await matchesOf(a.id)).find((m) => m.found_case_id === fc.id)?.reasons).toMatchObject({ distance: "NEAR" });

    await updateLostCase(tutor.client, a.id, { lastSeen: FAR });
    expect((await matchesOf(a.id)).find((m) => m.found_case_id === fc.id)?.reasons).toMatchObject({ distance: "AREA" });

    await updateLostCase(tutor.client, a.id, { lastSeen: VERY_FAR });
    expect((await matchesOf(a.id)).find((m) => m.found_case_id === fc.id)).toBeUndefined();

    // Voltou para perto: a correspondência reaparece.
    await updateLostCase(tutor.client, a.id, { lastSeen: SE });
    expect((await matchesOf(a.id)).find((m) => m.found_case_id === fc.id)?.reasons).toMatchObject({ distance: "NEAR" });
  });

  it("editing the pet's characteristics recalculates the Radar too", async () => {
    const a = await activeAlert("Cor");
    const code = await createFoundCase(helper.client, helper.id, foundNear());
    const fc = (await serviceClient().from("found_cases").select("id").eq("short_code", code).single()).data!;
    expect((await matchesOf(a.id)).find((m) => m.found_case_id === fc.id)?.reasons).toMatchObject({ color: "same" });
    await updatePet(tutor.client, a.pet.id, petInputSchema.parse({ name: "Cor", ...PET, colorPrimary: "preto" }));
    const m = (await matchesOf(a.id)).find((x) => x.found_case_id === fc.id);
    expect(m?.reasons ?? { color: "gone" }).not.toMatchObject({ color: "same" });
  });
});

describe("closing an alert (without reunion)", () => {
  let a: Awaited<ReturnType<typeof activeAlert>>;
  let conversationId: string;

  beforeAll(async () => {
    a = await activeAlert("Encerra");
    await createSighting(helper.client, sightingInputSchema.parse({ code: a.code, position: NEAR, seenAt: minutesAgo(30), notes: "Perto da padaria." }));
    conversationId = await startConversation(helper.client, a.code, "Oi! Vi seu cachorro.");
  });

  it("ACTIVE → CLOSED by the owner; not a reunion; second request is harmless", async () => {
    await closeLostCase(tutor.client, a.code);
    const row = await rowOf(a.id);
    expect(row).toMatchObject({ status: "CLOSED", found_at: null, found_how: null });
    expect(row.closed_at).toBeTruthy();
    await closeLostCase(tutor.client, a.code); // de novo: nada muda
    expect((await rowOf(a.id)).closed_at).toBe(row.closed_at);
  });

  it("public page stays as history, without location, contact or notes", async () => {
    const pub = (await getPublicLostCase(anonClient(), a.code))!;
    expect(pub).toMatchObject({ status: "CLOSED", point: null, areaLabel: null, contactWhatsapp: null, contactPhone: null, contactChat: false, indexable: false, notes: null, helpersCount: null });
    expect(pub.closedAt).toBeTruthy();
    expect(pub.pet.name).toBe("Encerra");
  });

  it("leaves lists/map, takes no sightings, no new conversations, no new Radar matches", async () => {
    const { items } = await searchPublicCases(anonClient(), parseSearchParams({ lat: String(SE.lat), lng: String(SE.lng), raio: "3" }), { pageSize: 100 });
    expect(items.map((i) => i.code)).not.toContain(a.code);
    await expect(createSighting(helper.client, sightingInputSchema.parse({ code: a.code, position: NEAR, seenAt: minutesAgo(1) }))).rejects.toThrow();
    await expect(startConversation(stranger.client, a.code, "Oi")).rejects.toThrow();
    await createFoundCase(stranger.client, stranger.id, foundNear());
    const after = await matchesOf(a.id);
    const fresh = await serviceClient().from("case_matches").select("id").eq("lost_case_id", a.id).gt("created_at", (await rowOf(a.id)).closed_at);
    expect(fresh.data).toEqual([]);
    expect(after.length).toBeGreaterThanOrEqual(0);
  });

  it("history stays: the owner still sees the sightings and the conversation (read-only)", async () => {
    expect((await getTimeline(tutor.client, a.code)).length).toBe(1);
    expect(await getTimeline(stranger.client, a.code)).toEqual([]); // só o tutor
    expect((await listMessages(helper.client, conversationId)).length).toBe(1);
    await expect(sendMessage(helper.client, conversationId, helper.id, "ainda está aí?")).rejects.toThrow("Esta conversa não aceita novas mensagens.");
  });

  it("a closed alert cannot be edited, reactivated or turned into a reunion", async () => {
    await expect(updateLostCase(tutor.client, a.id, { notes: "mudou" })).rejects.toThrow("Este alerta já foi encerrado e não pode mais ser alterado.");
    await expect(activateLostCase(tutor.client, a.id)).rejects.toThrow();
    await expect(confirmReunion(tutor.client, a.code, reunionSchema.parse({ how: "came_back" }))).rejects.toThrow();
    expect((await rowOf(a.id)).status).toBe("CLOSED");
  });
});

describe("reunion stays separate", () => {
  it("FOUND keeps working, counts as reunion, and cannot be 'closed' or edited afterwards", async () => {
    const a = await activeAlert("Volta");
    await confirmReunion(tutor.client, a.code, reunionSchema.parse({ how: "came_back" }));
    expect(await rowOf(a.id)).toMatchObject({ status: "FOUND", found_how: "came_back", closed_at: null });
    await expect(closeLostCase(tutor.client, a.code)).rejects.toThrow("Este alerta não está mais ativo.");
    await expect(updateLostCase(tutor.client, a.id, { notes: "x" })).rejects.toThrow("Este alerta já foi encerrado e não pode mais ser alterado.");
    expect((await rowOf(a.id)).status).toBe("FOUND");
    expect((await getPublicLostCase(anonClient(), a.code))?.status).toBe("FOUND");
  });
});

describe("only the owner closes", () => {
  it("another user, an anonymous session and a moderator cannot close (directly or via the data layer)", async () => {
    const a = await activeAlert("Dono");
    await expect(closeLostCase(stranger.client, a.code)).rejects.toThrow("Você não pode encerrar este alerta.");
    await expect(closeLostCase(moderator.client, a.code)).rejects.toThrow("Você não pode encerrar este alerta.");

    const anon = anonClient();
    const user = await ensureSession(anon);
    anonUsers.push(user.id);
    await expect(closeLostCase(anon, a.code)).rejects.toThrow("Você não pode encerrar este alerta.");
    // Chamada direta com o id (manipulado no cliente): RLS não deixa.
    const { data } = await anon.from("lost_cases").update({ status: "CLOSED" }).eq("id", a.id).select("id");
    expect(data ?? []).toEqual([]);
    expect(await getMyLostCaseByCode(anon, a.code)).toBeNull();
    expect((await rowOf(a.id)).status).toBe("ACTIVE");
  });
});
