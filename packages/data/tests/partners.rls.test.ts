import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessInputSchema, offerSchema } from "@mel/core";
import {
  addOffer,
  createBusiness,
  getBusiness,
  listBusinesses,
  listBusinessesForReview,
  reviewBusiness,
  setOfferSponsored,
} from "../src/partners";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Região própria (Belo Horizonte).
const BH = { lat: -19.9167, lng: -43.9345 };
type U = Awaited<ReturnType<typeof createTestUser>>;
let owner: U, moderator: U, stranger: U;

const business = (o: Record<string, unknown> = {}) =>
  businessInputSchema.parse({
    name: "Clínica Amigo Fiel",
    category: "vet",
    description: "Atendimento 24 horas, leitor de microchip e acolhimento de animais encontrados.",
    addressLabel: "Av. Afonso Pena, 1000 – Centro, Belo Horizonte – MG",
    position: BH,
    phone: "(31) 3333-4444",
    helpsLost: true,
    ...o,
  });

beforeAll(async () => {
  const users = await Promise.all(["p-owner", "p-mod", "p-stranger"].map((l) => createTestUser(l)));
  [owner, moderator, stranger] = users as [U, U, U];
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
});

afterAll(async () => {
  await Promise.all([owner, moderator, stranger].map((u) => u?.cleanup()));
});

describe("partners", () => {
  let code: string;

  it("a new business waits for approval; the owner cannot self-approve", async () => {
    code = await createBusiness(owner.client, owner.id, business());
    expect(await getBusiness(anonClient(), code)).toBeNull();
    expect((await getBusiness(owner.client, code))!).toMatchObject({ status: "PENDING_REVIEW", isOwner: true, planCode: "FREE" });
    const { error } = await owner.client.from("businesses").update({ status: "APPROVED" } as never).eq("short_code", code);
    expect(error).not.toBeNull();
    // Oferta só depois de aprovada.
    await expect(addOffer(owner.client, code, offerSchema.parse({ title: "Consulta com desconto" }))).rejects.toThrow(
      "A empresa precisa estar aprovada para publicar ofertas.",
    );
  });

  it("moderation approves; it shows up in the directory near its address, with distance", async () => {
    await expect(listBusinessesForReview(owner.client)).rejects.toThrow("Acesso restrito à moderação.");
    await reviewBusiness(moderator.client, code, true);
    const list = await listBusinesses(anonClient(), { lat: BH.lat + 0.01, lng: BH.lng }, { radiusM: 5000, categories: ["vet"] });
    const found = list.find((b) => b.code === code);
    expect(found).toMatchObject({ name: "Clínica Amigo Fiel", phone: "3133334444", helpsLost: true, isOwner: false });
    expect(found!.distanceM).toBeGreaterThan(1000);
    expect((await listBusinesses(anonClient(), BH, { categories: ["petshop"] })).some((b) => b.code === code)).toBe(false);
  });

  it("offers: the owner publishes; only moderation marks 'Patrocinado'", async () => {
    await addOffer(owner.client, code, offerSchema.parse({ title: "Microchipagem com 20% off", description: "Até o fim do mês." }));
    const [offer] = (await getBusiness(anonClient(), code))!.offers;
    expect(offer).toMatchObject({ title: "Microchipagem com 20% off", isSponsored: false });
    await expect(setOfferSponsored(owner.client, offer!.id, true)).rejects.toThrow("Só a moderação marca ofertas como patrocinadas.");
    await setOfferSponsored(moderator.client, offer!.id, true);
    expect((await getBusiness(anonClient(), code))!.offers[0]!.isSponsored).toBe(true);
    // Estranhos não publicam ofertas em empresas alheias.
    await expect(addOffer(stranger.client, code, offerSchema.parse({ title: "Golpe" }))).rejects.toThrow();
  });

  it("changing the address of an approved business sends it back to review", async () => {
    const { error } = await owner.client.from("businesses").update({ address_label: "Outro endereço, 50" } as never).eq("short_code", code);
    expect(error).toBeNull();
    expect((await getBusiness(owner.client, code))!.status).toBe("PENDING_REVIEW");
    expect(await getBusiness(anonClient(), code)).toBeNull();
  });

  it("plans exist without any price (no billing in the MVP)", async () => {
    const { data } = await anonClient().from("plans").select("code, price_cents").order("sort");
    expect(data).toEqual([
      { code: "FREE", price_cents: null },
      { code: "LOCAL", price_cents: null },
      { code: "PRO", price_cents: null },
      { code: "PREMIUM", price_cents: null },
    ]);
  });
});
