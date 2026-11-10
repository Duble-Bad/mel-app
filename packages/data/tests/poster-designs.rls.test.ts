import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { petInputSchema } from "@mel/core";
import { activateLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { addPetPhoto, createPet, getPet } from "../src/pets";
import { getPosterDesigns, resetPosterDesign, savePosterDesign } from "../src/posterDesigns";
import { anonClient, createTestUser } from "./helpers";

// Cartaz salvo na conta (migrations 47 e 48): enquadramento de cada foto, inclusive menor que o espaço.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);
const photo = () => ({ full: new Blob([PNG], { type: "image/png" }), thumb: new Blob([PNG], { type: "image/png" }) });
const SE = { lat: -23.55052, lng: -46.633308 };

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
let code: string;
let photoIds: string[];

beforeAll(async () => {
  tutor = await createTestUser("poster-tutor");
  stranger = await createTestUser("poster-stranger");
  let pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Quadro", species: "dog" }));
  await addPetPhoto(tutor.client, pet, photo(), 0);
  pet = (await getPet(tutor.client, pet.id))!;
  await addPetPhoto(tutor.client, pet, photo(), 1);
  pet = (await getPet(tutor.client, pet.id))!;
  photoIds = pet.photos.map((p) => p.id);
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: SE, lostAt: new Date(Date.now() - 3_600_000).toISOString(), publicAreaLabel: "Sé, São Paulo – SP" });
  code = (await activateLostCase(tutor.client, c.id)).code;
});

afterAll(async () => {
  await tutor?.cleanup();
  await stranger?.cleanup();
});

describe("poster designs: framing of every photo", () => {
  it("saves and reads back the framing of the main and the complementary photo, including smaller than the box", async () => {
    expect(photoIds).toHaveLength(2);
    const framings = [
      { x: 40, y: 60, zoom: 1.5 },
      { x: 50, y: 50, zoom: 0.6 },
    ];
    await savePosterDesign(tutor.client, code, { format: "square", model: 2, photoIds, framings });
    const [d] = await getPosterDesigns(anonClient(), code);
    expect(d).toMatchObject({ format: "square", model: 2, photoIds, framings });
    // Sem ajuste numa foto: null nessa posição.
    await savePosterDesign(tutor.client, code, { format: "story", model: 3, photoIds, framings: [null, { x: 10, y: 90, zoom: 2 }] });
    const story = (await getPosterDesigns(anonClient(), code)).find((x) => x.format === "story")!;
    expect(story.framings).toEqual([null, { x: 10, y: 90, zoom: 2 }]);
  });

  it("rejects framings out of range or misaligned with the photos, and anyone who is not the tutor", async () => {
    await expect(savePosterDesign(tutor.client, code, { format: "square", model: 2, photoIds, framings: [{ x: 50, y: 50, zoom: 5 }, null] })).rejects.toThrow("Enquadramento inválido.");
    await expect(savePosterDesign(tutor.client, code, { format: "square", model: 2, photoIds, framings: [{ x: 50, y: 50, zoom: 0.1 }, null] })).rejects.toThrow("Enquadramento inválido.");
    await expect(savePosterDesign(tutor.client, code, { format: "square", model: 2, photoIds, framings: [{ x: 150, y: 50, zoom: 1 }, null] })).rejects.toThrow("Enquadramento inválido.");
    // Uma posição a mais que as fotos.
    const { error } = await tutor.client.rpc("save_poster_design", {
      p_code: code,
      p_format: "square",
      p_model: 2,
      p_photo_ids: photoIds,
      p_framings: [null, null, { x: 50, y: 50, zoom: 1 }],
    });
    expect(error?.message).toBe("Enquadramento inválido.");
    await expect(savePosterDesign(stranger.client, code, { format: "square", model: 2, photoIds, framings: [null, null] })).rejects.toThrow(/Só o tutor/);
    // Nada mudou no que estava salvo.
    const [d] = (await getPosterDesigns(anonClient(), code)).filter((x) => x.format === "square");
    expect(d!.framings).toEqual([
      { x: 40, y: 60, zoom: 1.5 },
      { x: 50, y: 50, zoom: 0.6 },
    ]);
  });

  it("the table is not reachable directly, and reset removes the saved format", async () => {
    expect((await tutor.client.from("poster_designs").select("framings")).data ?? []).toEqual([]);
    await resetPosterDesign(tutor.client, code, "story");
    expect((await getPosterDesigns(anonClient(), code)).map((x) => x.format)).toEqual(["square"]);
  });
});
