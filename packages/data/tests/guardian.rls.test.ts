import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { foundInputSchema, fuzzPoint, guardianSettingsSchema, petInputSchema, reunionSchema } from "@mel/core";
import { createFoundCase } from "../src/found";
import { claimPushBatch, finishPush, type PushJob, getGuardianSettings, savePushSubscription, saveGuardianSettings } from "../src/guardian";
import { activateLostCase, confirmReunion, startLostCase, updateLostCase } from "../src/lostCases";
import { listNotifications } from "../src/notifications";
import { createPet } from "../src/pets";
import { ensureSession } from "../src/auth";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Região própria (Rio de Janeiro) para não cruzar com outros testes na Sé.
const RIO = { lat: -22.9068, lng: -43.1729 };
const near = (d: number) => ({ lat: RIO.lat + d, lng: RIO.lng + d });
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

type U = Awaited<ReturnType<typeof createTestUser>>;
let tutor: U, nearGuardian: U, farGuardian: U, foundOnly: U, limited: U, finder: U;
const anonIds: string[] = [];

async function guardian(u: U, o: Record<string, unknown>) {
  await saveGuardianSettings(u.client, u.id, guardianSettingsSchema.parse({ area: near(0.002), radiusM: 3000, ...o }));
}

async function lostAlert(name: string) {
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name, species: "dog" }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: RIO, lostAt: minutesAgo(30), publicAreaLabel: "Centro, Rio de Janeiro – RJ" });
  return (await activateLostCase(tutor.client, c.id)).code;
}

const guardianAlerts = async (u: U) => (await listNotifications(u.client, u.id, 100)).filter((n) => n.kind === "guardian_alert");

beforeAll(async () => {
  const users = await Promise.all(["g-tutor", "g-near", "g-far", "g-found", "g-limit", "g-finder"].map((l) => createTestUser(l)));
  [tutor, nearGuardian, farGuardian, foundOnly, limited, finder] = users as [U, U, U, U, U, U];
  await guardian(nearGuardian, {});
  await guardian(farGuardian, { area: { lat: -22.95, lng: -43.45 } }); // ~30 km
  await guardian(foundOnly, { alertLost: false, alertFound: true });
  await guardian(limited, { maxPerDay: 1 });
  await guardian(tutor, {}); // o próprio tutor também é Guardião: não deve se avisar
});

afterAll(async () => {
  for (const id of anonIds) await serviceClient().auth.admin.deleteUser(id);
  await Promise.all([tutor, nearGuardian, farGuardian, foundOnly, limited, finder].map((u) => u?.cleanup()));
});

describe("Guardian settings", () => {
  it("stores only an approximate area; anonymous sessions cannot be Guardians", async () => {
    const s = (await getGuardianSettings(nearGuardian.client, nearGuardian.id))!;
    expect(s.area).toEqual(fuzzPoint(near(0.002)));
    expect(s).toMatchObject({ radiusM: 3000, maxPerDay: 5, quietNight: true });
    const visitor = anonClient();
    const { id } = await ensureSession(visitor);
    anonIds.push(id);
    await expect(saveGuardianSettings(visitor, id, guardianSettingsSchema.parse({ area: RIO }))).rejects.toThrow();
    // Ninguém lê a área de outra pessoa.
    expect((await farGuardian.client.from("guardian_settings").select("user_id").eq("user_id", nearGuardian.id)).data).toEqual([]);
  });
});

describe("notifying Guardians", () => {
  let lostCode: string;

  it("an activated alert notifies Guardians in range who asked for it — never the author, never far away", async () => {
    lostCode = await lostAlert("Bolinha");
    const [n] = (await guardianAlerts(nearGuardian)).filter((x) => x.href === `/alerta/${lostCode}`);
    expect(n).toMatchObject({ title: "Pet perdido perto de você: Bolinha", body: "Visto por último perto de Centro, Rio de Janeiro – RJ. Fique de olho e compartilhe." });
    expect((await guardianAlerts(farGuardian)).some((x) => x.href === `/alerta/${lostCode}`)).toBe(false);
    expect((await guardianAlerts(foundOnly)).some((x) => x.href === `/alerta/${lostCode}`)).toBe(false);
    expect((await guardianAlerts(tutor)).some((x) => x.href === `/alerta/${lostCode}`)).toBe(false);
  });

  it("respects the daily limit per Guardian", async () => {
    const before = (await guardianAlerts(limited)).length;
    await lostAlert("Faísca");
    await lostAlert("Trovão");
    expect((await guardianAlerts(limited)).length - before).toBeLessThanOrEqual(1);
    expect(await guardianAlerts(limited)).toHaveLength(1);
  });

  it("a found pet notifies Guardians who want found alerts", async () => {
    const code = await createFoundCase(
      finder.client,
      finder.id,
      foundInputSchema.parse({ species: "cat", position: near(0.001), areaLabel: "Centro, Rio de Janeiro – RJ", foundAt: minutesAgo(5), custody: "street" }),
    );
    const [n] = (await guardianAlerts(foundOnly)).filter((x) => x.href === `/encontrado/${code}`);
    expect(n).toMatchObject({ title: "Gato visto solto perto de você" });
  });

  it("on reunion, notified Guardians get 'resolvido' in the app", async () => {
    await confirmReunion(tutor.client, lostCode, reunionSchema.parse({ how: "came_back" }));
    const resolved = (await listNotifications(nearGuardian.client, nearGuardian.id, 100)).find((x) => x.kind === "guardian_resolved");
    expect(resolved).toMatchObject({ title: "Boa notícia: Bolinha está em casa", href: `/alerta/${lostCode}` });
    expect((await listNotifications(farGuardian.client, farGuardian.id, 100)).some((x) => x.kind === "guardian_resolved")).toBe(false);
  });
});

describe("push queue", () => {
  it("only the server (secret key) claims the queue; jobs carry the device subscriptions", async () => {
    const endpoint = `https://push.example.test/${crypto.randomUUID()}`;
    await expect(savePushSubscription(nearGuardian.client, { endpoint: "http://inseguro", keys: { p256dh: "x", auth: "y" } })).rejects.toThrow("Inscrição inválida.");
    await savePushSubscription(nearGuardian.client, { endpoint, keys: { p256dh: "p", auth: "a" } }, "teste");

    const { error } = await nearGuardian.client.rpc("claim_push_batch", { p_limit: 5 });
    expect(error).not.toBeNull();
    expect((await nearGuardian.client.from("push_outbox" as never).select("id")).data ?? []).toEqual([]);

    await lostAlert("Pipoca"); // novo aviso → fila
    const service = serviceClient();
    let mine: PushJob | undefined;
    for (let i = 0; i < 5 && !mine; i++) {
      const jobs = await claimPushBatch(service, 200);
      mine = jobs.find((j) => j.userId === nearGuardian.id && j.notification.title.includes("Pipoca"));
      // Devolve o que não é deste teste para não atrapalhar outros.
      for (const j of jobs.filter((j) => j !== mine)) await finishPush(service, j.outboxId, "SKIPPED", "teste");
    }
    expect(mine).toBeDefined();
    expect(mine!.subscriptions.map((s) => s.endpoint)).toContain(endpoint);
    await finishPush(service, mine!.outboxId, "SENT", undefined, { ok: [mine!.subscriptions[0]!.id] });
    const { data } = await service.from("push_subscriptions").select("last_success_at").eq("endpoint", endpoint).single();
    expect((data as { last_success_at: string | null }).last_success_at).not.toBeNull();
  });
});
