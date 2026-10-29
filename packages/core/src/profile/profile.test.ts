import { describe, expect, it } from "vitest";
import { credentialsSchema, fieldErrors, needsOnboarding, profileInputSchema, safeNextPath, signUpSchema } from "./profile";

describe("profileInputSchema", () => {
  it("accepts minimal valid data and trims spaces", () => {
    const parsed = profileInputSchema.parse({ displayName: "  Ana  ", city: " Campinas ", state: "SP" });
    expect(parsed).toEqual({ displayName: "Ana", city: "Campinas", state: "SP" });
  });

  it("returns friendly messages per field", () => {
    const result = profileInputSchema.safeParse({ displayName: "", city: "", state: "XX" });
    expect(result.success).toBe(false);
    const errors = fieldErrors(result.error!);
    expect(errors.displayName).toMatch(/como podemos te chamar/);
    expect(errors.city).toMatch(/cidade/);
    expect(errors.state).toMatch(/estado/);
  });
});

describe("signUpSchema", () => {
  it("asks for the name too", () => {
    const r = signUpSchema.safeParse({ email: "ana@exemplo.com", password: "12345678", displayName: " " });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).displayName).toBe("Conte pra gente como podemos te chamar.");
    expect(signUpSchema.parse({ email: "ana@exemplo.com", password: "12345678", displayName: " Ana " }).displayName).toBe("Ana");
  });
});

describe("credentialsSchema", () => {
  it("normalizes email and requires 8+ char passwords", () => {
    expect(credentialsSchema.parse({ email: " Ana@Exemplo.com ", password: "12345678" }).email).toBe(
      "ana@exemplo.com",
    );
    expect(credentialsSchema.safeParse({ email: "ana@exemplo.com", password: "123" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: "ana", password: "12345678" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows internal paths only", () => {
    expect(safeNextPath("/publicar/perdido")).toBe("/publicar/perdido");
    expect(safeNextPath("https://evil.com")).toBe("/perfil");
    expect(safeNextPath("//evil.com")).toBe("/perfil");
    expect(safeNextPath("/\\evil.com")).toBe("/perfil");
    expect(safeNextPath(null, "/")).toBe("/");
  });

  it("refuses tricks the browser turns into another host", () => {
    for (const evil of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/ /evil.com", "/x\\..\\\\evil.com", "/\u0000//evil.com", "javascript:alert(1)", "evil.com", ""]) {
      expect(safeNextPath(evil), JSON.stringify(evil)).toBe("/perfil");
    }
    // Caminhos internos comuns continuam valendo (query e espaço codificado incluídos).
    expect(safeNextPath("/alerta/abc123?aba=mapa")).toBe("/alerta/abc123?aba=mapa");
    expect(safeNextPath("/busca?q=gato%20preto")).toBe("/busca?q=gato%20preto");
  });
});

describe("needsOnboarding", () => {
  it("is true until onboarding is completed", () => {
    expect(needsOnboarding(null)).toBe(true);
    expect(needsOnboarding({ onboardedAt: null })).toBe(true);
    expect(needsOnboarding({ onboardedAt: "2026-10-28T12:00:00Z" })).toBe(false);
  });
});
