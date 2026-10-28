import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { distanceMeters, fuzzPoint, petInputSchema, type Pet } from "@mel/core";
import { createPet } from "../src/pets";
import {
  activateLostCase,
  getMyDraft,
  getPublicLostCase,
  nearbyLostCases,
  startLostCase,
  updateLostCase,
} from "../src/lostCases";
import { anonClient, createTestUser } from "./helpers";

// Local público de teste: Praça da Sé.
const SE = { lat: -23.55052, lng: -46.633308 };

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
let pet: Pet;

beforeAll(async () => {
  tutor = await createTestUser("lost-tutor");
  stranger = await createTestUser("lost-stranger");
  // Pet PRIVADO: o alerta precisa publicá-lo mesmo assim.
  pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Mel", species: "dog", breed: "Yorkshire Terrier" }));
});

afterAll(async () => {
  await tutor?.cleanup();
  await stranger?.cleanup();
});

describe("lost case lifecycle", () => {
  let caseId: string;
  let code: string;

  it("starts a draft that is not public", async () => {
    const draft = await startLostCase(tutor.client, tutor.id, pet.id);
    caseId = draft.id;
    code = draft.code;
    expect(draft.status).toBe("DRAFT");
    expect(code).toMatch(/^[a-z2-9]{6}$/);
    expect(await getPublicLostCase(anonClient(), code)).toBeNull();
    expect((await getMyDraft(tutor.client, tutor.id))?.id).toBe(caseId);
  });

  it("reuses the same draft for the same pet", async () => {
    expect((await startLostCase(tutor.client, tutor.id, pet.id)).id).toBe(caseId);
  });

  it("refuses to activate without where/when", async () => {
    await expect(activateLostCase(tutor.client, caseId)).rejects.toThrow("informe onde e quando");
  });

  it("activates and publishes only safe, approximate data", async () => {
    await updateLostCase(tutor.client, caseId, {
      lastSeen: SE,
      lastSeenLabel: "Rua Santa Teresa, Sé, São Paulo – SP",
      publicAreaLabel: "Sé, São Paulo – SP",
      city: "São Paulo",
      state: "SP",
      lostAt: new Date(Date.now() - 35 * 60_000).toISOString(),
      wearing: ["collar"],
      contactPhone: null,
    });
    const active = await activateLostCase(tutor.client, caseId);
    expect(active.status).toBe("ACTIVE");
    expect(active.publishedAt).not.toBeNull();

    const pub = (await getPublicLostCase(anonClient(), code))!;
    expect(pub.pet.name).toBe("Mel");
    expect(pub.areaLabel).toBe("Sé, São Paulo – SP");
    expect(pub.isOwner).toBe(false);
    expect(pub.pointIsExact).toBe(false);
    // Ponto público aproximado — e idêntico ao calculado em TypeScript.
    expect(pub.point).toEqual(fuzzPoint(SE, 250));
    expect(distanceMeters(SE, pub.point!)).toBeLessThan(180);
    // Nada privado na resposta pública.
    const raw = JSON.stringify(pub);
    expect(raw).not.toContain("Santa Teresa");
    expect(raw).not.toContain(String(SE.lat));
    expect(pub.contactPhone).toBeNull();
    expect(pub.contactWhatsapp).toBeNull();
  });

  it("shows contact only when the tutor chose to", async () => {
    await updateLostCase(tutor.client, caseId, { contactWhatsappPublic: true, contactPhone: "11900000001" });
    const pub = (await getPublicLostCase(anonClient(), code))!;
    expect(pub.contactWhatsapp).toBe("11900000001");
    expect(pub.contactPhone).toBeNull();
  });

  it("shows the exact point only when the tutor chose to", async () => {
    await updateLostCase(tutor.client, caseId, { publicPointExact: true });
    expect((await getPublicLostCase(anonClient(), code))!.point).toEqual(SE);
    await updateLostCase(tutor.client, caseId, { publicPointExact: false });
  });

  it("tells the owner it is their alert", async () => {
    expect((await getPublicLostCase(tutor.client, code))!.isOwner).toBe(true);
  });

  it("appears in nearby searches with distance, not beyond the radius", async () => {
    const near = await nearbyLostCases(anonClient(), { lat: -23.5489, lng: -46.6388 }, 2000);
    const mine = near.find((c) => c.code === code);
    expect(mine?.petName).toBe("Mel");
    expect(mine!.distanceMeters).toBeGreaterThan(0);
    // Campinas fica a ~90 km: fora do raio.
    const far = await nearbyLostCases(anonClient(), { lat: -22.9056, lng: -47.0608 }, 5000);
    expect(far.find((c) => c.code === code)).toBeUndefined();
  });

  it("rejects invalid transitions and moderation-only statuses", async () => {
    await expect(tutor.client.from("lost_cases").update({ status: "DRAFT" }).eq("id", caseId).throwOnError()).rejects.toThrow(
      "não volta a rascunho",
    );
    await expect(
      tutor.client.from("lost_cases").update({ status: "REMOVED" }).eq("id", caseId).throwOnError(),
    ).rejects.toThrow("moderação");
  });

  it("forbids a second open alert for the same pet", async () => {
    const { error } = await tutor.client.from("lost_cases").insert({ owner_id: tutor.id, pet_id: pet.id });
    expect(error?.code).toBe("23505");
  });
});

describe("access control", () => {
  it("visitors cannot read the table directly (exact point is private)", async () => {
    const { data, error } = await anonClient().from("lost_cases").select("last_seen_lat");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("strangers see no rows and cannot open alerts for someone else's pet", async () => {
    const { data } = await stranger.client.from("lost_cases").select("id");
    expect(data).toEqual([]);
    await expect(startLostCase(stranger.client, stranger.id, pet.id)).rejects.toThrow();
  });

  it("the public point cannot be forged by the client", async () => {
    const { error } = await tutor.client
      .from("lost_cases")
      .update({ public_lat: 0 } as never)
      .eq("pet_id", pet.id);
    expect(error).not.toBeNull();
  });
});
