import { describe, expect, it } from "vitest";
import { fieldErrors } from "../profile/profile";
import {
  contactStepSchema,
  firstIncompleteStep,
  formatBrPhone,
  normalizeBrPhone,
  publicAreaFrom,
  shareText,
  timeAgo,
  whenStepSchema,
  whereStepSchema,
  whatsappChatUrl,
} from "./lost";

describe("steps validation", () => {
  it("where: requires a marked point", () => {
    const r = whereStepSchema.safeParse({});
    expect(fieldErrors(r.error!).lastSeen).toMatch(/Marque no mapa/);
    expect(whereStepSchema.parse({ lastSeen: { lat: -23.5, lng: -46.6 } }).publicPointExact).toBe(false);
  });

  it("when: requires a date and rejects the future", () => {
    expect(fieldErrors(whenStepSchema.safeParse({}).error!).lostAt).toMatch(/quando ele sumiu/);
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(whenStepSchema.safeParse({ lostAt: future }).success).toBe(false);
    expect(whenStepSchema.safeParse({ lostAt: new Date().toISOString() }).success).toBe(true);
  });

  it("contact: nothing public by default; phone required only when chosen", () => {
    expect(contactStepSchema.parse({})).toEqual({ contactWhatsappPublic: false, contactPhonePublic: false, contactPhone: null });
    const missing = contactStepSchema.safeParse({ contactWhatsappPublic: true });
    expect(fieldErrors(missing.error!).contactPhone).toMatch(/celular com DDD/);
    expect(contactStepSchema.parse({ contactWhatsappPublic: true, contactPhone: "+55 (11) 98765-4321" }).contactPhone).toBe(
      "11987654321",
    );
    // Número digitado mas não publicado não é guardado.
    expect(contactStepSchema.parse({ contactPhone: "11987654321" }).contactPhone).toBeNull();
  });
});

describe("phones", () => {
  it("normalizes Brazilian numbers", () => {
    expect(normalizeBrPhone("(11) 98765-4321")).toBe("11987654321");
    expect(normalizeBrPhone("011 3333-4444")).toBe("1133334444");
    expect(normalizeBrPhone("123")).toBeNull();
    expect(formatBrPhone("11987654321")).toBe("(11) 98765-4321");
    expect(whatsappChatUrl("11987654321")).toBe("https://wa.me/5511987654321");
  });
});

describe("resume a draft", () => {
  it("goes to the first missing step", () => {
    expect(firstIncompleteStep(null)).toBe("pet");
    expect(firstIncompleteStep({ lastSeen: null, lostAt: null })).toBe("where");
    expect(firstIncompleteStep({ lastSeen: { lat: 0, lng: 0 }, lostAt: null })).toBe("when");
    expect(firstIncompleteStep({ lastSeen: { lat: 0, lng: 0 }, lostAt: "2026-10-28T10:00:00Z" })).toBe("details");
  });
});

describe("human text", () => {
  const now = new Date("2026-10-28T22:40:00-03:00");
  it("timeAgo", () => {
    expect(timeAgo("2026-10-28T22:39:30-03:00", now)).toBe("agora há pouco");
    expect(timeAgo("2026-10-28T22:05:00-03:00", now)).toBe("há 35 minutos");
    expect(timeAgo("2026-10-28T20:40:00-03:00", now)).toBe("há 2 horas");
    expect(timeAgo("2026-10-25T22:40:00-03:00", now)).toBe("há 3 dias");
  });

  it("public area never includes the street", () => {
    expect(publicAreaFrom({ neighborhood: "Sé", city: "São Paulo", state: "SP" })).toBe("Sé, São Paulo – SP");
    expect(publicAreaFrom({})).toBeNull();
  });

  it("share text", () => {
    const text = shareText(
      { pet: { name: "Mel" } as never, areaLabel: "Sé, São Paulo – SP", lostAt: "2026-10-28T22:04:00-03:00" },
      "https://mel.app/alerta/abc123",
    );
    expect(text).toBe(
      "🚨 PROCURA-SE: Mel, desaparecido(a) perto de Sé, São Paulo – SP (28/10 às 22:04). Viu? Veja fotos e ajude: https://mel.app/alerta/abc123",
    );
  });
});
