import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { foundInputSchema, petInputSchema, sightingInputSchema } from "@mel/core";
import { ensureSession } from "../src/auth";
import { createFoundCase } from "../src/found";
import { activateLostCase, getPublicLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { getAdminOverview, getAuditLog, listAdminReports, moderate, reportContent } from "../src/moderation";
import { createPet } from "../src/pets";
import { createSighting, getTimeline } from "../src/sightings";
import { anonClient, createTestUser, serviceClient } from "./helpers";

const POA = { lat: -30.0346, lng: -51.2177 }; // região própria (Porto Alegre)
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

type U = Awaited<ReturnType<typeof createTestUser>>;
let tutor: U, moderator: U, reporter: U, abuser: U;
const anonIds: string[] = [];

async function lostAlert(u: U, name: string) {
  const pet = await createPet(u.client, u.id, petInputSchema.parse({ name, species: "dog" }));
  const c = await startLostCase(u.client, u.id, pet.id);
  await updateLostCase(u.client, c.id, { lastSeen: POA, lostAt: minutesAgo(30), publicAreaLabel: "Centro, Porto Alegre – RS" });
  return (await activateLostCase(u.client, c.id)).code;
}

beforeAll(async () => {
  const users = await Promise.all(["m-tutor", "m-mod", "m-rep", "m-abuser"].map((l) => createTestUser(l)));
  [tutor, moderator, reporter, abuser] = users as [U, U, U, U];
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
});

afterAll(async () => {
  for (const id of anonIds) await serviceClient().auth.admin.deleteUser(id);
  await Promise.all([tutor, moderator, reporter, abuser].map((u) => u?.cleanup()));
});

describe("reporting content", () => {
  it("anyone with a session reports an alert; the same open report is not duplicated", async () => {
    const code = await lostAlert(abuser, "Golpe");
    const visitor = anonClient();
    anonIds.push((await ensureSession(visitor)).id);
    const a = await reportContent(visitor, { type: "lost_case", key: code }, { reason: "scam", details: "Pede PIX" });
    expect(await reportContent(visitor, { type: "lost_case", key: code }, { reason: "scam", details: null })).toBe(a);
    await reportContent(reporter.client, { type: "lost_case", key: code }, { reason: "fake", details: null });
    await expect(reportContent(reporter.client, { type: "lost_case", key: "zzzzzz" }, { reason: "spam", details: null })).rejects.toThrow(
      "Não encontramos esse conteúdo.",
    );
    // Quem denunciou vê a própria denúncia; outros não.
    expect((await reporter.client.from("reports").select("id")).data).toHaveLength(1);
    expect((await tutor.client.from("reports").select("id")).data).toEqual([]);
  });
});

describe("moderation panel", () => {
  it("is closed to non-moderators", async () => {
    for (const fn of [() => getAdminOverview(tutor.client), () => listAdminReports(tutor.client), () => getAuditLog(tutor.client)]) {
      await expect(fn()).rejects.toThrow("Acesso restrito à moderação.");
    }
    const [r] = await listAdminReports(moderator.client);
    await expect(moderate(tutor.client, r!.id, "dismiss")).rejects.toThrow("Acesso restrito à moderação.");
  });

  it("shows real counts and the queue with a summary of each target", async () => {
    const o = await getAdminOverview(moderator.client);
    expect(o.openReports).toBeGreaterThanOrEqual(2);
    expect(o.activeLost).toBeGreaterThanOrEqual(1);
    const mine = (await listAdminReports(moderator.client)).filter((r) => r.target?.title === "Alerta: Golpe");
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatchObject({ targetType: "lost_case", status: "OPEN", reportsForTarget: 2 });
    expect(mine[0]!.target!.href).toMatch(/^\/alerta\//);
  });

  it("hiding an alert removes it from the public, closes every open report about it and is audited", async () => {
    const [r] = (await listAdminReports(moderator.client)).filter((x) => x.target?.title === "Alerta: Golpe");
    const code = r!.target!.href!.split("/").pop()!;
    await moderate(moderator.client, r!.id, "hide", "Golpe confirmado");
    expect(await getPublicLostCase(anonClient(), code)).toBeNull();
    expect((await listAdminReports(moderator.client)).some((x) => x.target?.title === "Alerta: Golpe")).toBe(false);
    const closed = (await listAdminReports(moderator.client, false)).filter((x) => x.target?.title === "Alerta: Golpe");
    expect(closed.every((x) => x.status === "ACTIONED")).toBe(true);
    const [entry] = await getAuditLog(moderator.client);
    expect(entry).toMatchObject({ action: "hide", targetType: "lost_case", reason: "Golpe confirmado" });
  });

  it("suspending the author blocks new posts; dismissing keeps the content", async () => {
    // Avistamento abusivo + encontrado do mesmo autor.
    const code = await lostAlert(tutor, "Lua");
    await createSighting(abuser.client, sightingInputSchema.parse({ code, position: POA, seenAt: minutesAgo(5), notes: "spam spam" }));
    const sightingId = (await getTimeline(anonClient(), code))[0]!.id;
    await reportContent(reporter.client, { type: "sighting", key: sightingId }, { reason: "spam", details: null });
    const [r] = (await listAdminReports(moderator.client)).filter((x) => x.targetType === "sighting" && x.targetId === sightingId);
    await moderate(moderator.client, r!.id, "suspend");
    await expect(
      createFoundCase(abuser.client, abuser.id, foundInputSchema.parse({ species: "dog", position: POA, foundAt: minutesAgo(1), custody: "street" })),
    ).rejects.toThrow("Sua conta está suspensa.");
    await expect(moderate(moderator.client, r!.id, "suspend")).resolves.toBeUndefined(); // idempotente
    await expect(
      moderate(moderator.client, r!.id, "teleportar" as never),
    ).rejects.toThrow("Ação inválida.");

    // Descartar: o conteúdo continua público.
    const other = await lostAlert(tutor, "Sol");
    await reportContent(reporter.client, { type: "lost_case", key: other }, { reason: "other", details: "engano" });
    const [d] = (await listAdminReports(moderator.client)).filter((x) => x.target?.href === `/alerta/${other}`);
    await moderate(moderator.client, d!.id, "dismiss");
    expect(await getPublicLostCase(anonClient(), other)).not.toBeNull();
  });
});
