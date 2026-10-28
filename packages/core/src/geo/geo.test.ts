import { describe, expect, it } from "vitest";
import { distanceMeters, formatDistance, fuzzPoint, isValidLatLng } from "./geo";

// Praça da Sé e Pátio do Colégio, São Paulo (locais públicos).
const se = { lat: -23.55052, lng: -46.633308 };
const patio = { lat: -23.547947, lng: -46.632488 };

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(se, se)).toBe(0);
  });

  it("matches a known short distance within 2%", () => {
    const d = distanceMeters(se, patio);
    expect(d).toBeGreaterThan(290);
    expect(d).toBeLessThan(310);
  });
});

describe("fuzzPoint", () => {
  it("moves the point by at most half a cell diagonal", () => {
    const fuzzed = fuzzPoint(se, 250);
    expect(distanceMeters(se, fuzzed)).toBeLessThanOrEqual((250 * Math.SQRT2) / 2 + 1);
  });

  it("is deterministic and groups nearby points into the same cell", () => {
    const a = fuzzPoint(se, 250);
    const b = fuzzPoint({ lat: se.lat + 0.00001, lng: se.lng + 0.00001 }, 250);
    expect(fuzzPoint(se, 250)).toEqual(a);
    expect(b).toEqual(a);
  });
});

describe("isValidLatLng", () => {
  it("rejects out-of-range and non-finite values", () => {
    expect(isValidLatLng(se)).toBe(true);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: Number.NaN })).toBe(false);
  });
});

describe("formatDistance", () => {
  it("formats in pt-BR", () => {
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(1234)).toBe("1,2 km");
    expect(formatDistance(12_600)).toBe("13 km");
  });
});
