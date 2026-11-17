import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { petInputSchema, type Pet } from "@mel/core";
import { createPet } from "../src/pets";
import { activateLostCase, closeLostCase, getPublicLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { anonClient, createTestUser } from "./helpers";

// Bonificação opcional do tutor (migration 51, decisão do proprietário de 2026-11-17):
// só o tutor grava; o público só vê com o alerta ATIVO; o banco recusa valores fora da faixa.
let tutor: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
let pet: Pet;
let caseId: string;
let code: string;

beforeAll(async () => {
  tutor = await createTestUser("reward-tutor");
  stranger = await createTestUser("reward-stranger");
  pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Bonus", species: "dog" }));
  const draft = await startLostCase(tutor.client, tutor.id, pet.id);
  caseId = draft.id;
  code = draft.code;
  await updateLostCase(tutor.client, caseId, {
    lastSeen: { lat: -23.55052, lng: -46.633308 },
    publicAreaLabel: "Sé, São Paulo – SP",
    lostAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    rewardCents: 50_000,
  });
});

afterAll(async () => {
  await tutor?.cleanup();
  await stranger?.cleanup();
});

describe("lost case reward", () => {
  it("is hidden while the alert is a draft", async () => {
    expect(await getPublicLostCase(anonClient(), code)).toBeNull();
  });

  it("is public only once the alert is active", async () => {
    await activateLostCase(tutor.client, caseId);
    expect((await getPublicLostCase(anonClient(), code))?.rewardCents).toBe(50_000);
  });

  it("rejects zero, negative and values above R$ 100.000,00", async () => {
    for (const rewardCents of [0, -100, 10_000_001]) await expect(updateLostCase(tutor.client, caseId, { rewardCents })).rejects.toThrow();
    expect((await getPublicLostCase(anonClient(), code))?.rewardCents).toBe(50_000);
  });

  it("only the tutor changes it; null removes it", async () => {
    await expect(updateLostCase(stranger.client, caseId, { rewardCents: 1 })).rejects.toThrow();
    await updateLostCase(tutor.client, caseId, { rewardCents: null });
    expect((await getPublicLostCase(anonClient(), code))?.rewardCents).toBeNull();
    await updateLostCase(tutor.client, caseId, { rewardCents: 25_000 });
    expect((await getPublicLostCase(anonClient(), code))?.rewardCents).toBe(25_000);
  });

  it("disappears from the public page when the alert is closed", async () => {
    await closeLostCase(tutor.client, code);
    const pub = await getPublicLostCase(anonClient(), code);
    expect(pub?.status).toBe("CLOSED");
    expect(pub?.rewardCents).toBeNull();
  });
});
