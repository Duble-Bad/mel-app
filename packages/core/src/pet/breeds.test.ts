import { describe, expect, it } from "vitest";
import { breedLabel, breedsFor, isValidBreed, normalizeBreed, searchBreeds, SRD } from "./breeds";
import { petInputSchema } from "./pet";

describe("breed lists", () => {
  it("have dog and cat breeds, sorted and without duplicates", () => {
    for (const species of ["dog", "cat"] as const) {
      const list = breedsFor(species)!;
      expect(list.length).toBeGreaterThan(species === "dog" ? 200 : 50);
      expect(new Set(list).size).toBe(list.length);
      expect([...list].sort(new Intl.Collator("pt-BR", { sensitivity: "base" }).compare)).toEqual(list);
    }
  });

  it("include Brazilian breeds", () => {
    const dogs = breedsFor("dog")!;
    for (const b of ["Fila Brasileiro", "Terrier Brasileiro (Fox Paulistinha)", "Dogue Brasileiro", "Ovelheiro Gaúcho"]) {
      expect(dogs).toContain(b);
    }
    expect(breedsFor("cat")).toContain("Brasileiro de Pelo Curto");
  });

  it("use free text for other species", () => {
    expect(breedsFor("other")).toBeNull();
    expect(isValidBreed("other", "Calopsita")).toBe(true);
  });
});

describe("normalizeBreed / breedLabel", () => {
  it("maps common spellings of 'no breed' to SRD", () => {
    for (const v of ["srd", "SRD", "Sem raça definida", "sem raca", "vira-lata", "Viralata", "Mestiço"]) {
      expect(normalizeBreed(v)).toBe(SRD);
    }
    expect(normalizeBreed("  ")).toBeNull();
    expect(breedLabel(SRD)).toBe("Sem raça definida (SRD)");
  });
});

describe("searchBreeds", () => {
  const dogs = breedsFor("dog")!;
  it("ignores accents and case, prefix matches first", () => {
    expect(searchBreeds(dogs, "sao bern")).toEqual(["São Bernardo"]);
    expect(searchBreeds(dogs, "york")[0]).toBe("Yorkshire Terrier");
    expect(searchBreeds(dogs, "pastor").every((b) => b.toLowerCase().includes("pastor"))).toBe(true);
    expect(searchBreeds(dogs, "salsicha")).toEqual(["Dachshund (Teckel/Salsicha)"]);
  });
});

describe("petInputSchema breed rules", () => {
  it("accepts list breeds and SRD, rejects unknown text for dogs/cats", () => {
    expect(petInputSchema.parse({ name: "Mel", species: "dog", breed: "Yorkshire Terrier" }).breed).toBe(
      "Yorkshire Terrier",
    );
    expect(petInputSchema.parse({ name: "Nina", species: "cat", breed: "vira-lata" }).breed).toBe(SRD);
    const bad = petInputSchema.safeParse({ name: "Mel", species: "dog", breed: "Persa" });
    expect(bad.success).toBe(false);
  });
});
