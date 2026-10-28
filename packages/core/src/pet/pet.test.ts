import { describe, expect, it } from "vitest";
import { fieldErrors } from "../profile/profile";
import { describeAge, isMelId, parseDecimal, petInputSchema, petSummary } from "./pet";

describe("petInputSchema", () => {
  it("needs only name and species (quick registration)", () => {
    const pet = petInputSchema.parse({ name: " Mel ", species: "dog" });
    expect(pet).toMatchObject({ name: "Mel", species: "dog", sex: "unknown", isPublic: false, breed: null });
  });

  it("explains missing required fields", () => {
    const result = petInputSchema.safeParse({ name: "", species: "lizard" });
    const errors = fieldErrors(result.error!);
    expect(errors.name).toMatch(/nome/);
    expect(errors.species).toMatch(/cachorro, gato ou outro/);
  });

  it("removes the primary color from secondary colors and dedupes", () => {
    const pet = petInputSchema.parse({
      name: "Mel",
      species: "dog",
      colorPrimary: "caramelo",
      colorsSecondary: ["caramelo", "preto", "preto"],
    });
    expect(pet.colorsSecondary).toEqual(["preto"]);
  });

  it("rejects future birth dates and absurd weights", () => {
    expect(petInputSchema.safeParse({ name: "Mel", species: "dog", birthDate: "2999-01-01" }).success).toBe(false);
    expect(petInputSchema.safeParse({ name: "Mel", species: "dog", weightKg: 400 }).success).toBe(false);
  });

  it("turns blank optional text into null", () => {
    expect(petInputSchema.parse({ name: "Mel", species: "dog", breed: "   " }).breed).toBeNull();
  });
});

describe("describeAge", () => {
  const today = new Date("2026-10-28T12:00:00");
  it("uses the birth date when known", () => {
    expect(describeAge({ birthDate: "2021-05-10", ageEstimateMonths: null }, today)).toBe("5 anos");
    expect(describeAge({ birthDate: "2026-06-01", ageEstimateMonths: null }, today)).toBe("4 meses");
  });
  it("marks estimates as approximate", () => {
    expect(describeAge({ birthDate: null, ageEstimateMonths: 18 }, today)).toBe("cerca de 1 ano");
    expect(describeAge({ birthDate: null, ageEstimateMonths: null }, today)).toBeNull();
  });
});

describe("helpers", () => {
  it("parses Brazilian decimals", () => {
    expect(parseDecimal("3,5")).toBe(3.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNaN();
  });

  it("summarizes a pet", () => {
    expect(petSummary({ species: "dog", breed: "Yorkshire", sex: "female", size: "mini" })).toBe(
      "Cachorro · Yorkshire · Fêmea · Mini",
    );
  });

  it("validates MEL IDs", () => {
    expect(isMelId("MEL-7K3Q9H")).toBe(true);
    expect(isMelId("MEL-0O1IL2")).toBe(false);
    expect(isMelId("mel-7k3q9h")).toBe(false);
  });
});
