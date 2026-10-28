import { describe, expect, it } from "vitest";
import { formatChatTime, mentionsPayment, messageBodySchema, peerLabel, reportSchema } from "./chat";

describe("messageBodySchema", () => {
  it("trims and rejects empty or too long messages", () => {
    expect(messageBodySchema.parse("  oi  ")).toBe("oi");
    expect(messageBodySchema.safeParse("   ").success).toBe(false);
    expect(messageBodySchema.safeParse("a".repeat(2001)).success).toBe(false);
  });
});

describe("mentionsPayment", () => {
  it.each([
    "Achei seu cachorro, manda um PIX de 200 que eu levo",
    "Preciso da sua chave para enviar",
    "faz uma transferência pra cobrir o frete",
    "R$ 150 e devolvo",
    "quero a recompensa antes",
    "tem uma taxa de transporte",
  ])("flags %s", (text) => expect(mentionsPayment(text)).toBe(true));

  it.each(["Vi ela perto da padaria às 14h", "Ela está bem, tomou água", "Pode passar aqui amanhã?"])(
    "does not flag %s",
    (text) => expect(mentionsPayment(text)).toBe(false),
  );
});

describe("peerLabel", () => {
  const base = { petName: "Mel", peerName: null, peerIsAnonymous: true, fromSighting: false };
  it("never shows the tutor's name to the helper", () => {
    expect(peerLabel({ ...base, myRole: "helper", peerName: "Ana" })).toBe("Tutor(a) de Mel");
  });
  it("shows the helper's first name or a neutral label to the tutor", () => {
    expect(peerLabel({ ...base, myRole: "owner", peerName: "Carlos", peerIsAnonymous: false })).toBe("Carlos");
    expect(peerLabel({ ...base, myRole: "owner" })).toBe("Visitante sem cadastro");
    expect(peerLabel({ ...base, myRole: "owner", fromSighting: true })).toBe("Quem enviou o avistamento");
  });
});

describe("reportSchema", () => {
  it("requires a reason and blocks by default", () => {
    expect(reportSchema.safeParse({}).success).toBe(false);
    expect(reportSchema.parse({ reason: "scam", details: "  " })).toEqual({ reason: "scam", details: null, block: true });
  });
});

describe("formatChatTime", () => {
  const now = new Date("2026-10-28T15:00:00-03:00");
  it("uses today/yesterday/date", () => {
    expect(formatChatTime("2026-10-28T14:05:00-03:00", now)).toBe("Hoje 14:05");
    expect(formatChatTime("2026-10-27T09:12:00-03:00", now)).toBe("Ontem 09:12");
    expect(formatChatTime("2026-10-12T18:30:00-03:00", now)).toBe("12/10 18:30");
  });
});
