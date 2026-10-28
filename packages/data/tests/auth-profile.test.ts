import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthError, ensureSession, signInWithPassword, signUpWithPassword } from "../src/auth";
import { getMyProfile, saveMyProfile, uploadAvatar } from "../src/profiles";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// 1x1 PNG transparente.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);
const pngBlob = () => new Blob([PNG], { type: "image/png" });

const cleanups: Array<() => Promise<unknown>> = [];
afterAll(async () => {
  for (const cleanup of cleanups) await cleanup();
});

describe("anonymous session (sightings without signup)", () => {
  it("creates a session and an anonymous profile", async () => {
    const client = anonClient();
    const user = await ensureSession(client);
    cleanups.push(() => serviceClient().auth.admin.deleteUser(user.id));

    expect(user.is_anonymous).toBe(true);
    const profile = await getMyProfile(client);
    expect(profile).toMatchObject({ id: user.id, isAnonymous: true, onboardedAt: null });
  });

  it("reuses the existing session instead of creating a new one", async () => {
    const client = anonClient();
    const first = await ensureSession(client);
    cleanups.push(() => serviceClient().auth.admin.deleteUser(first.id));
    const second = await ensureSession(client);
    expect(second.id).toBe(first.id);
  });

  it("cannot upload a profile photo", async () => {
    const client = anonClient();
    const user = await ensureSession(client);
    cleanups.push(() => serviceClient().auth.admin.deleteUser(user.id));
    await expect(uploadAvatar(client, user.id, pngBlob())).rejects.toThrow();
  });
});

describe("email + password", () => {
  it("signs up with an immediate session and rejects duplicate emails", async () => {
    const email = `test+signup-${crypto.randomUUID().slice(0, 8)}@exemplo.com`;
    const client = anonClient();
    const { user, hasSession } = await signUpWithPassword(client, { email, password: "Senha-Teste-123" });
    cleanups.push(() => serviceClient().auth.admin.deleteUser(user.id));
    expect(hasSession).toBe(true);

    await expect(signUpWithPassword(anonClient(), { email, password: "Outra-Senha-123" })).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it("returns a human message for wrong passwords", async () => {
    const someone = await createTestUser("wrongpass");
    cleanups.push(someone.cleanup);
    const { data } = await serviceClient().auth.admin.getUserById(someone.id);
    await expect(
      signInWithPassword(anonClient(), { email: data.user!.email!, password: "senha-errada-123" }),
    ).rejects.toThrow("E-mail ou senha não conferem");
  });
});

describe("onboarding and avatar", () => {
  let carla: Awaited<ReturnType<typeof createTestUser>>;
  let dani: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    carla = await createTestUser("carla");
    dani = await createTestUser("dani");
    cleanups.push(carla.cleanup, dani.cleanup);
  });

  it("saves profile data and marks onboarding as done", async () => {
    const profile = await saveMyProfile(carla.client, carla.id, {
      displayName: "Carla Teste",
      city: "Campinas",
      state: "SP",
    });
    expect(profile).toMatchObject({ displayName: "Carla Teste", city: "Campinas", state: "SP" });
    expect(profile.onboardedAt).not.toBeNull();
  });

  it("uploads a photo to the user's own folder with a public URL", async () => {
    const url = await uploadAvatar(carla.client, carla.id, pngBlob());
    expect(url).toContain(`/avatars/${carla.id}/`);
    const res = await fetch(url);
    expect(res.ok).toBe(true);
    await serviceClient().storage.from("avatars").remove([url.split("/avatars/")[1]!]);
  });

  it("forbids uploading into someone else's folder", async () => {
    await expect(uploadAvatar(carla.client, dani.id, pngBlob())).rejects.toThrow();
  });
});
