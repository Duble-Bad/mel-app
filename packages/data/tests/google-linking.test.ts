// Vínculo do Google à sessão anônima contra o Auth real — só no ambiente
// descartável do CI (schema-rebuild.yml liga manual linking + um Google
// FICTÍCIO e define MEL_TEST_LINKING=1). No mel-dev o teste é pulado.
//
// O que dá para provar sem uma conta Google: quem pode INICIAR o vínculo e
// para onde ele vai. O consentimento no Google (a prova de posse) e o retorno
// não rodam no CI; o comportamento do retorno está no relatório/decisões.
import { afterAll, describe, expect, it } from "vitest";
import { AuthError, ensureSession, linkGoogleToAnonymous } from "../src/auth";
import { anonClient, serviceClient } from "./helpers";

const enabled = process.env.MEL_TEST_LINKING === "1";
const CALLBACK = "http://localhost:3000/auth/callback?next=%2Fperfil";
const users: string[] = [];

afterAll(async () => {
  for (const id of users) await serviceClient().auth.admin.deleteUser(id);
});

describe.skipIf(!enabled)("Google linking for an anonymous visitor (disposable Auth)", () => {
  it("an anonymous session starts linking Google to ITSELF; nothing changes until Google proves ownership", async () => {
    const client = anonClient();
    const user = await ensureSession(client);
    users.push(user.id);

    const url = new URL(await linkGoogleToAnonymous(client, CALLBACK));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("mel-ci-fake-client-id");
    // O Google volta para o Auth do Supabase (não para o app); o state amarra ao vínculo.
    expect(url.searchParams.get("redirect_uri")).toMatch(/\/auth\/v1\/callback$/);
    expect(url.searchParams.get("state")).toBeTruthy();

    // Só iniciar não muda o usuário: continua anônimo, sem e-mail e sem identidade Google.
    const { data } = await serviceClient().auth.admin.getUserById(user.id);
    expect(data.user).toMatchObject({ id: user.id, is_anonymous: true });
    expect(data.user?.email ?? "").toBe("");
    expect((data.user?.identities ?? []).some((i) => i.provider === "google")).toBe(false);
  });

  it("without a session the server refuses to start linking (nobody links to someone else)", async () => {
    await expect(linkGoogleToAnonymous(anonClient(), CALLBACK)).rejects.toBeInstanceOf(AuthError);
  });

  it("a session revoked on the server cannot start linking", async () => {
    const client = anonClient();
    const user = await ensureSession(client);
    users.push(user.id);
    await serviceClient().auth.admin.signOut((await client.auth.getSession()).data.session!.access_token, "global");
    const err = await linkGoogleToAnonymous(client, CALLBACK).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.message).toContain("Sua sessão expirou");
  });
});
