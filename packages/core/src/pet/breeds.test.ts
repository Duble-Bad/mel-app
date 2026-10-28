import { describe, expect, it } from "vitest";
import {
  breedAliases,
  breedLabel,
  breedsFor,
  isValidBreed,
  normalizeBreed,
  resolveBreed,
  searchBreeds,
  SRD,
  SRD_LABEL,
} from "./breeds";
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

describe("aliases (one breed, one stored value)", () => {
  const dogs = breedsFor("dog")!;
  const cats = breedsFor("cat")!;

  it("every alias points to a breed that exists in a list", () => {
    for (const breed of [...dogs, ...cats]) {
      for (const alias of breedAliases(breed)) expect(normalizeBreed(alias)).toBe(breed);
    }
    // nenhuma raça da lista tem apelido apontando para outra
    const allAliases = [...dogs, ...cats].flatMap((b) => breedAliases(b).map((a) => a.toLowerCase()));
    expect(new Set(allAliases).size).toBe(allAliases.length);
  });

  it("Yorkshire Terrier covers every Yorkshire name and size", () => {
    for (const typed of ["Yorkshire", "yorkshire", "Yorkie", "Yorkshire micro", "Yorkshire mini", "Yorkshire toy", "yorkshire terrier"]) {
      expect(resolveBreed("dog", typed)).toBe("Yorkshire Terrier");
      expect(searchBreeds(dogs, typed)).toContain("Yorkshire Terrier");
    }
    expect(dogs.filter((b) => /yorkshire/i.test(b))).toEqual(["Yorkshire Terrier"]);
    expect(dogs).toContain("Biewer Terrier"); // raça distinta, não é Yorkshire
  });

  it("resolves popular Brazilian names", () => {
    expect(resolveBreed("dog", "labrador")).toBe("Labrador Retriever");
    expect(resolveBreed("dog", "salsicha")).toBe("Dachshund (Teckel/Salsicha)");
    expect(resolveBreed("dog", "pitbull")).toBe("American Pit Bull Terrier");
    expect(resolveBreed("dog", "lulu")).toBe("Lulu da Pomerânia (Spitz Alemão Anão)");
    expect(resolveBreed("dog", "vira-lata")).toBe(SRD);
  });

  it("does not guess ambiguous or wrong-species names", () => {
    expect(resolveBreed("dog", "Poodle")).toBeNull(); // 4 tamanhos: escolher na lista
    expect(resolveBreed("cat", "Yorkshire")).toBeNull();
    expect(resolveBreed("dog", "Labradoodle")).toBeNull();
  });

  it("search for 'vira' finds the SRD option", () => {
    expect(searchBreeds([SRD_LABEL], "vira")).toEqual([SRD_LABEL]);
  });

  it("the schema stores the canonical name for aliases", () => {
    expect(petInputSchema.parse({ name: "Mel", species: "dog", breed: "Yorkie" }).breed).toBe("Yorkshire Terrier");
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
