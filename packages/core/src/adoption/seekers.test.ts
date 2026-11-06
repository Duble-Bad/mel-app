import { describe, expect, it } from "vitest";
import { interestSchema } from "./adoption";
import { ageBand, hasContactInfo, normalizeWhatsapp, seekerInputSchema, seekerMatchesListing, seekerPreferenceLabel, sizeGroupsOf } from "./seekers";

const base = {
  species: "dog",
  area: { lat: -25.43, lng: -49.27 },
  areaLabel: "Centro, Curitiba – PR",
  housing: "apartment",
  otherPets: "none",
  routine: "Trabalho em home office e passeio duas vezes por dia.",
  consent: true,
};

describe("interesse num anúncio", () => {
  it("crianças em casa é opcional", () => {
    const parsed = interestSchema.parse({ housing: "house", otherPets: false, message: "Moro sozinha e trabalho em casa." });
    expect(parsed.children).toBeNull();
    expect(interestSchema.parse({ housing: "house", otherPets: false, children: true, message: "Moro sozinha e trabalho em casa." }).children).toBe(true);
  });
});

describe("perfil da fila de interessados", () => {
  it("aceita o mínimo e aplica os padrões (avisos ligados, fora da lista pública)", () => {
    const s = seekerInputSchema.parse(base);
    expect(s).toMatchObject({ sizes: [], ages: [], children: null, whatsapp: null, notify: true, showPublic: false, radiusM: 10000 });
  });

  it("exige consentimento, espécie, bairro e rotina de 20 a 600 caracteres", () => {
    expect(seekerInputSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(seekerInputSchema.safeParse({ ...base, species: undefined }).success).toBe(false);
    expect(seekerInputSchema.safeParse({ ...base, areaLabel: " " }).success).toBe(false);
    expect(seekerInputSchema.safeParse({ ...base, routine: "curta" }).success).toBe(false);
    expect(seekerInputSchema.safeParse({ ...base, routine: "x".repeat(601) }).success).toBe(false);
  });

  it("recusa contato na rotina (o contato é pelo chat)", () => {
    expect(hasContactInfo("me liga no (11) 98888-7777")).toBe(true);
    expect(hasContactInfo("ana@exemplo.com")).toBe(true);
    expect(hasContactInfo("veja www.exemplo.com")).toBe(true);
    expect(hasContactInfo("Tenho 2 gatos e 1 cão, moro no 3º andar.")).toBe(false);
    expect(seekerInputSchema.safeParse({ ...base, routine: "Pode me chamar no 41 99999-0000 a qualquer hora" }).success).toBe(false);
  });

  it("WhatsApp é opcional, só dígitos e com DDD", () => {
    expect(normalizeWhatsapp(" (41) 99999-0000 ")).toBe("41999990000");
    expect(normalizeWhatsapp("")).toBeNull();
    expect(seekerInputSchema.parse({ ...base, whatsapp: "(41) 99999-0000" }).whatsapp).toBe("41999990000");
    expect(seekerInputSchema.parse({ ...base, whatsapp: "" }).whatsapp).toBeNull();
    expect(seekerInputSchema.safeParse({ ...base, whatsapp: "9999" }).success).toBe(false);
  });

  it("só aceita os raios do Guardião", () => {
    expect(seekerInputSchema.safeParse({ ...base, radiusM: 3000 }).success).toBe(true);
    expect(seekerInputSchema.safeParse({ ...base, radiusM: 2000 }).success).toBe(false);
  });
});

describe("compatibilidade", () => {
  it("faixas de idade iguais às do banco", () => {
    expect([ageBand(null), ageBand(3), ageBand(12), ageBand(95), ageBand(96)]).toEqual([null, "puppy", "adult", "adult", "senior"]);
  });

  it("lista vazia é tanto faz; dado ausente no anúncio não exclui", () => {
    const any = { species: "any" as const, sizes: [], ages: [] };
    expect(seekerMatchesListing(any, { species: "cat", size: "giant", ageMonths: 200 })).toBe(true);
    const picky = { species: "dog" as const, sizes: ["mini" as const, "small" as const], ages: ["puppy" as const] };
    expect(seekerMatchesListing(picky, { species: "dog", size: "small", ageMonths: 4 })).toBe(true);
    expect(seekerMatchesListing(picky, { species: "cat", size: "small", ageMonths: 4 })).toBe(false);
    expect(seekerMatchesListing(picky, { species: "dog", size: "large", ageMonths: 4 })).toBe(false);
    expect(seekerMatchesListing(picky, { species: "dog", size: "small", ageMonths: 40 })).toBe(false);
    expect(seekerMatchesListing(picky, { species: "dog", size: null, ageMonths: null })).toBe(true);
  });

  it("rótulo das preferências", () => {
    expect(sizeGroupsOf(["giant"])).toEqual(["large"]);
    expect(seekerPreferenceLabel({ species: "dog", sizes: ["mini", "small"], ages: ["puppy"] })).toBe("Cão · porte pequeno · filhote");
    expect(seekerPreferenceLabel({ species: "any", sizes: [], ages: [] })).toBe("Cão ou gato · qualquer porte · qualquer idade");
  });
});
