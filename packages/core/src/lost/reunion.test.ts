import { describe, expect, it } from "vitest";
import { helpersLine, reunionSchema } from "./reunion";

describe("reunionSchema", () => {
  it("requires how; optional fields become null when blank", () => {
    expect(reunionSchema.safeParse({}).success).toBe(false);
    expect(reunionSchema.parse({ how: "came_back", foundAreaLabel: "  ", story: "" })).toEqual({
      how: "came_back",
      helpfulSightingId: null,
      foundAreaLabel: null,
      story: null,
    });
  });
  it("rejects unknown ways and invalid sighting ids", () => {
    expect(reunionSchema.safeParse({ how: "teleporte" }).success).toBe(false);
    expect(reunionSchema.safeParse({ how: "other", helpfulSightingId: "abc" }).success).toBe(false);
  });
});

describe("helpersLine", () => {
  it("is human and hides zero", () => {
    expect(helpersLine(0)).toBeNull();
    expect(helpersLine(null)).toBeNull();
    expect(helpersLine(1)).toBe("1 pessoa ajudou nesta busca");
    expect(helpersLine(12)).toBe("12 pessoas ajudaram nesta busca");
  });
});
