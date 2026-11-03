// Captcha do Supabase Auth LIGADO contra o Auth real — só no ambiente descartável
// do CI (schema-rebuild.yml reinicia o Supabase local com [auth.captcha]
// Turnstile e o segredo de TESTE público do Cloudflare, que aprova o token de
// teste; define MEL_TEST_CAPTCHA=1). Prova que o código do app manda o token
// onde o Auth exige e que, sem token, nada passa — inclusive chamando o Auth
// direto, sem o app.
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";
import { foundInputSchema } from "@mel/core";
import { ensureSession, requestPasswordReset, signInWithPassword, signUpWithPassword } from "../src/auth";
import type { MelClient } from "../src/client";
import { createFoundCase } from "../src/found";
import { serviceClient } from "./helpers";

const enabled = process.env.MEL_TEST_CAPTCHA === "1";
// Token que o widget de teste do Cloudflare entrega (chave pública de teste; não é segredo).
const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const PASSWORD = "Senha-Teste-123";
const CAPTCHA_MESSAGE = /não é um robô/;
const newEmail = (label: string) => `test+${label}-${crypto.randomUUID().slice(0, 8)}@exemplo.com`;
const users: string[] = [];

/** Um "aparelho" novo, sem sessão. */
const device = (): MelClient =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** "Aparelho" em que a renovação da sessão falha (só ela): força o login de reserva da conversão. */
const deviceFailingRefresh = (): MelClient =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        String(input instanceof Request ? input.url : input).includes("grant_type=refresh_token")
          ? Promise.resolve(new Response(JSON.stringify({ code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }), { status: 400, headers: { "Content-Type": "application/json" } }))
          : fetch(input, init),
    },
  });

/** Sessão anônima com uma contribuição (encontrado) que precisa continuar dela depois da conversão. */
async function anonymousWithContribution(client: MelClient) {
  const anon = await ensureSession(client, { captchaToken: TOKEN });
  users.push(anon.id);
  const found = await createFoundCase(
    client,
    anon.id,
    foundInputSchema.parse({ species: "cat", size: "small", sex: "unknown", colorPrimary: "cinza", position: { lat: -15.79, lng: -47.88 }, areaLabel: "Brasília – DF", foundAt: new Date(Date.now() - 600_000).toISOString(), custody: "with_me" }),
  );
  return { anon, found };
}

/** A conta convertida: mesmo id, e-mail gravado, não é mais anônima, contribuição dela. */
async function expectSameAccount(anonId: string, email: string, foundCode: string) {
  const { data } = await serviceClient().auth.admin.getUserById(anonId);
  expect(data.user?.email).toBe(email);
  expect(data.user?.is_anonymous).toBe(false);
  const { data: f } = await serviceClient().from("found_cases").select("reporter_id").eq("short_code", foundCode).single();
  expect((f as { reporter_id: string }).reporter_id).toBe(anonId);
}

afterAll(async () => {
  if (!enabled) return;
  for (const id of users) await serviceClient().auth.admin.deleteUser(id);
});

describe.skipIf(!enabled)("captcha do Auth ligado (Turnstile)", () => {
  it("1/13 — sessão anônima: sem token o Auth recusa (com mensagem amigável), também chamado direto; com token, entra", async () => {
    await expect(ensureSession(device())).rejects.toThrow(CAPTCHA_MESSAGE);
    // Direto no Auth, sem o app: a mesma recusa.
    const direct = await device().auth.signInAnonymously();
    expect(direct.error?.code).toBe("captcha_failed");

    const client = device();
    const user = await ensureSession(client, { captchaToken: TOKEN });
    users.push(user.id);
    expect(user.is_anonymous).toBe(true);
  });

  it("sessão que já existe não gasta captcha (o token nem é pedido); renovar a sessão também não", async () => {
    const client = device();
    const first = await ensureSession(client, { captchaToken: TOKEN });
    users.push(first.id);
    const ask = vi.fn(async () => TOKEN);
    expect((await ensureSession(client, { captchaToken: ask })).id).toBe(first.id);
    expect(ask).not.toHaveBeenCalled();
    const { error } = await client.auth.refreshSession();
    expect(error).toBeNull();
  });

  it("2 — cadastro: sem token recusa; com token cria a conta", async () => {
    await expect(signUpWithPassword(device(), { email: newEmail("cap-nosignup"), password: PASSWORD })).rejects.toThrow(CAPTCHA_MESSAGE);
    const r = await signUpWithPassword(device(), { email: newEmail("cap-signup"), password: PASSWORD }, { captchaToken: TOKEN });
    users.push(r.user.id);
    expect(r.hasSession).toBe(true);
  });

  it("3 — login: sem token recusa (também direto no Auth); com token entra", async () => {
    const email = newEmail("cap-login");
    const created = await serviceClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    users.push(created.data.user!.id);
    await expect(signInWithPassword(device(), { email, password: PASSWORD })).rejects.toThrow(CAPTCHA_MESSAGE);
    const direct = await device().auth.signInWithPassword({ email, password: PASSWORD });
    expect(direct.error?.code).toBe("captcha_failed");
    const user = await signInWithPassword(device(), { email, password: PASSWORD }, { captchaToken: TOKEN });
    expect(user.email).toBe(email);
  });

  it("4 — recuperação de senha: sem token recusa; com token envia", async () => {
    const email = newEmail("cap-reset");
    const created = await serviceClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    users.push(created.data.user!.id);
    const redirect = "http://localhost:3000/auth/callback";
    await expect(requestPasswordReset(device(), email, redirect)).rejects.toThrow(CAPTCHA_MESSAGE);
    await expect(requestPasswordReset(device(), email, redirect, { captchaToken: TOKEN })).resolves.toBeUndefined();
  });

  it("5 — anônimo → conta: a conversão não pede outro captcha e mantém o MESMO id", async () => {
    const client = device();
    const anon = await ensureSession(client, { captchaToken: TOKEN });
    users.push(anon.id);
    const ask = vi.fn(async () => TOKEN);
    const r = await signUpWithPassword(client, { email: newEmail("cap-convert"), password: PASSWORD }, { captchaToken: ask });
    expect(r.convertedFromAnonymous).toBe(true);
    expect(r.user.id).toBe(anon.id);
    expect(r.user.is_anonymous).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });

  it("a chave secreta (servidor, testes) não passa por captcha", async () => {
    const { data, error } = await serviceClient().auth.admin.createUser({ email: newEmail("cap-admin"), password: PASSWORD, email_confirm: true });
    expect(error).toBeNull();
    users.push(data.user!.id);
  });

  describe("conversão anônimo → conta quando a renovação da sessão falha", () => {
    it("renovação falha + token válido: o login de reserva usa o captcha; mesmo id, contribuição mantida, sem conta nova", async () => {
      const client = deviceFailingRefresh();
      const { anon, found } = await anonymousWithContribution(client);
      const email = newEmail("cap-fallback-ok");
      const ask = vi.fn(async () => TOKEN);
      const r = await signUpWithPassword(client, { email, password: PASSWORD }, { captchaToken: ask });
      expect(r).toMatchObject({ convertedFromAnonymous: true, hasSession: true });
      expect(r.user.id).toBe(anon.id);
      expect(ask).toHaveBeenCalledOnce();
      await expectSameAccount(anon.id, email, found);
    });

    it.each([
      ["token ausente", async () => ""],
      ["Turnstile indisponível (sem token)", async () => {
        throw new Error("desafio indisponível");
      }],
    ])("renovação falha + %s: nada de login silencioso; recuperação amigável e a conta fica", async (_why, ask) => {
      const client = deviceFailingRefresh();
      const { anon, found } = await anonymousWithContribution(client);
      const email = newEmail("cap-fallback-no");
      await expect(signUpWithPassword(client, { email, password: PASSWORD }, { captchaToken: ask })).rejects.toThrow(
        "Sua conta foi criada e suas contribuições foram mantidas. Entre com seu e-mail e senha para continuar.",
      );
      await expectSameAccount(anon.id, email, found);
      // Entrar depois, com um desafio novo, abre a MESMA conta (o e-mail é único: não há outra).
      const back = await signInWithPassword(device(), { email, password: PASSWORD }, { captchaToken: TOKEN });
      expect(back.id).toBe(anon.id);
    });
  });
});
