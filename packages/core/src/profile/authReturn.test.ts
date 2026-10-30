import { describe, expect, it } from "vitest";
import { authCallbackAction, authReturnMessage, emailLinkAction, emailLinkCopy, safeErrorCode } from "./authReturn";

const params = (q: string) => new URLSearchParams(q);

describe("authCallbackAction", () => {
  it("exchanges the code and keeps only internal destinations", () => {
    expect(authCallbackAction(params("code=abc&next=%2Falerta%2Fx1y2z3"))).toEqual({ kind: "exchange", code: "abc", next: "/alerta/x1y2z3" });
    expect(authCallbackAction(params("code=abc"))).toEqual({ kind: "exchange", code: "abc", next: "/perfil" });
  });

  it("blocks open redirects in next", () => {
    for (const next of ["https://evil.com", "//evil.com", "/\\evil.com", "/%09/evil.com", "javascript:alert(1)"]) {
      const action = authCallbackAction(params(`code=abc&next=${encodeURIComponent(decodeURIComponent(next))}`));
      expect(action, next).toEqual({ kind: "exchange", code: "abc", next: "/perfil" });
    }
  });

  it("provider errors win over the code (cancelled, already linked, generic)", () => {
    expect(authCallbackAction(params("error=access_denied&error_description=x"))).toEqual({ kind: "error", code: "access_denied" });
    expect(authCallbackAction(params("error=server_error&error_code=identity_already_exists&code=abc"))).toEqual({
      kind: "error",
      code: "identity_already_exists",
    });
  });

  it("no code is an invalid link; arbitrary error text never travels on", () => {
    expect(authCallbackAction(params(""))).toEqual({ kind: "error", code: "link" });
    expect(authCallbackAction(params("error_code=%3Cscript%3E"))).toEqual({ kind: "error", code: "unknown" });
    expect(safeErrorCode("Identity is already linked")).toBe("unknown");
    expect(safeErrorCode("email_exists")).toBe("email_exists");
  });
});

describe("authReturnMessage", () => {
  it("explains a Google account that already belongs to another MEL account, without transfer", () => {
    for (const code of ["identity_already_exists", "email_exists"]) {
      const r = authReturnMessage(code)!;
      expect(r.offerGoogleSignIn).toBe(true);
      expect(r.message).toContain("não passa para essa conta");
    }
  });

  it("has a clear message for each failure and nothing for no error", () => {
    expect(authReturnMessage(null)).toBeNull();
    expect(authReturnMessage("access_denied")!.message).toContain("cancelado");
    expect(authReturnMessage("flow_state_expired")!.message).toContain("expirou");
    expect(authReturnMessage("link")!.message).toContain("link expirou");
    expect(authReturnMessage("manual_linking_disabled")!.message).toContain("e-mail e senha");
    expect(authReturnMessage("session_not_found")!.message).toContain("sessão expirou");
    expect(authReturnMessage("over_request_rate_limit")!.message).toContain("Muitas tentativas");
    expect(authReturnMessage("unknown")!.message).toContain("Não conseguimos concluir");
    for (const code of ["access_denied", "manual_linking_disabled", "unknown"]) expect(authReturnMessage(code)!.offerGoogleSignIn).toBe(false);
  });
});

describe("emailLinkAction", () => {
  const HASH = "pkce_0a1b2c3d4e5f60718293a4b5c6d7e8f9";

  it("accepts the three email link types (and the old 'signup' name)", () => {
    expect(emailLinkAction(params(`token_hash=${HASH}&type=email`))).toEqual({ ok: true, tokenHash: HASH, type: "email", next: "/perfil" });
    expect(emailLinkAction(params(`token_hash=${HASH}&type=signup`))).toMatchObject({ ok: true, type: "email" });
    expect(emailLinkAction(params(`token_hash=${HASH}&type=email_change`))).toMatchObject({ ok: true, type: "email_change", next: "/perfil" });
  });

  it("recovery always ends in 'new password', whatever next says", () => {
    expect(emailLinkAction(params(`token_hash=${HASH}&type=recovery&next=%2Fadmin`))).toMatchObject({ ok: true, next: "/perfil/nova-senha" });
  });

  it("keeps next internal only", () => {
    expect(emailLinkAction(params(`token_hash=${HASH}&type=email&next=%2Fpublicar%2Fperdido`))).toMatchObject({ next: "/publicar/perdido" });
    for (const next of ["https://evil.com", "//evil.com", "/\t/evil.com"]) {
      expect(emailLinkAction(params(`token_hash=${HASH}&type=email&next=${encodeURIComponent(next)}`))).toMatchObject({ next: "/perfil" });
    }
  });

  it("refuses missing/odd tokens and unknown types (magic link, invite, etc.)", () => {
    for (const q of ["type=email", `token_hash=${HASH}`, `token_hash=${HASH}&type=magiclink`, `token_hash=${HASH}&type=invite`, "token_hash=abc&type=email", `token_hash=${HASH}%3Cx%3E&type=email`]) {
      expect(emailLinkAction(params(q)), q).toEqual({ ok: false, code: "link" });
    }
  });

  it("has copy for each type", () => {
    for (const t of ["email", "recovery", "email_change"] as const) expect(emailLinkCopy(t).action.length).toBeGreaterThan(3);
  });
});
