// Moderação de adoção e parceiros: conteúdo aprovado não muda sem revisão,
// a nota é só da moderação, e anúncio/empresa aprovados podem ser denunciados
// e tirados do ar pelo painel.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { adoptionInputSchema, businessInputSchema } from "@mel/core";
import { createAdoption, getAdoption, listAdoptions, reviewAdoption, setAdoptionStatus } from "../src/adoption";
import { listAdminReports, moderate, reportContent } from "../src/moderation";
import { createBusiness, getBusiness, listBusinesses, reviewBusiness } from "../src/partners";
import { anonClient, createTestUser, serviceClient } from "./helpers";

type U = Awaited<ReturnType<typeof createTestUser>>;
let owner: U, moderator: U, visitor: U;
const POA = { lat: -30.0346, lng: -51.2177 }; // região própria (Porto Alegre)

const listing = (o: Record<string, unknown> = {}) =>
  adoptionInputSchema.parse({
    name: "Farofa",
    species: "cat",
    size: "small",
    temperament: ["docil"],
    description: "Gata tranquila, castrada, acostumada com apartamento e com outras gatas.",
    position: POA,
    areaLabel: "Centro Histórico, Porto Alegre – RS",
    photoPaths: [`${owner.id}/adocao/farofa.webp`],
    ...o,
  });

const business = () =>
  businessInputSchema.parse({
    name: "Pet Shop Ponto Azul",
    category: "petshop",
    description: "Banho, tosa e ração; acolhemos animais encontrados até o tutor aparecer.",
    addressLabel: "Rua dos Andradas, 100 – Centro, Porto Alegre – RS",
    position: POA,
    phone: "(51) 3333-0000",
    helpsLost: true,
  });

const statusOf = async (table: "adoption_listings" | "businesses", code: string) =>
  (await serviceClient().from(table).select("status, review_note").eq("short_code", code).single()).data!;

beforeAll(async () => {
  [owner, moderator, visitor] = await Promise.all([createTestUser("lm-owner"), createTestUser("lm-mod"), createTestUser("lm-visitor")]);
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
});

// Limites por conta (5 anúncios/dia, 5 empresas): cada teste apaga o que criou.
afterEach(async () => {
  await serviceClient().from("adoption_listings").delete().eq("owner_id", owner.id);
  await serviceClient().from("businesses").delete().eq("owner_id", owner.id);
});

afterAll(async () => {
  await owner?.cleanup();
  await moderator?.cleanup();
  await visitor?.cleanup();
});

describe("adoption: approved content cannot change without review", () => {
  it("changing content together with the status (the old bypass) goes back to review and leaves the public list", async () => {
    const code = await createAdoption(owner.client, owner.id, listing());
    await reviewAdoption(moderator.client, code, true);
    expect((await statusOf("adoption_listings", code)).status).toBe("AVAILABLE");

    const { error } = await owner.client
      .from("adoption_listings")
      .update({ status: "IN_PROCESS", description: "Faça um PIX de R$ 200 para reservar: chave 000.000.000-00." } as never)
      .eq("short_code", code);
    expect(error).toBeNull();
    expect((await statusOf("adoption_listings", code)).status).toBe("PENDING_REVIEW");
    const { items } = await listAdoptions(anonClient(), { pageSize: 100 });
    expect(items.map((i) => i.code)).not.toContain(code);
  });

  it("only the status (available ↔ in process ↔ adopted) still works without review", async () => {
    const code = await createAdoption(owner.client, owner.id, listing({ name: "Paçoca" }));
    await reviewAdoption(moderator.client, code, true);
    await setAdoptionStatus(owner.client, code, "IN_PROCESS");
    expect((await statusOf("adoption_listings", code)).status).toBe("IN_PROCESS");
  });

  it("the owner cannot write the moderation note", async () => {
    const code = await createAdoption(owner.client, owner.id, listing({ name: "Nota" }));
    await reviewAdoption(moderator.client, code, false, "Fotos de outro animal");
    const { error } = await owner.client.from("adoption_listings").update({ review_note: "Aprovado pela MEL" } as never).eq("short_code", code);
    expect(error).not.toBeNull();
    expect((await statusOf("adoption_listings", code)).review_note).toBe("Fotos de outro animal");
  });
});

describe("partners: any public field of an approved business goes back to review", () => {
  it.each([
    ["site", { website: "https://exemplo.com/promo-pix" }],
    ["WhatsApp", { whatsapp: "51999990000" }],
    ["descrição", { description: "Agora só atendemos pelo link." }],
    ["horário", { hours: "24h" }],
  ])("changing %s", async (_label, patch) => {
    const code = await createBusiness(owner.client, owner.id, business());
    await reviewBusiness(moderator.client, code, true);
    const { error } = await owner.client.from("businesses").update(patch as never).eq("short_code", code);
    expect(error).toBeNull();
    expect((await statusOf("businesses", code)).status).toBe("PENDING_REVIEW");
    expect((await listBusinesses(anonClient(), POA, { radiusM: 2000 })).map((b) => b.code)).not.toContain(code);
  });

  it("the owner cannot write the note, the status or the plan", async () => {
    const code = await createBusiness(owner.client, owner.id, business());
    for (const patch of [{ review_note: "ok" }, { status: "APPROVED" }, { plan_code: "PRO" }]) {
      const { error } = await owner.client.from("businesses").update(patch as never).eq("short_code", code);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
    expect(await statusOf("businesses", code)).toMatchObject({ status: "PENDING_REVIEW", review_note: null });
  });
});

describe("reporting and taking down approved listings", () => {
  it("a visitor reports an approved adoption; the moderator takes it down (REMOVED) and the action is audited", async () => {
    const code = await createAdoption(owner.client, owner.id, listing({ name: "Golpe" }));
    await reviewAdoption(moderator.client, code, true);
    await reportContent(visitor.client, { type: "adoption", key: code }, { reason: "scam", details: "Pediu taxa para entregar." });

    const report = (await listAdminReports(moderator.client)).find((r) => r.targetType === "adoption" && r.target?.href === `/adocao/${code}`);
    expect(report?.target?.title).toBe("Adoção: Golpe");
    await moderate(moderator.client, report!.id, "hide", "Cobrança para adoção");

    expect(await statusOf("adoption_listings", code)).toMatchObject({ status: "REMOVED", review_note: "Cobrança para adoção" });
    expect((await getAdoption(anonClient(), code)) ?? { status: "invisível" }).not.toMatchObject({ status: "AVAILABLE" });
    const { data: audit } = await serviceClient().from("moderation_actions").select("action, target_type").eq("report_id", report!.id);
    expect(audit).toEqual([{ action: "hide", target_type: "adoption" }]);
  });

  it("a visitor reports an approved business; the moderator suspends it and it leaves the directory", async () => {
    const code = await createBusiness(owner.client, owner.id, business());
    await reviewBusiness(moderator.client, code, true);
    expect((await listBusinesses(anonClient(), POA, { radiusM: 2000 })).map((b) => b.code)).toContain(code);
    await reportContent(visitor.client, { type: "business", key: code }, { reason: "fake", details: null });

    const report = (await listAdminReports(moderator.client)).find((r) => r.targetType === "business" && r.target?.href === `/parceiros/${code}`);
    expect(report?.target?.title).toBe("Parceiro: Pet Shop Ponto Azul");
    await moderate(moderator.client, report!.id, "hide");

    expect((await statusOf("businesses", code)).status).toBe("SUSPENDED");
    expect((await listBusinesses(anonClient(), POA, { radiusM: 2000 })).map((b) => b.code)).not.toContain(code);
    expect((await getBusiness(owner.client, code))?.status).toBe("SUSPENDED");
  });

  it("only approved/public listings can be reported, and only moderators act", async () => {
    const pending = await createAdoption(owner.client, owner.id, listing({ name: "Pendente" }));
    await expect(reportContent(visitor.client, { type: "adoption", key: pending }, { reason: "spam", details: null })).rejects.toThrow("Não encontramos esse conteúdo.");
    const code = await createAdoption(owner.client, owner.id, listing({ name: "Aprovada" }));
    await reviewAdoption(moderator.client, code, true);
    await reportContent(visitor.client, { type: "adoption", key: code }, { reason: "spam", details: null });
    const report = (await listAdminReports(moderator.client)).find((r) => r.target?.href === `/adocao/${code}`)!;
    await expect(moderate(visitor.client, report.id, "hide")).rejects.toThrow();
    await expect(moderate(owner.client, report.id, "hide")).rejects.toThrow();
    expect((await statusOf("adoption_listings", code)).status).toBe("AVAILABLE");
  });
});
