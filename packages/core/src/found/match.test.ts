import { describe, expect, it } from "vitest";
import { computeMatchScore, describeMatchReasons, matchLabel, MATCH_THRESHOLD, type MatchSide } from "./match";

const SE = { lat: -23.55052, lng: -46.633308 };
const lost: MatchSide = {
  species: "dog",
  size: "mini",
  sex: "female",
  colorPrimary: "caramelo",
  colorsSecondary: ["preto"],
  breed: "Yorkshire Terrier",
  position: SE,
  at: "2026-10-28T12:00:00-03:00",
};
const found = (o: Partial<MatchSide> = {}): MatchSide => ({
  ...lost,
  colorsSecondary: [],
  position: { lat: -23.5489, lng: -46.6388 }, // ~600 m
  at: "2026-10-28T14:00:00-03:00",
  ...o,
});

describe("computeMatchScore (Radar MEL v1)", () => {
  it("a near-identical dog found nearby the same day scores high", () => {
    const r = computeMatchScore(lost, found())!;
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.reasons).toMatchObject({ size: "same", sex: "same", color: "same", breed: "same" });
    expect(r.reasons.distance_m).toBeGreaterThan(500);
    expect(r.reasons.distance_m).toBeLessThan(700);
  });

  it("is not a candidate when species differ, too far, or found long before/after", () => {
    expect(computeMatchScore(lost, found({ species: "cat" }))).toBeNull();
    expect(computeMatchScore(lost, found({ position: { lat: -23.7, lng: -46.633308 } }))).toBeNull(); // ~16 km
    expect(computeMatchScore(lost, found({ at: "2026-10-25T12:00:00-03:00" }))).toBeNull(); // 3 dias antes
    expect(computeMatchScore(lost, found({ at: "2027-01-10T12:00:00-03:00" }))).toBeNull(); // > 60 dias
  });

  it("opposite sex is a strong contradiction; unknowns stay neutral", () => {
    const opposite = computeMatchScore(lost, found({ sex: "male" }))!;
    const unknown = computeMatchScore(lost, found({ sex: "unknown" }))!;
    const same = computeMatchScore(lost, found())!;
    expect(same.score - unknown.score).toBe(8);
    expect(unknown.score - opposite.score).toBe(17);
  });

  it("partial color and close size give partial credit", () => {
    const r = computeMatchScore(lost, found({ colorPrimary: "preto", colorsSecondary: [], size: "small" }))!;
    expect(r.reasons).toMatchObject({ color: "partial", size: "close" });
  });

  it("distance and time decay lower the score", () => {
    const near = computeMatchScore(lost, found())!.score;
    const far = computeMatchScore(lost, found({ position: { lat: -23.6, lng: -46.633308 } }))!.score; // ~5,5 km
    const later = computeMatchScore(lost, found({ at: "2026-11-15T12:00:00-03:00" }))!.score;
    expect(far).toBeLessThan(near);
    expect(later).toBeLessThan(near);
  });

  it("a vague report (only species, nearby) stays below the threshold", () => {
    const vague = computeMatchScore(lost, found({ size: null, sex: "unknown", colorPrimary: null, breed: null, position: { lat: -23.58, lng: -46.633308 } }))!;
    expect(vague.score).toBeLessThan(MATCH_THRESHOLD);
    // …mas um animal solto a ~600 m no mesmo dia ainda vale como pista.
    const nearby = computeMatchScore(lost, found({ size: null, sex: "unknown", colorPrimary: null, breed: null }))!;
    expect(nearby.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });
});

describe("describeMatchReasons / matchLabel", () => {
  it("speaks human and never claims certainty", () => {
    const r = computeMatchScore(lost, found())!;
    const lines = describeMatchReasons(r.reasons);
    expect(lines[0]).toMatch(/^a \d+ m do último local$/);
    expect(lines.slice(1)).toEqual(["menos de 1 dia depois", "mesmo porte", "mesmo sexo", "mesma cor", "mesma raça"]);
    expect(matchLabel(82)).toBe("Possível correspondência · 82%");
  });
});
