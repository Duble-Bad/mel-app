import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getHealth } from "../src/health";
import { anonClient, createTestUser, serviceClient } from "./helpers";

describe("health_check", () => {
  it("responds to anonymous visitors and reports PostGIS", async () => {
    const health = await getHealth(anonClient());
    expect(health.ok).toBe(true);
    expect(health.postgis).toMatch(/^\d+\.\d+/);
  });
});

describe("profiles RLS", () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>;
  let bob: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");
  });

  afterAll(async () => {
    await alice?.cleanup();
    await bob?.cleanup();
  });

  it("creates a profile automatically on signup", async () => {
    const { data } = await serviceClient().from("profiles").select("id, role").eq("id", alice.id).single();
    expect(data).toMatchObject({ id: alice.id, role: "user" });
  });

  it("lets a user read their own profile", async () => {
    const { data, error } = await alice.client.from("profiles").select("id").eq("id", alice.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("hides other users' profiles", async () => {
    const { data } = await alice.client.from("profiles").select("id").eq("id", bob.id);
    expect(data).toEqual([]);
  });

  it("denies the profiles table to visitors without a session", async () => {
    const { data, error } = await anonClient().from("profiles").select("id").limit(1);
    expect(data).toBeNull();
    expect(error?.code).toBe("42501"); // permission denied
  });

  it("lets a user edit allowed fields of their own profile", async () => {
    const { error } = await alice.client
      .from("profiles")
      .update({ display_name: "Alice Teste", city: "São Paulo", state: "SP" })
      .eq("id", alice.id);
    expect(error).toBeNull();
  });

  it("forbids a user from promoting themselves to admin", async () => {
    const { error } = await alice.client.from("profiles").update({ role: "admin" }).eq("id", alice.id);
    expect(error).not.toBeNull();
    const { data } = await serviceClient().from("profiles").select("role").eq("id", alice.id).single();
    expect(data?.role).toBe("user");
  });

  it("forbids editing someone else's profile", async () => {
    await alice.client.from("profiles").update({ display_name: "hacked" }).eq("id", bob.id);
    const { data } = await serviceClient().from("profiles").select("display_name").eq("id", bob.id).single();
    expect(data?.display_name).not.toBe("hacked");
  });

  it("rejects an invalid state code", async () => {
    const { error } = await alice.client.from("profiles").update({ state: "XX1" }).eq("id", alice.id);
    expect(error).not.toBeNull();
  });
});
