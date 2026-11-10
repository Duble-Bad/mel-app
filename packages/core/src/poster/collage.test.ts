import { describe, expect, it } from "vitest";
import { collageExtras } from "./collage";

const base = {
  notes: null,
  wearing: [],
  areaLabel: "Vila Exemplo, Cidade Fictícia – SP",
  city: "Cidade Fictícia",
  state: "SP",
  contactWhatsapp: null,
  contactPhone: null,
  pet: {
    name: "Mel",
    species: "dog" as const,
    breed: "Yorkshire Terrier",
    sex: "female" as const,
    size: "mini" as const,
    birthDate: "2016-05-10",
    ageEstimateMonths: null,
    uniqueMarks: "Orelha em pé. Pelo branco no peito; está sem coleira.\nMuito medrosa!",
  } as never,
};
const now = new Date("2026-11-10T12:00:00");

describe("collageExtras (modelo 4)", () => {
  it("shows the phone only when the public alert carries it (the tutor authorized it)", () => {
    expect(collageExtras(base, now).phone).toBeNull();
    expect(collageExtras({ ...base, contactWhatsapp: "11999990000" }, now).phone).toEqual({ number: "(11) 99999-0000", whatsapp: true });
    expect(collageExtras({ ...base, contactPhone: "1133330000" }, now).phone).toEqual({ number: "(11) 3333-0000", whatsapp: false });
  });

  it("builds the strip only from registered data (never infers 'sem coleira')", () => {
    expect(collageExtras(base, now).strip).toEqual(["Yorkshire Terrier", "Fêmea", "10 anos", "Porte mini"]);
    expect(collageExtras({ ...base, wearing: ["collar"] }, now).strip).toContain("Com coleira");
    const noAge = collageExtras({ ...base, pet: { ...(base.pet as object), birthDate: null } as never }, now);
    expect(noAge.strip).toEqual(["Yorkshire Terrier", "Fêmea", "Porte mini"]);
  });

  it("keeps the tutor's words, only split into sentences", () => {
    expect(collageExtras(base, now).features).toEqual(["Orelha em pé.", "Pelo branco no peito;", "está sem coleira.", "Muito medrosa!"]);
  });

  it("uses the name's article and the public place", () => {
    const e = collageExtras(base, now);
    expect(e.article).toBe("a");
    expect(e.placeTitle).toBe("DESAPARECEU EM CIDADE FICTÍCIA/SP");
    expect(e.placeLine).toBe(base.areaLabel);
    expect(collageExtras({ ...base, city: null }, now).placeTitle).toBe("VISTO POR ÚLTIMO");
  });
});
