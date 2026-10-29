import { describe, expect, it } from "vitest";
import { guardianSettingsSchema, isQuietHour, pushPayload } from "./guardian";

describe("isQuietHour (antispam do push)", () => {
  // Horários em São Paulo (UTC−3).
  it.each([
    ["2026-10-29T22:00:00-03:00", true],
    ["2026-10-29T23:59:00-03:00", true],
    ["2026-10-30T03:00:00-03:00", true],
    ["2026-10-30T06:59:00-03:00", true],
    ["2026-10-30T07:00:00-03:00", false],
    ["2026-10-29T14:30:00-03:00", false],
    ["2026-10-29T21:59:00-03:00", false],
  ])("%s → %s", (iso, quiet) => {
    expect(isQuietHour(new Date(iso))).toBe(quiet);
  });

  it("respects the time zone, not the server clock", () => {
    // 02:00 UTC = 23:00 em São Paulo (silêncio) — mas 11:00 em Tóquio.
    const at = new Date("2026-10-30T02:00:00Z");
    expect(isQuietHour(at)).toBe(true);
    expect(isQuietHour(at, "Asia/Tokyo")).toBe(false);
  });
});

describe("guardianSettingsSchema", () => {
  const area = { lat: -23.55, lng: -46.63 };
  it("applies defaults and accepts only the offered radii", () => {
    expect(guardianSettingsSchema.parse({ area })).toMatchObject({ enabled: true, radiusM: 3000, maxPerDay: 5, quietNight: true });
    expect(guardianSettingsSchema.safeParse({ area, radiusM: 2000 }).success).toBe(false);
  });
  it("requires an area and at least one kind of alert", () => {
    expect(guardianSettingsSchema.safeParse({}).success).toBe(false);
    const r = guardianSettingsSchema.safeParse({ area, alertLost: false, alertFound: false });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe("Escolha pelo menos um tipo de aviso.");
    // Desligado: tudo bem não escolher nada.
    expect(guardianSettingsSchema.safeParse({ area, enabled: false, alertLost: false, alertFound: false }).success).toBe(true);
  });
  it("caps the daily limit", () => {
    expect(guardianSettingsSchema.safeParse({ area, maxPerDay: 50 }).success).toBe(false);
  });
});

describe("pushPayload", () => {
  it("is short, links inside the app and dedupes by notification id", () => {
    const p = pushPayload({ id: "n1", title: "Pet perdido perto de você: Mel", body: "x".repeat(300), href: "/alerta/abc234" });
    expect(p).toMatchObject({ title: "Pet perdido perto de você: Mel", url: "/alerta/abc234", tag: "n1" });
    expect(p.body).toHaveLength(140);
    expect(pushPayload({ id: "n2", title: "t", body: "b", href: "https://evil.example" }).url).toBe("/");
  });
});
