import { describe, expect, it } from "vitest";
import { adoptionInputSchema, ageLabel, interestSchema } from "./adoption";

const valid = {
  name: "Biscoito",
  species: "dog",
  description: "Muito carinhoso, adora passear e se dá bem com todo mundo.",
  position: { lat: -23.55, lng: -46.63 },
  photoPaths: ["u/adocao/1.webp"],
};

describe("adoptionInputSchema", () => {
  it("accepts a complete listing with defaults", () => {
    expect(adoptionInputSchema.parse(valid)).toMatchObject({ sex: "unknown", temperament: [], requirements: null });
  });
  it("explains what is missing", () => {
    const r = adoptionInputSchema.safeParse({ ...valid, description: "curto", photoPaths: [] });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => i.message);
    expect(messages).toContain("Conte um pouco mais sobre ele (pelo menos 20 caracteres).");
    expect(messages).toContain("Adicione pelo menos uma foto.");
  });
});

describe("interestSchema", () => {
  it("requires the basic answers and a short presentation", () => {
    expect(interestSchema.safeParse({ housing: "apartment", otherPets: false, children: true, message: "oi" }).success).toBe(false);
    expect(interestSchema.parse({ housing: "apartment", otherPets: false, children: true, message: "Moro sozinha e trabalho em casa." }).housing).toBe("apartment");
  });
});

describe("ageLabel", () => {
  it.each([
    [null, "Idade não informada"],
    [1, "Filhote (1 mês)"],
    [5, "Filhote (5 meses)"],
    [12, "1 ano"],
    [40, "3 anos"],
  ])("%s → %s", (m, label) => expect(ageLabel(m)).toBe(label));
});
