import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isMelId, petInputSchema, type Pet } from "@mel/core";
import { ensureSession } from "../src/auth";
import {
  addPetPhoto,
  createPet,
  deletePet,
  getPet,
  getPetByMelId,
  getPetPrivateDetails,
  listMyPets,
  removePetPhoto,
  savePetPrivateDetails,
  setPrimaryPetPhoto,
  updatePet,
} from "../src/pets";
import { anonClient, createTestUser, serviceClient } from "./helpers";

const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);
const photo = () => ({ full: new Blob([PNG], { type: "image/png" }), thumb: new Blob([PNG], { type: "image/png" }) });

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
let privatePet: Pet;
let publicPet: Pet;

beforeAll(async () => {
  tutor = await createTestUser("tutor");
  stranger = await createTestUser("stranger");
  privatePet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Mel", species: "dog" }));
  publicPet = await createPet(
    tutor.client,
    tutor.id,
    petInputSchema.parse({ name: "Luna", species: "cat", colorPrimary: "cinza", isPublic: true }),
  );
});

afterAll(async () => {
  await tutor?.cleanup();
  await stranger?.cleanup();
});

describe("pets", () => {
  it("gets a readable MEL ID on creation", () => {
    expect(isMelId(privatePet.melId)).toBe(true);
    expect(privatePet.melId).not.toBe(publicPet.melId);
  });

  it("lists the owner's pets", async () => {
    const pets = await listMyPets(tutor.client, tutor.id);
    expect(pets.map((p) => p.name).sort()).toEqual(["Luna", "Mel"]);
  });

  it("hides private pets from strangers and visitors", async () => {
    expect(await getPet(stranger.client, privatePet.id)).toBeNull();
    expect(await getPetByMelId(anonClient(), privatePet.melId)).toBeNull();
  });

  it("shows public pets to anyone", async () => {
    const pet = await getPetByMelId(anonClient(), publicPet.melId);
    expect(pet?.name).toBe("Luna");
  });

  it("lets the owner edit, but not strangers", async () => {
    const edited = await updatePet(
      tutor.client,
      privatePet.id,
      petInputSchema.parse({ name: "Mel", species: "dog", breed: "Yorkshire Terrier", size: "mini" }),
    );
    expect(edited.breed).toBe("Yorkshire Terrier");

    await expect(
      updatePet(stranger.client, privatePet.id, petInputSchema.parse({ name: "Roubado", species: "dog" })),
    ).rejects.toThrow();
  });

  it("cannot change the MEL ID or the owner", async () => {
    const { error: melError } = await tutor.client.from("pets").update({ mel_id: "MEL-AAAAAA" }).eq("id", privatePet.id);
    expect(melError).not.toBeNull();
    const { error: ownerError } = await tutor.client
      .from("pets")
      .update({ owner_id: stranger.id } as never)
      .eq("id", privatePet.id);
    expect(ownerError).not.toBeNull();
  });

  it("forbids registering a pet for someone else", async () => {
    await expect(
      createPet(stranger.client, tutor.id, petInputSchema.parse({ name: "Falso", species: "dog" })),
    ).rejects.toThrow();
  });

  it("forbids anonymous sessions from registering pets", async () => {
    const client = anonClient();
    const user = await ensureSession(client);
    try {
      await expect(createPet(client, user.id, petInputSchema.parse({ name: "X", species: "dog" }))).rejects.toThrow();
    } finally {
      await serviceClient().auth.admin.deleteUser(user.id);
    }
  });
});

describe("private details (proof of ownership)", () => {
  it("are readable only by the owner — even for a public pet", async () => {
    await savePetPrivateDetails(tutor.client, publicPet, {
      microchipNumber: "982000000000001",
      hiddenMarks: "Mancha branca na barriga",
      ownershipNotes: null,
    });
    expect((await getPetPrivateDetails(tutor.client, publicPet.id)).hiddenMarks).toBe("Mancha branca na barriga");

    expect(await getPetPrivateDetails(stranger.client, publicPet.id)).toEqual({
      microchipNumber: null,
      hiddenMarks: null,
      ownershipNotes: null,
    });
    const { data, error } = await anonClient().from("pet_private_details").select("*");
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501");
  });

  it("cannot be attached to someone else's pet", async () => {
    await expect(
      savePetPrivateDetails(stranger.client, { id: publicPet.id, ownerId: stranger.id }, {
        microchipNumber: "1",
        hiddenMarks: null,
        ownershipNotes: null,
      }),
    ).rejects.toThrow();
  });
});

describe("photos", () => {
  it("uploads, picks the first as primary, switches primary and removes", async () => {
    await addPetPhoto(tutor.client, publicPet, photo(), 0);
    let pet = (await getPet(tutor.client, publicPet.id))!;
    await addPetPhoto(tutor.client, pet, photo(), 1);
    pet = (await getPet(tutor.client, publicPet.id))!;

    expect(pet.photos).toHaveLength(2);
    expect(pet.photos[0]!.isPrimary).toBe(true);
    expect((await fetch(pet.photos[0]!.thumbUrl)).ok).toBe(true);

    const second = pet.photos[1]!;
    await setPrimaryPetPhoto(tutor.client, pet.id, second.id);
    pet = (await getPet(tutor.client, publicPet.id))!;
    expect(pet.photos[0]!.id).toBe(second.id);

    await removePetPhoto(tutor.client, second.id);
    pet = (await getPet(tutor.client, publicPet.id))!;
    expect(pet.photos).toHaveLength(1);
    expect(pet.photos[0]!.isPrimary).toBe(true);
  });

  it("public pet photos are visible to visitors; private ones are not", async () => {
    await addPetPhoto(tutor.client, privatePet, photo(), 0);
    expect((await getPetByMelId(anonClient(), publicPet.melId))?.photos.length).toBe(1);
    const { data } = await anonClient().from("pet_photos").select("id").eq("pet_id", privatePet.id);
    expect(data).toEqual([]);
  });

  it("strangers cannot add photos to someone else's pet", async () => {
    await expect(addPetPhoto(stranger.client, { ...publicPet, ownerId: stranger.id }, photo(), 5)).rejects.toThrow();
    await expect(addPetPhoto(stranger.client, publicPet, photo(), 5)).rejects.toThrow();
  });

  it("deleting a pet removes its files from storage", async () => {
    const pet = (await getPet(tutor.client, privatePet.id))!;
    await deletePet(tutor.client, pet);
    const { data } = await serviceClient().storage.from("pet-photos").list(`${tutor.id}/${pet.id}`);
    expect(data).toEqual([]);
    expect(await getPet(tutor.client, pet.id)).toBeNull();
  });
});
