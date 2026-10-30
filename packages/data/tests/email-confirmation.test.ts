// "Confirm email" ON contra o Auth real — só no ambiente descartável do CI
// (schema-rebuild.yml reinicia o Supabase local com a confirmação ligada e
// define MEL_TEST_CONFIRM=1). Os e-mails são lidos no Mailpit local e o link
// sai dos NOSSOS templates (supabase/templates), como chegaria à pessoa.
//
// Cobre: cadastro sem sessão imediata, confirmação em outro aparelho, link de
// uso único, e-mail já cadastrado sem enumeração, recuperação de senha e
// anônimo → conta pelo link (mesmo id, contribuições mantidas).
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { emailLinkAction, foundInputSchema } from "@mel/core";
import { ensureSession, requestPasswordReset, signInWithPassword, signUpWithPassword, updatePassword } from "../src/auth";
import type { MelClient } from "../src/client";
import { createFoundCase, getPublicFoundCase } from "../src/found";
import { getMyProfile } from "../src/profiles";
import { anonClient, serviceClient } from "./helpers";

const enabled = process.env.MEL_TEST_CONFIRM === "1";
const MAILPIT = process.env.MEL_MAILPIT_URL ?? "http://127.0.0.1:54324";
const PASSWORD = "Senha-Teste-123";
const newEmail = (label: string) => `test+${label}-${crypto.randomUUID().slice(0, 8)}@exemplo.com`;
const users: string[] = [];

/** Cliente como o do app no navegador (PKCE), num "aparelho" próprio. */
function browserLikeClient(): MelClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "pkce" },
  });
}

/** Espera o e-mail chegar no Mailpit e devolve assunto + o link do template. */
async function emailLink(to: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const href = String(message.HTML).match(/href="([^"]*\/auth\/confirmar\?[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
      if (!href) throw new Error(`e-mail sem link de /auth/confirmar: ${message.Subject}`);
      const url = new URL(href);
      return { subject: String(message.Subject), url, link: emailLinkAction(url.searchParams) };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`nenhum e-mail para ${to}`);
}

async function userByEmail(email: string) {
  const { data } = await serviceClient().auth.admin.listUsers({ perPage: 1000 });
  return data.users.filter((u) => u.email === email);
}

afterAll(async () => {
  for (const id of users) await serviceClient().auth.admin.deleteUser(id);
});

describe.skipIf(!enabled)("Confirm email ON (disposable Auth + Mailpit)", () => {
  it("sign up: no session yet, our template's link confirms from ANOTHER device, and only once", async () => {
    const email = newEmail("confirm");
    const r = await signUpWithPassword(browserLikeClient(), { email, password: PASSWORD, displayName: "Clara Teste" });
    users.push(r.user.id);
    expect(r).toMatchObject({ hasSession: false, needsEmailConfirmation: true, convertedFromAnonymous: false });
    const [pending] = await userByEmail(email);
    expect(pending?.email_confirmed_at ?? null).toBeNull();

    const mail = await emailLink(email);
    expect(mail.subject).toBe("Confirme seu e-mail na MEL");
    expect(mail.url.pathname).toBe("/auth/confirmar");
    expect(mail.link).toMatchObject({ ok: true, type: "email", next: "/perfil" });
    if (!mail.link.ok) return;

    // Outro "aparelho" (o app de e-mail do celular): sem o code verifier do cadastro.
    const phone = browserLikeClient();
    const { data, error } = await phone.auth.verifyOtp({ type: mail.link.type, token_hash: mail.link.tokenHash });
    expect(error).toBeNull();
    expect(data.user?.id).toBe(r.user.id);
    expect(data.session).toBeTruthy();
    expect(await getMyProfile(phone)).toMatchObject({ id: r.user.id, isAnonymous: false, displayName: "Clara Teste", onboardedAt: null });

    // O mesmo link não vale de novo.
    const again = await browserLikeClient().auth.verifyOtp({ type: mail.link.type, token_hash: mail.link.tokenHash });
    expect(again.error).not.toBeNull();
  });

  it("an email that already has an account gets the same neutral answer and no second user", async () => {
    const email = newEmail("dup");
    const { data, error } = await serviceClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);

    const r = await signUpWithPassword(browserLikeClient(), { email, password: "Outra-Senha-123" });
    expect(r).toMatchObject({ hasSession: false, needsEmailConfirmation: true });
    expect(await userByEmail(email)).toHaveLength(1);
  });

  it("password recovery: our template's link opens a session where the new password can be saved", async () => {
    const email = newEmail("recover");
    const { data, error } = await serviceClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);

    await requestPasswordReset(browserLikeClient(), email, "http://localhost:3000/auth/callback?next=%2Fperfil%2Fnova-senha");
    const mail = await emailLink(email);
    expect(mail.subject).toBe("Crie uma senha nova na MEL");
    expect(mail.link).toMatchObject({ ok: true, type: "recovery", next: "/perfil/nova-senha" });
    if (!mail.link.ok) return;

    const phone = browserLikeClient();
    const { error: verifyError } = await phone.auth.verifyOtp({ type: mail.link.type, token_hash: mail.link.tokenHash });
    expect(verifyError).toBeNull();
    await updatePassword(phone, "Senha-Nova-456");
    expect((await signInWithPassword(anonClient(), { email, password: "Senha-Nova-456" })).id).toBe(data.user.id);
  });

  it("anonymous → account: stays anonymous until the link, then the SAME id becomes the account", async () => {
    const visitor = browserLikeClient();
    const anon = await ensureSession(visitor);
    users.push(anon.id);
    const foundCode = await createFoundCase(
      visitor,
      anon.id,
      foundInputSchema.parse({
        species: "cat",
        size: "small",
        sex: "unknown",
        colorPrimary: "preto",
        position: { lat: -23.5489, lng: -46.6388 },
        areaLabel: "Sé, São Paulo – SP",
        foundAt: new Date(Date.now() - 600_000).toISOString(),
        custody: "with_me",
      }),
    );

    const email = newEmail("anon-confirm");
    const r = await signUpWithPassword(visitor, { email, password: PASSWORD, displayName: "Davi Teste" });
    expect(r).toMatchObject({ hasSession: false, needsEmailConfirmation: true, convertedFromAnonymous: false });
    expect(r.user.id).toBe(anon.id);
    // Ainda anônimo e sem e-mail até o link: nada se perde se a pessoa nunca confirmar.
    const { data: before } = await serviceClient().auth.admin.getUserById(anon.id);
    expect(before.user).toMatchObject({ is_anonymous: true });
    expect(before.user?.email ?? "").toBe("");

    const mail = await emailLink(email);
    expect(mail.subject).toBe("Confirme seu e-mail na MEL");
    expect(mail.link).toMatchObject({ ok: true, type: "email_change" });
    if (!mail.link.ok) return;

    const phone = browserLikeClient();
    const { data, error } = await phone.auth.verifyOtp({ type: mail.link.type, token_hash: mail.link.tokenHash });
    expect(error).toBeNull();
    expect(data.user).toMatchObject({ id: anon.id, email, is_anonymous: false });

    // Mesmo id: a contribuição anônima segue dela; o perfil virou conta; e-mail + senha funcionam.
    expect((await getPublicFoundCase(phone, foundCode))?.isReporter).toBe(true);
    expect(await getMyProfile(phone)).toMatchObject({ id: anon.id, isAnonymous: false });
    expect((await signInWithPassword(anonClient(), { email, password: PASSWORD })).id).toBe(anon.id);
    expect(await userByEmail(email)).toHaveLength(1);
  });
});
