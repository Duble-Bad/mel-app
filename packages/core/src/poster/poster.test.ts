import { describe, expect, it } from "vitest";
import { isPosterFormat, posterContent } from "./poster";

const base = {
  code: "abc234",
  status: "ACTIVE" as const,
  areaLabel: "Sé, São Paulo – SP",
  lostAt: "2026-10-28T22:04:00-03:00",
  contactWhatsapp: null,
  contactPhone: null,
  notes: null,
  pet: {
    name: "Mel",
    species: "dog" as const,
    breed: "Yorkshire Terrier",
    sex: "female" as const,
    size: "mini" as const,
    uniqueMarks: "Lacinho rosa na cabeça.",
  } as never,
};

describe("posterContent", () => {
  it("builds the PROCURA-SE poster text", () => {
    const p = posterContent(base);
    expect(p).toMatchObject({
      headline: "PROCURA-SE",
      name: "Mel",
      details: "Yorkshire Terrier · Fêmea · Porte mini",
      lastSeen: "Visto por último: Sé, São Paulo – SP",
      when: "Desde 28/10 às 22:04",
      marks: "Lacinho rosa na cabeça.",
      cta: "VIU ESTE PET? ESCANEIE",
    });
  });

  it("never prints a phone unless the tutor authorized it", () => {
    expect(posterContent(base).contact).toBeNull();
    expect(posterContent({ ...base, contactWhatsapp: "11900000001" }).contact).toBe("WhatsApp: (11) 90000-0001");
  });

  it("truncates long descriptions and switches to ENCONTRADO", () => {
    const long = posterContent({ ...base, notes: "x".repeat(400) });
    expect(long.marks!.length).toBeLessThanOrEqual(140);
    expect(posterContent({ ...base, status: "FOUND" }).headline).toBe("ENCONTRADO!");
  });

  it("validates formats", () => {
    expect(isPosterFormat("story")).toBe(true);
    expect(isPosterFormat("a3")).toBe(false);
  });
});
