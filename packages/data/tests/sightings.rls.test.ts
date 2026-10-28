import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { petInputSchema, sightingInputSchema } from "@mel/core";
import { ensureSession } from "../src/auth";
import { activateLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { countUnreadNotifications, listNotifications, markAllNotificationsRead } from "../src/notifications";
import { createPet } from "../src/pets";
import { createSighting, getTimeline, setSightingHidden } from "../src/sightings";
import { anonClient, createTestUser, serviceClient } from "./helpers";

const SE = { lat: -23.55052, lng: -46.633308 };
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
let code: string;
let draftCode: string;
const anonUsers: string[] = [];

/** Visitante sem cadastro: sessão anônima, como no app. */
async function anonymousReporter() {
  const client = anonClient();
  const user = await ensureSession(client);
  anonUsers.push(user.id);
  return { client, id: user.id };
}

const sighting = (overrides: Partial<Parameters<typeof sightingInputSchema.parse>[0]> = {}) =>
  sightingInputSchema.parse({
    code,
    position: { lat: -23.5489, lng: -46.6388 },
    placeLabel: "Rua Direita, Sé, São Paulo – SP",
    seenAt: minutesAgo(10),
    direction: "N",
    states: ["running", "scared"],
    ...overrides,
  });

beforeAll(async () => {
  tutor = await createTestUser("sight-tutor");
  stranger = await createTestUser("sight-stranger");
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Mel", species: "dog" }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: SE, lostAt: minutesAgo(60), publicAreaLabel: "Sé, São Paulo – SP" });
  code = (await activateLostCase(tutor.client, c.id)).code;

  const other = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Thor", species: "dog" }));
  draftCode = (await startLostCase(tutor.client, tutor.id, other.id)).code;
});

afterAll(async () => {
  for (const id of anonUsers) await serviceClient().auth.admin.deleteUser(id);
  await tutor?.cleanup();
  await stranger?.cleanup();
});

describe("sending a sighting without an account", () => {
  it("anonymous visitor sends; the tutor is notified; the timeline shows it", async () => {
    await markAllNotificationsRead(tutor.client, tutor.id);
    const visitor = await anonymousReporter();
    await createSighting(visitor.client, sighting());

    expect(await countUnreadNotifications(tutor.client, tutor.id)).toBe(1);
    const [n] = await listNotifications(tutor.client, tutor.id);
    expect(n!.title).toBe("🟡 Novo avistamento de Mel");
    expect(n!.href).toBe(`/alerta/${code}#linha-do-tempo`);

    const timeline = await getTimeline(anonClient(), code);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({ direction: "N", states: ["running", "scared"], hidden: false });
  });

  it("a visitor with no session at all cannot send", async () => {
    const { error } = await anonClient().rpc("submit_sighting", {
      p_code: code,
      p_lat: SE.lat,
      p_lng: SE.lng,
      p_seen_at: minutesAgo(5),
    });
    expect(error).not.toBeNull();
  });

  it("rejects drafts, the future and photos from someone else's folder", async () => {
    const visitor = await anonymousReporter();
    await expect(createSighting(visitor.client, sighting({ code: draftCode }))).rejects.toThrow("não está mais ativo");
    await expect(
      createSighting(visitor.client, sighting({ seenAt: new Date(Date.now() + 3600_000).toISOString() })),
    ).rejects.toThrow("futuro");
    await expect(createSighting(visitor.client, sighting({ photoPath: `${tutor.id}/x.webp` }))).rejects.toThrow(
      "Foto inválida",
    );
  });

  it("limits repeated sightings (anti-spam)", async () => {
    const spammer = await anonymousReporter();
    for (let i = 0; i < 3; i++) await createSighting(spammer.client, sighting({ seenAt: minutesAgo(10 + i) }));
    await expect(createSighting(spammer.client, sighting())).rejects.toThrow("agora há pouco");
  });
});

describe("tutor moderation of the timeline", () => {
  it("tutor hides a sighting; the public no longer sees it, the tutor still does", async () => {
    const before = await getTimeline(anonClient(), code);
    const target = before[0]!;
    await setSightingHidden(tutor.client, target.id, true);

    expect((await getTimeline(anonClient(), code)).find((s) => s.id === target.id)).toBeUndefined();
    expect((await getTimeline(tutor.client, code)).find((s) => s.id === target.id)?.hidden).toBe(true);

    await setSightingHidden(tutor.client, target.id, false);
    expect((await getTimeline(anonClient(), code)).find((s) => s.id === target.id)).toBeDefined();
  });

  it("strangers cannot hide sightings nor read the tutor's notifications", async () => {
    const [first] = await getTimeline(anonClient(), code);
    await expect(setSightingHidden(stranger.client, first!.id, true)).rejects.toThrow();
    expect(await listNotifications(stranger.client, tutor.id)).toEqual([]);
  });

  it("the reporter's identity is never exposed in the timeline", async () => {
    const raw = JSON.stringify(await getTimeline(anonClient(), code));
    expect(raw).not.toMatch(/reporter/);
    for (const id of anonUsers) expect(raw).not.toContain(id);
  });
});
