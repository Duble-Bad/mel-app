import { describe, expect, it } from "vitest";
import { isDeleteConfirmed, needsTermsAcceptance, TERMS_VERSION } from "./privacy";

const c = (version: string, createdAt: string, granted = true) => ({ kind: "terms_privacy" as const, version, granted, createdAt });

describe("needsTermsAcceptance", () => {
  it("asks when never accepted or when the version changed", () => {
    expect(needsTermsAcceptance([])).toBe(true);
    expect(needsTermsAcceptance([c("2020-01-01", "2020-01-01T00:00:00Z")])).toBe(true);
    expect(needsTermsAcceptance([c("2020-01-01", "2020-01-01T00:00:00Z"), c(TERMS_VERSION, "2026-10-29T10:00:00Z")])).toBe(false);
  });
  it("uses the latest record", () => {
    expect(needsTermsAcceptance([c(TERMS_VERSION, "2026-10-29T10:00:00Z"), c(TERMS_VERSION, "2026-10-29T11:00:00Z", false)])).toBe(true);
  });
});

describe("isDeleteConfirmed", () => {
  it("accepts the word regardless of case and spaces", () => {
    expect(isDeleteConfirmed(" excluir ")).toBe(true);
    expect(isDeleteConfirmed("excluí")).toBe(false);
  });
});
