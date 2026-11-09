import { describe, expect, it } from "vitest";
import { formatRewardBRL, maskRewardInput, parseRewardBRL, rewardLine } from "./reward";

describe("reward (protótipo)", () => {
  it("parses common BRL inputs to cents", () => {
    expect(parseRewardBRL("500")).toEqual({ ok: true, cents: 50000 });
    expect(parseRewardBRL("R$ 500,00")).toEqual({ ok: true, cents: 50000 });
    expect(parseRewardBRL("1.250,5")).toEqual({ ok: true, cents: 125050 });
  });

  it("rejects empty, zero, malformed and absurd values", () => {
    expect(parseRewardBRL("").ok).toBe(false);
    expect(parseRewardBRL("0,00").ok).toBe(false);
    expect(parseRewardBRL("12a").ok).toBe(false);
    expect(parseRewardBRL("500.5").ok).toBe(false);
    expect(parseRewardBRL("1.000.000,00").ok).toBe(false);
  });

  it("formats and masks as Brazilian currency", () => {
    expect(formatRewardBRL(50000)).toBe("R$ 500,00");
    expect(formatRewardBRL(125050)).toBe("R$ 1.250,50");
    expect(maskRewardInput("50000")).toBe("500,00");
    expect(maskRewardInput("abc")).toBe("");
  });

  it("only shows an active offer on active alerts with a value", () => {
    expect(rewardLine("ACTIVE", 50000)).toBe("BONIFICAÇÃO OFERECIDA: R$ 500,00");
    expect(rewardLine("ACTIVE", null)).toBeNull();
    expect(rewardLine("CLOSED", 50000)).toBeNull();
    expect(rewardLine("FOUND", 50000)).toBeNull();
  });
});
