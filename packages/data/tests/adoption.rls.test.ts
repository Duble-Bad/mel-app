import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adoptionInputSchema, interestSchema } from "@mel/core";
import {
  createAdoption,
  getAdoption,
  listAdoptions,
  listAdoptionsForReview,
  reviewAdoption,
  setAdoptionStatus,
  submitAdoptionInterest,
} from "../src/adoption";
import { getConversation, listMessages, listMyConversations } from "../src/chat";
import { listNotifications } from "../src/notifications";
import { anonClient, createTestUser, serviceClient } from "./helpers";

type U = Awaited<ReturnType<typeof createTestUser>>;
let donor: U, adopter: U, moderator: U, stranger: U;

const listing = (u: U, o: Record<string, unknown> = {}) =>
  adoptionInputSchema.parse({
    name: "Biscoito",
    species: "dog",
    size: "small",
    temperament: ["docil", "criancas"],
    description: "Muito carinhoso, adora passear e se dá bem com crianças e outros cães.",
    position: { lat: -25.4284, lng: -49.2733 },
    areaLabel: "Centro, Curitiba – PR",
    photoPaths: [`${u.id}/adocao/biscoito.webp`],
    ...o,
  });

beforeAll(async () => {
  const users = await Promise.all(["a-donor", "a-adopter", "a-mod", "a-stranger"].map((l) => createTestUser(l)));
  [donor, adopter, moderator, stranger] = users as [U, U, U, U];
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
});

afterAll(async () => {
  await Promise.all([donor, adopter, moderator, stranger].map((u) => u?.cleanup()));
});

describe("adoption listing lifecycle", () => {
  let code: string;

  it("a new listing waits for moderation and is not public yet", async () => {
    code = await createAdoption(donor.client, donor.id, listing(donor));
    expect(await getAdoption(anonClient(), code)).toBeNull();
    expect((await getAdoption(donor.client, code))!).toMatchObject({ status: "PENDING_REVIEW", isOwner: true });
    await expect(createAdoption(donor.client, donor.id, listing(donor, { photoPaths: [`${stranger.id}/x.webp`] }))).rejects.toThrow("Foto inválida.");
    // Quem doa não aprova o próprio anúncio.
    await expect(setAdoptionStatus(donor.client, code, "AVAILABLE")).rejects.toThrow();
  });

  it("the moderator approves; it appears in the public list", async () => {
    expect((await listAdoptionsForReview(moderator.client)).some((a) => a.code === code)).toBe(true);
    await expect(listAdoptionsForReview(donor.client)).rejects.toThrow("Acesso restrito à moderação.");
    await reviewAdoption(moderator.client, code, true);
    const pub = (await getAdoption(anonClient(), code))!;
    expect(pub).toMatchObject({ status: "AVAILABLE", name: "Biscoito", isOwner: false, interests: null, areaLabel: "Centro, Curitiba – PR" });
    expect((await listAdoptions(anonClient(), { species: ["dog"], pageSize: 60 })).items.some((a) => a.code === code)).toBe(true);
  });

  it("an interested person (account) opens a chat with the donor; visitors without session cannot", async () => {
    const { error } = await anonClient().rpc("submit_adoption_interest", { p_code: code, p_housing: "house", p_other_pets: false, p_children: false, p_message: "Quero muito adotar." });
    expect(error).not.toBeNull();
    await expect(submitAdoptionInterest(donor.client, code, interestSchema.parse({ housing: "house", otherPets: false, children: false, message: "Meu próprio anúncio." }))).rejects.toThrow("Este anúncio é seu.");

    const convId = await submitAdoptionInterest(
      adopter.client,
      code,
      interestSchema.parse({ housing: "apartment", otherPets: true, children: false, message: "Trabalho em casa e já tenho uma cachorrinha calma." }),
    );
    const conv = (await getConversation(donor.client, convId))!;
    expect(conv).toMatchObject({ context: "adoption", code, myRole: "owner", petName: "Biscoito" });
    const [m] = await listMessages(donor.client, convId);
    expect(m!.body).toContain("Moradia: apartamento · Outros pets: sim · Crianças em casa: não");
    expect((await listNotifications(donor.client, donor.id)).some((n) => n.kind === "message_new")).toBe(true);
    expect((await listMyConversations(adopter.client)).some((c) => c.id === convId && c.myRole === "helper")).toBe(true);
    expect((await getAdoption(donor.client, code))!.interests).toBe(1);
  });

  it("the donor moves it through 'em processo' and 'adotado'; only moderation removes", async () => {
    await setAdoptionStatus(donor.client, code, "IN_PROCESS");
    expect((await getAdoption(anonClient(), code))!.status).toBe("IN_PROCESS");
    await setAdoptionStatus(donor.client, code, "ADOPTED");
    expect((await listAdoptions(anonClient(), { pageSize: 60 })).items.some((a) => a.code === code)).toBe(false); // adotado sai da lista
    expect((await getAdoption(anonClient(), code))!.status).toBe("ADOPTED"); // mas a página continua (história)
    await expect(setAdoptionStatus(stranger.client, code, "AVAILABLE")).rejects.toThrow("Você não pode alterar este anúncio.");
    const { error } = await donor.client.from("adoption_listings").update({ status: "REMOVED" } as never).eq("short_code", code);
    expect(error).not.toBeNull();
  });

  it("a rejected listing never becomes public", async () => {
    const other = await createAdoption(donor.client, donor.id, listing(donor, { name: "Pipoca" }));
    await reviewAdoption(moderator.client, other, false, "Fotos de outro animal");
    expect(await getAdoption(anonClient(), other)).toBeNull();
    expect((await getAdoption(donor.client, other))!).toMatchObject({ status: "REJECTED", reviewNote: "Fotos de outro animal" });
  });
});
