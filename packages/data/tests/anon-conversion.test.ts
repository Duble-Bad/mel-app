// Conversão "sessão sem cadastro → conta" contra o Supabase real (local/dev).
// Regra: criar conta com sessão anônima mantém o MESMO usuário (e tudo o que
// ele enviou); entrar numa conta que já existe nunca transfere nada.
//
// Poucas sessões anônimas de propósito (4): o projeto de desenvolvimento limita
// a criação por IP/hora, e a suíte inteira roda do mesmo runner do CI.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { foundInputSchema, petInputSchema, sightingInputSchema } from "@mel/core";
import { AuthError, ensureSession, signInWithPassword, signUpWithPassword } from "../src/auth";
import { listMessages, listMyConversations, startConversation } from "../src/chat";
import { createFoundCase, getPublicFoundCase } from "../src/found";
import { activateLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { reportContent } from "../src/moderation";
import { createPet } from "../src/pets";
import { getMyProfile } from "../src/profiles";
import { createSighting } from "../src/sightings";
import { anonClient, createTestUser, serviceClient } from "./helpers";

const SE = { lat: -23.55052, lng: -46.633308 };
const NEAR = { lat: -23.5489, lng: -46.6388 };
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const newEmail = (label: string) => `test+${label}-${crypto.randomUUID().slice(0, 8)}@exemplo.com`;
const PASSWORD = "Senha-Teste-123";
const NOTHING = { sightings: 0, found_cases: 0, conversations: 0, messages: 0, reports: 0 };

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let code: string;
const users: string[] = [];

const found = () =>
  foundInputSchema.parse({
    species: "dog",
    size: "mini",
    sex: "female",
    colorPrimary: "caramelo",
    position: NEAR,
    areaLabel: "Sé, São Paulo – SP",
    foundAt: minutesAgo(10),
    custody: "with_me",
    verificationHint: "Mancha branca no peito.",
  });

/** Visitante sem conta que já ajudou: avistamento, "encontrei", conversa e denúncia. */
async function anonymousHelper() {
  const client = anonClient();
  const user = await ensureSession(client);
  users.push(user.id);
  await createSighting(client, sightingInputSchema.parse({ code, position: NEAR, seenAt: minutesAgo(5), notes: "Vi perto da praça." }));
  const foundCode = await createFoundCase(client, user.id, found());
  const conversationId = await startConversation(client, code, "Oi! Acho que vi seu cachorro.");
  await reportContent(client, { type: "lost_case", key: code }, { reason: "other", details: "Teste de conversão" });
  return { client, id: user.id, foundCode, conversationId };
}

/** O que, no banco, pertence a um id (lido sem RLS, só para conferir). */
async function ownedBy(id: string) {
  const admin = serviceClient();
  const head = { count: "exact", head: true } as const;
  const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await query;
    if (error) throw error;
    return n;
  };
  return {
    sightings: await count(admin.from("sightings").select("*", head).eq("reporter_id", id)),
    found_cases: await count(admin.from("found_cases").select("*", head).eq("reporter_id", id)),
    conversations: await count(admin.from("conversations").select("*", head).eq("helper_id", id)),
    messages: await count(admin.from("messages").select("*", head).eq("sender_id", id)),
    reports: await count(admin.from("reports").select("*", head).eq("reporter_id", id)),
  };
}

beforeAll(async () => {
  tutor = await createTestUser("conv-tutor");
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Mel", species: "dog" }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: SE, lostAt: minutesAgo(60), publicAreaLabel: "Sé, São Paulo – SP", contactChat: true });
  code = (await activateLostCase(tutor.client, c.id)).code;
});

afterAll(async () => {
  for (const id of users) await serviceClient().auth.admin.deleteUser(id);
  await tutor?.cleanup();
});

describe("sign up without any session", () => {
  it("creates a permanent user with the name in the profile", async () => {
    const client = anonClient();
    const r = await signUpWithPassword(client, { email: newEmail("plain"), password: PASSWORD, displayName: "Ana Teste" });
    users.push(r.user.id);
    expect(r).toMatchObject({ hasSession: true, needsEmailConfirmation: false, convertedFromAnonymous: false });
    expect(r.user.is_anonymous).toBe(false);
    expect(await getMyProfile(client)).toMatchObject({ id: r.user.id, isAnonymous: false, displayName: "Ana Teste" });
  });
});

describe("anonymous session → new account", () => {
  let converted: Awaited<ReturnType<typeof anonymousHelper>>;
  let stillAnonymous: Awaited<ReturnType<typeof anonymousHelper>>;
  let stillAnonymousBefore: Awaited<ReturnType<typeof ownedBy>>;

  it("keeps the SAME user id, and every contribution stays with it and accessible", async () => {
    converted = await anonymousHelper();
    const before = await ownedBy(converted.id);
    expect(before).toEqual({ sightings: 1, found_cases: 1, conversations: 1, messages: 1, reports: 1 });

    const email = newEmail("convert");
    const r = await signUpWithPassword(converted.client, { email, password: PASSWORD, displayName: "Bia Teste" });
    expect(r).toMatchObject({ hasSession: true, convertedFromAnonymous: true });
    expect(r.user.id).toBe(converted.id);

    // auth.users: mesmo id, agora permanente, com e-mail confirmado. Nenhum usuário novo.
    const { data: authUser } = await serviceClient().auth.admin.getUserById(converted.id);
    expect(authUser.user).toMatchObject({ id: converted.id, email, is_anonymous: false });
    expect(authUser.user?.email_confirmed_at).toBeTruthy();
    const { data: page } = await serviceClient().auth.admin.listUsers({ perPage: 1000 });
    expect(page.users.filter((u) => u.email === email)).toHaveLength(1);

    // Token renovado: a sessão já é de conta real (o proxy libera as áreas de conta).
    const { data: claims } = await converted.client.auth.getClaims();
    expect(claims?.claims.sub).toBe(converted.id);
    expect(claims?.claims.is_anonymous).toBe(false);

    // profiles: on_auth_user_converted tirou a marca de anônimo; o nome foi salvo.
    expect(await getMyProfile(converted.client)).toMatchObject({ id: converted.id, isAnonymous: false, displayName: "Bia Teste" });

    // Tudo continua ligado ao mesmo id e acessível pela conta.
    expect(await ownedBy(converted.id)).toEqual(before);
    expect((await getPublicFoundCase(converted.client, converted.foundCode))?.isReporter).toBe(true);
    expect((await listMyConversations(converted.client)).map((c) => c.id)).toContain(converted.conversationId);
    expect((await listMessages(converted.client, converted.conversationId)).some((m) => m.body.includes("Acho que vi"))).toBe(true);

    // E a pessoa entra depois com e-mail e senha, no mesmo usuário.
    expect((await signInWithPassword(anonClient(), { email, password: PASSWORD })).id).toBe(converted.id);
  });

  it("an email that already has an account is refused and nothing is lost", async () => {
    const existing = newEmail("taken");
    const { data, error } = await serviceClient().auth.admin.createUser({ email: existing, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);

    stillAnonymous = await anonymousHelper();
    stillAnonymousBefore = await ownedBy(stillAnonymous.id);
    const err = await signUpWithPassword(stillAnonymous.client, { email: existing, password: PASSWORD }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe("anonymous_email_exists");

    // A sessão anônima segue intacta e dona das mesmas contribuições; a outra conta não ganhou nada.
    const { data: still } = await stillAnonymous.client.auth.getUser();
    expect(still.user).toMatchObject({ id: stillAnonymous.id, is_anonymous: true });
    expect(await ownedBy(stillAnonymous.id)).toEqual(stillAnonymousBefore);
    expect(await ownedBy(data.user.id)).toEqual(NOTHING);
  });

  it("validation errors keep the anonymous user as it was", async () => {
    const invalid: Array<[email: string, password: string]> = [
      ["nao-e-email", PASSWORD],
      [newEmail("short"), "curta"],
    ];
    for (const [email, password] of invalid) {
      await expect(signUpWithPassword(stillAnonymous.client, { email, password })).rejects.toBeInstanceOf(AuthError);
    }
    const { data } = await serviceClient().auth.admin.getUserById(stillAnonymous.id);
    expect(data.user).toMatchObject({ is_anonymous: true });
    expect(data.user?.email ?? "").toBe("");
    expect(await ownedBy(stillAnonymous.id)).toEqual(stillAnonymousBefore);
  });

  it("nobody claims another user's data: conversion only ever changes the caller", async () => {
    // A conta convertida (o id vem do token, nunca de parâmetro) não alcança o anônimo vizinho.
    expect(converted.id).not.toBe(stillAnonymous.id);
    expect((await getPublicFoundCase(converted.client, stillAnonymous.foundCode))?.isReporter).toBe(false);
    expect((await listMyConversations(converted.client)).map((c) => c.id)).not.toContain(stillAnonymous.conversationId);
    // E não consegue reescrever o dono das linhas do outro.
    await converted.client.from("found_cases").update({ reporter_id: converted.id }).eq("reporter_id", stillAnonymous.id);
    await converted.client.from("sightings").update({ reporter_id: converted.id }).eq("reporter_id", stillAnonymous.id);
    expect(await ownedBy(stillAnonymous.id)).toEqual(stillAnonymousBefore);
    const { data } = await serviceClient().auth.admin.getUserById(stillAnonymous.id);
    expect(data.user?.is_anonymous).toBe(true);
  });

  it("a session the server no longer accepts fails clearly and creates no new user", async () => {
    const visitor = await anonymousHelper();
    // Sessão revogada no servidor (ex.: expirou/saiu em outro lugar) com o token ainda no aparelho.
    await serviceClient().auth.admin.signOut((await visitor.client.auth.getSession()).data.session!.access_token, "global");
    const email = newEmail("expired");
    const err = await signUpWithPassword(visitor.client, { email, password: PASSWORD }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    const { data: page } = await serviceClient().auth.admin.listUsers({ perPage: 1000 });
    expect(page.users.some((u) => u.email === email)).toBe(false);
    expect(await ownedBy(visitor.id)).toMatchObject({ sightings: 1, found_cases: 1 });
  });
});

describe("anonymous session → sign in to an existing account", () => {
  it("switches to that account and transfers nothing automatically", async () => {
    const owner = await createTestUser("conv-existing");
    users.push(owner.id);
    await serviceClient().auth.admin.updateUserById(owner.id, { password: PASSWORD });
    const { data: ownerAuth } = await serviceClient().auth.admin.getUserById(owner.id);

    const visitor = await anonymousHelper();
    const before = await ownedBy(visitor.id);
    const user = await signInWithPassword(visitor.client, { email: ownerAuth.user!.email!, password: PASSWORD });
    expect(user.id).toBe(owner.id);

    // As contribuições continuam do usuário anônimo (publicadas), sem merge; a conta não as recebe.
    expect(await ownedBy(visitor.id)).toEqual(before);
    expect(await ownedBy(owner.id)).toEqual(NOTHING);
    const { data: anon } = await serviceClient().auth.admin.getUserById(visitor.id);
    expect(anon.user?.is_anonymous).toBe(true);
    expect((await getPublicFoundCase(visitor.client, visitor.foundCode))?.isReporter).toBe(false);
  });
});
