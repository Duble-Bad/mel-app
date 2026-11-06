import { describe, expect, it } from "vitest";
import { isRecentAuth, lastStrongAuthAt, REAUTH_MAX_AGE_S } from "./reauth";

describe("recent re-authentication (JWT amr)", () => {
  const now = 1_800_000_000;

  it("accepts a password or Google login within 10 minutes", () => {
    expect(isRecentAuth([{ method: "password", timestamp: now - 60 }], now)).toBe(true);
    expect(isRecentAuth([{ method: "oauth", timestamp: now - REAUTH_MAX_AGE_S }], now)).toBe(true);
  });

  it("rejects old logins, token refreshes, anonymous sessions and malformed claims", () => {
    expect(isRecentAuth([{ method: "password", timestamp: now - REAUTH_MAX_AGE_S - 1 }], now)).toBe(false);
    expect(isRecentAuth([{ method: "token_refresh", timestamp: now }, { method: "password", timestamp: now - 3600 }], now)).toBe(false);
    expect(isRecentAuth([{ method: "anonymous", timestamp: now }], now)).toBe(false);
    expect(isRecentAuth(undefined, now)).toBe(false);
    expect(isRecentAuth("password", now)).toBe(false);
    expect(isRecentAuth([{ method: "password", timestamp: "now" }], now)).toBe(false);
    // Relógio adiantado demais não vale.
    expect(isRecentAuth([{ method: "password", timestamp: now + 3600 }], now)).toBe(false);
  });

  it("uses the most recent strong method", () => {
    expect(lastStrongAuthAt([{ method: "password", timestamp: 10 }, { method: "oauth", timestamp: 20 }, { method: "token_refresh", timestamp: 30 }])).toBe(20);
  });
});
