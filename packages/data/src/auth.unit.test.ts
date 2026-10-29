// Unitários do cadastro/conversão com cliente simulado (sem rede, sem banco).
// O comportamento real do Supabase é coberto em tests/anon-conversion.test.ts.
import { describe, expect, it, vi } from "vitest";
import { AuthError, linkGoogleToAnonymous, signInWithGoogle, signUpWithPassword } from "./auth";
import type { MelClient } from "./client";

const ANON_ID = "11111111-1111-4111-8111-111111111111";
const creds = { email: "pessoa@exemplo.com", password: "Senha-Teste-123", displayName: "Pessoa Teste" };

type Over = Partial<Record<"getSession" | "updateUser" | "signUp" | "refreshSession" | "signInWithPassword" | "linkIdentity" | "signInWithOAuth", ReturnType<typeof vi.fn>>>;

function fakeClient({ anonymous = true, ...over }: Over & { anonymous?: boolean | null } = {}) {
  const profileUpdate = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: anonymous === null ? null : { user: { id: ANON_ID, is_anonymous: anonymous } } },
      error: null,
    })),
    updateUser: vi.fn(async () => ({ data: { user: { id: ANON_ID, is_anonymous: false, email: creds.email } }, error: null })),
    signUp: vi.fn(async () => ({ data: { user: { id: "novo", identities: [{}] }, session: {} }, error: null })),
    refreshSession: vi.fn(async () => ({ data: { session: {} }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: { id: ANON_ID } }, error: null })),
    linkIdentity: vi.fn(async () => ({ data: { provider: "google", url: "https://accounts.google.com/o/oauth2/auth?x" }, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: { provider: "google", url: "https://accounts.google.com/o/oauth2/auth?y" }, error: null })),
    ...over,
  };
  const client = { auth, from: vi.fn(() => ({ update: profileUpdate })) } as unknown as MelClient;
  return { client, auth, profileUpdate };
}

const authError = (code: string | undefined, name = "AuthApiError") => Object.assign(new Error(code ?? name), { code, name });

describe("signUpWithPassword without a session", () => {
  it("creates a new account with signUp (and never touches updateUser)", async () => {
    const { client, auth } = fakeClient({ anonymous: null });
    const r = await signUpWithPassword(client, creds, { emailRedirectTo: "https://mel.example/auth/callback" });
    expect(r).toMatchObject({ hasSession: true, needsEmailConfirmation: false, convertedFromAnonymous: false });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: creds.email,
      password: creds.password,
      options: { data: { full_name: creds.displayName }, emailRedirectTo: "https://mel.example/auth/callback" },
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("reports a pending email confirmation when signUp returns no session", async () => {
    const { client } = fakeClient({ anonymous: null, signUp: vi.fn(async () => ({ data: { user: { id: "novo", identities: [{}] }, session: null }, error: null })) });
    expect(await signUpWithPassword(client, creds)).toMatchObject({ hasSession: false, needsEmailConfirmation: true });
  });

  it("a real (non-anonymous) session also signs up normally", async () => {
    const { client, auth } = fakeClient({ anonymous: false });
    await signUpWithPassword(client, creds);
    expect(auth.signUp).toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("signUpWithPassword with an anonymous session (conversion)", () => {
  it("adds email + password to the SAME user, renews the token and saves the name", async () => {
    const { client, auth, profileUpdate } = fakeClient();
    const r = await signUpWithPassword(client, creds);
    expect(r).toMatchObject({ user: { id: ANON_ID }, hasSession: true, needsEmailConfirmation: false, convertedFromAnonymous: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ email: creds.email, password: creds.password, data: { full_name: creds.displayName } }, undefined);
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.refreshSession).toHaveBeenCalledOnce();
    expect(profileUpdate).toHaveBeenCalledWith({ display_name: creds.displayName });
  });

  it("with Confirm email ON the user stays anonymous: pending, no token refresh", async () => {
    const { client, auth } = fakeClient({ updateUser: vi.fn(async () => ({ data: { user: { id: ANON_ID, is_anonymous: true } }, error: null })) });
    const r = await signUpWithPassword(client, creds, { emailRedirectTo: "https://mel.example/auth/callback" });
    expect(r).toMatchObject({ hasSession: false, needsEmailConfirmation: true, convertedFromAnonymous: false });
    expect(auth.updateUser).toHaveBeenCalledWith(expect.anything(), { emailRedirectTo: "https://mel.example/auth/callback" });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it("falls back to signing in when the token refresh fails", async () => {
    const { client, auth } = fakeClient({ refreshSession: vi.fn(async () => ({ data: { session: null }, error: authError(undefined, "AuthRetryableFetchError") })) });
    expect(await signUpWithPassword(client, creds)).toMatchObject({ convertedFromAnonymous: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: creds.email, password: creds.password });
  });

  it("explains that the account exists when refresh and sign-in both fail", async () => {
    const { client } = fakeClient({
      refreshSession: vi.fn(async () => ({ data: { session: null }, error: authError("over_request_rate_limit") })),
      signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: authError("over_request_rate_limit") })),
    });
    await expect(signUpWithPassword(client, creds)).rejects.toThrow("Sua conta foi criada e suas contribuições foram mantidas");
  });

  it.each([
    ["e-mail já cadastrado", "email_exists", "Já existe uma conta com este e-mail. Você pode entrar nela, mas o que enviou sem conta"],
    ["e-mail inválido", "email_address_invalid", "Não conseguimos usar este e-mail"],
    ["senha fraca/curta", "weak_password", "Essa senha é fácil de adivinhar"],
    ["sessão expirada no servidor", "session_not_found", "Sua sessão expirou"],
    ["rate limit", "over_request_rate_limit", "Muitas tentativas seguidas"],
    ["erro inesperado do Supabase", "unexpected_failure", "Não deu certo agora"],
  ])("%s: clear message, nothing else is tried", async (_why, code, message) => {
    const { client, auth } = fakeClient({ updateUser: vi.fn(async () => ({ data: { user: null }, error: authError(code) })) });
    const err = await signUpWithPassword(client, creds).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.message).toContain(message);
    // Nunca cai num cadastro novo (que deixaria as contribuições para trás).
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it("session missing on the client and network failure have human messages", async () => {
    const missing = fakeClient({ updateUser: vi.fn(async () => ({ data: { user: null }, error: authError(undefined, "AuthSessionMissingError") })) });
    await expect(signUpWithPassword(missing.client, creds)).rejects.toThrow("Sua sessão expirou");
    const offline = fakeClient({ updateUser: vi.fn(async () => ({ data: { user: null }, error: authError(undefined, "AuthRetryableFetchError") })) });
    await expect(signUpWithPassword(offline.client, creds)).rejects.toThrow("Verifique sua conexão");
    expect(missing.auth.signUp).not.toHaveBeenCalled();
    expect(offline.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("Google", () => {
  const CALLBACK = "https://mel.example/auth/callback?next=%2Fperfil";

  it("anonymous visitor links Google to the SAME user (linkIdentity), never signInWithOAuth", async () => {
    const { client, auth } = fakeClient();
    expect(await linkGoogleToAnonymous(client, CALLBACK)).toContain("accounts.google.com");
    expect(auth.linkIdentity).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: CALLBACK } });
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("visitor without session uses the normal OAuth sign-in", async () => {
    const { client, auth } = fakeClient({ anonymous: null });
    await signInWithGoogle(client, CALLBACK);
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: CALLBACK } });
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it.each([
    ["manual linking desligado", "manual_linking_disabled", "e-mail e senha para manter"],
    ["sem token no servidor", "no_authorization", "Sua sessão expirou"],
    ["sessão revogada", "session_not_found", "Sua sessão expirou"],
    ["rate limit", "over_request_rate_limit", "Muitas tentativas"],
    ["erro inesperado", "unexpected_failure", "Não deu certo agora"],
  ])("linking failure before leaving the site (%s) has a clear message", async (_why, code, message) => {
    const { client } = fakeClient({ linkIdentity: vi.fn(async () => ({ data: { provider: "google", url: null }, error: authError(code) })) });
    await expect(linkGoogleToAnonymous(client, CALLBACK)).rejects.toThrow(message);
  });

  it("session missing on the client and network failure while linking", async () => {
    const missing = fakeClient({ linkIdentity: vi.fn(async () => ({ data: { url: null }, error: authError(undefined, "AuthSessionMissingError") })) });
    await expect(linkGoogleToAnonymous(missing.client, CALLBACK)).rejects.toThrow("Sua sessão expirou");
    const offline = fakeClient({ linkIdentity: vi.fn(async () => ({ data: { url: null }, error: authError(undefined, "AuthRetryableFetchError") })) });
    await expect(linkGoogleToAnonymous(offline.client, CALLBACK)).rejects.toThrow("Verifique sua conexão");
  });
});
