import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { petInputSchema, reunionSchema, sightingInputSchema } from "@mel/core";
import { ensureSession } from "../src/auth";
import { sendMessage, startConversation } from "../src/chat";
import { activateLostCase, confirmReunion, getPublicLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { listNotifications } from "../src/notifications";
import { createPet } from "../src/pets";
import { createSighting, getTimeline } from "../src/sightings";
import { anonClient, createTestUser, serviceClient } from "./helpers";

const SE = { lat: -23.55052, lng: -46.633308 };
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let helper: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
const anonUsers: string[] = [];

async function activeAlert(name: string) {
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name, species: "dog" }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: SE, lostAt: minutesAgo(15), publicAreaLabel: "Sé, São Paulo – SP" });
  return (await activateLostCase(tutor.client, c.id)).code;
}

beforeAll(async () => {
  tutor = await createTestUser("reunion-tutor");
  helper = await createTestUser("reunion-helper");
  stranger = await createTestUser("reunion-stranger");
});

afterAll(async () => {
  for (const id of anonUsers) await serviceClient().auth.admin.deleteUser(id);
  await tutor?.cleanup();
  await helper?.cleanup();
  await stranger?.cleanup();
});

describe("confirming a reunion", () => {
  it("only the tutor confirms; the alert becomes FOUND; helpers are thanked; the KPI event is recorded", async () => {
    const code = await activeAlert("Mel");
    // Visitante sem conta envia a pista que ajudou; outra pessoa conversa com o tutor.
    const visitor = anonClient();
    anonUsers.push((await ensureSession(visitor)).id);
    await createSighting(visitor, sightingInputSchema.parse({ code, position: { lat: -23.5489, lng: -46.6388 }, seenAt: minutesAgo(5) }));
    const conv = await startConversation(helper.client, code, "Vi ela perto do metrô!");
    await sendMessage(tutor.client, conv, tutor.id, "Obrigada!");
    const sightingId = (await getTimeline(tutor.client, code))[0]!.id;

    const input = reunionSchema.parse({ how: "sighting_mel", helpfulSightingId: sightingId, foundAreaLabel: " Liberdade ", story: "Estava escondida num quintal." });
    await expect(confirmReunion(stranger.client, code, input)).rejects.toThrow("Alerta não encontrado.");
    await confirmReunion(tutor.client, code, input);

    const c = (await getPublicLostCase(anonClient(), code))!;
    expect(c).toMatchObject({
      status: "FOUND",
      foundHow: "sighting_mel",
      foundAreaLabel: "Liberdade",
      reunionStory: "Estava escondida num quintal.",
      helpfulSightingId: sightingId,
      helpersCount: 2,
    });
    expect(c.foundAt).not.toBeNull();
    // Linha do tempo preservada.
    expect(await getTimeline(anonClient(), code)).toHaveLength(1);

    const [visitorThanks] = await listNotifications(visitor, anonUsers[0]!);
    expect(visitorThanks).toMatchObject({ kind: "reunion_thanks", title: "Mel está em casa!", href: `/alerta/${code}` });
    expect(visitorThanks!.body).toContain("A sua pista ajudou");
    const [helperThanks] = await listNotifications(helper.client, helper.id);
    expect(helperThanks).toMatchObject({ kind: "reunion_thanks", body: "Obrigado por fazer parte da busca." });
    expect((await listNotifications(tutor.client, tutor.id)).some((n) => n.kind === "reunion_thanks")).toBe(false);

    const { data: events } = await serviceClient().from("events").select("name, props").eq("subject_id", (await serviceClient().from("lost_cases").select("id").eq("short_code", code).single()).data!.id);
    expect(events).toEqual([{ name: "pet_reunited", props: { how: "sighting_mel", helpful_sighting: true } }]);
    // Ninguém comum lê os eventos.
    expect((await tutor.client.from("events").select("id")).data).toEqual([]);

    // Encontrado: não aceita mais avistamentos nem um segundo reencontro.
    await expect(createSighting(visitor, sightingInputSchema.parse({ code, position: SE, seenAt: minutesAgo(1) }))).rejects.toThrow();
    await expect(confirmReunion(tutor.client, code, input)).rejects.toThrow("Este alerta não está mais ativo.");
    // O chat continua aberto para agradecer.
    await sendMessage(helper.client, conv, helper.id, "Que alegria!");
  });

  it("rejects a 'helpful' sighting from another alert and unknown ways of finding", async () => {
    const a = await activeAlert("Thor");
    const b = await activeAlert("Nina");
    const visitor = anonClient();
    anonUsers.push((await ensureSession(visitor)).id);
    await createSighting(visitor, sightingInputSchema.parse({ code: b, position: SE, seenAt: minutesAgo(5) }));
    const otherSighting = (await getTimeline(tutor.client, b))[0]!.id;
    await expect(
      confirmReunion(tutor.client, a, reunionSchema.parse({ how: "came_back", helpfulSightingId: otherSighting })),
    ).rejects.toThrow("Esta pista não é deste alerta.");
    const { error } = await tutor.client.rpc("confirm_reunion", { p_code: a, p_how: "teleporte" });
    expect(error).not.toBeNull();
    expect((await getPublicLostCase(anonClient(), a))!.status).toBe("ACTIVE");
  });

  it("a tutor cannot skip the function by writing helpful_sighting_id directly", async () => {
    const code = await activeAlert("Bolt");
    const { error } = await tutor.client
      .from("lost_cases")
      .update({ helpful_sighting_id: crypto.randomUUID() } as never)
      .eq("short_code", code);
    expect(error).not.toBeNull();
  });
});
