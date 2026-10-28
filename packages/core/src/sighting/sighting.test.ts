import { describe, expect, it } from "vitest";
import { fieldErrors } from "../profile/profile";
import { describeSighting, seenAtFrom, sightingInputSchema } from "./sighting";

describe("sightingInputSchema", () => {
  const base = { code: "abc234", position: { lat: -23.55, lng: -46.63 }, seenAt: new Date().toISOString() };

  it("accepts a minimal sighting (where + when)", () => {
    const s = sightingInputSchema.parse(base);
    expect(s).toMatchObject({ direction: "unknown", states: [], notes: null, photoPath: null });
  });

  it("explains what is missing", () => {
    const errors = fieldErrors(sightingInputSchema.safeParse({ code: "abc234" }).error!);
    expect(errors.position).toMatch(/Marque onde você viu/);
    expect(errors.seenAt).toMatch(/quando você viu/);
  });

  it("rejects malformed alert codes", () => {
    expect(sightingInputSchema.safeParse({ ...base, code: "../../x" }).success).toBe(false);
  });
});

describe("seenAtFrom", () => {
  const now = new Date("2026-10-28T22:00:00Z");
  it("turns quick choices into timestamps", () => {
    expect(seenAtFrom("now", undefined, now)).toBe("2026-10-28T22:00:00.000Z");
    expect(seenAtFrom("15min", undefined, now)).toBe("2026-10-28T21:45:00.000Z");
    expect(seenAtFrom("1h", undefined, now)).toBe("2026-10-28T21:00:00.000Z");
    expect(seenAtFrom("other", undefined, now)).toBeNull();
  });
});

describe("describeSighting", () => {
  it("summarizes state and direction", () => {
    expect(describeSighting({ states: ["running", "scared"], direction: "N" })).toBe(
      "Correndo, assustado · seguia para o Norte",
    );
    expect(describeSighting({ states: [], direction: "unknown" })).toBe("Avistamento");
  });
});
