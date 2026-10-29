import { describe, expect, it } from "vitest";
import { businessInputSchema, offerSchema } from "./partners";

const valid = {
  name: "Clínica Amigo Fiel",
  category: "vet",
  description: "Atendimento 24 horas, leitor de microchip e acolhimento de animais encontrados.",
  addressLabel: "Rua Exemplo, 100 – Sé, São Paulo – SP",
  position: { lat: -23.55, lng: -46.63 },
};

describe("businessInputSchema", () => {
  it("normalizes contacts and accepts optional fields empty", () => {
    const b = businessInputSchema.parse({ ...valid, phone: "(11) 3333-4444", whatsapp: "", website: "", instagram: "@amigofiel" });
    expect(b).toMatchObject({ phone: "1133334444", whatsapp: null, website: null, instagram: "amigofiel", helpsLost: false });
  });
  it("explains invalid contacts", () => {
    const r = businessInputSchema.safeParse({ ...valid, phone: "123", website: "http://inseguro.com", instagram: "nome com espaço" });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message);
    expect(msgs).toContain("Informe um telefone com DDD, ex.: (11) 3333-4444.");
    expect(msgs).toContain("Use um endereço que comece com https://");
    expect(msgs).toContain("Use só o usuário do Instagram (ex.: @meupetshop).");
  });
});

describe("offerSchema", () => {
  it("requires a title; end date optional", () => {
    expect(offerSchema.safeParse({ title: "" }).success).toBe(false);
    expect(offerSchema.parse({ title: "Banho com 10% off", endsAt: "2026-12-31" })).toEqual({ title: "Banho com 10% off", description: null, endsAt: "2026-12-31" });
  });
});
