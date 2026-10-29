import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { petInputSchema, type Pet } from "@mel/core";
import { ensureSession } from "../src/auth";
import { claimPushBatch, savePushSubscription } from "../src/guardian";
import { getAdminOverview, getAuditLog, listAdminReports } from "../src/moderation";
import { listAdoptionsForReview } from "../src/adoption";
import { listBusinessesForReview } from "../src/partners";
import { createPet, deletePet } from "../src/pets";
import { exportMyData } from "../src/privacy";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Acessos que DEVEM falhar, com três papéis (A, B, visitante anônimo) e a
// moderação como controle positivo. Complementa os testes de cada módulo.

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const png = () => new Blob([PNG], { type: "image/png" });

type U = Awaited<ReturnType<typeof createTestUser>>;
let a: U, b: U, mod: U;
let petOfB: Pet;
const BUCKETS = ["avatars", "pet-photos", "sighting-media"] as const;

beforeAll(async () => {
  [a, b, mod] = (await Promise.all(["neg-a", "neg-b", "neg-mod"].map((l) => createTestUser(l)))) as [U, U, U];
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", mod.id);
  petOfB = await createPet(b.client, b.id, petInputSchema.parse({ name: "Pipoca", species: "dog" }));
  await serviceClient().from("pet_private_details").upsert({ pet_id: petOfB.id, owner_id: b.id, microchip_number: "999000000000001" } as never);
});

afterAll(async () => {
  await Promise.all([a, b, mod].map((u) => u?.cleanup()));
});

describe("A versus B (pets and private data)", () => {
  it("A cannot delete B's pet (the pet survives)", async () => {
    await deletePet(a.client, petOfB).catch(() => {});
    const { data } = await serviceClient().from("pets").select("id").eq("id", petOfB.id);
    expect(data).toHaveLength(1);
  });

  it("A cannot change B's private details nor read them", async () => {
    await a.client.from("pet_private_details").update({ microchip_number: "000" } as never).eq("pet_id", petOfB.id);
    const { data: seen } = await a.client.from("pet_private_details").select("*").eq("pet_id", petOfB.id);
    expect(seen).toEqual([]);
    const { data } = await serviceClient().from("pet_private_details").select("microchip_number").eq("pet_id", petOfB.id).single();
    expect((data as { microchip_number: string }).microchip_number).toBe("999000000000001");
  });

  it("A cannot take ownership of B's pet", async () => {
    await a.client.from("pets").update({ owner_id: a.id } as never).eq("id", petOfB.id);
    const { data } = await serviceClient().from("pets").select("owner_id").eq("id", petOfB.id).single();
    expect((data as { owner_id: string }).owner_id).toBe(b.id);
  });
});

describe("visitors without an account (anon key, no session)", () => {
  it("read nothing from private tables", async () => {
    const anon = anonClient();
    for (const table of ["profiles", "pet_private_details", "lost_cases", "found_cases", "messages", "conversations", "notifications", "guardian_settings", "push_subscriptions", "push_outbox", "consents", "moderation_actions", "reports", "blocks"]) {
      const { data } = await anon.from(table as "profiles").select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("cannot export data or call moderation functions", async () => {
    await expect(exportMyData(anonClient())).rejects.toThrow();
    await expect(getAdminOverview(anonClient())).rejects.toThrow();
  });

  it("cannot upload to any bucket", async () => {
    for (const bucket of BUCKETS) {
      const { error } = await anonClient().storage.from(bucket).upload(`${crypto.randomUUID()}/x.png`, png());
      expect(error, bucket).not.toBeNull();
    }
  });
});

describe("the private schema is not reachable through the API", () => {
  it("neither visitors nor logged-in users can call private.* helpers", async () => {
    for (const client of [anonClient(), a.client]) {
      const { error } = await client.schema("private" as "public").rpc("is_moderator" as never);
      expect(error).not.toBeNull();
    }
  });
});

describe("anonymous sessions (sighting senders)", () => {
  it("cannot upload an avatar (real accounts only)", async () => {
    const c = anonClient();
    const uid = (await ensureSession(c)).id;
    const { error } = await c.storage.from("avatars").upload(`${uid}/a.png`, png());
    expect(error).not.toBeNull();
    await serviceClient().auth.admin.deleteUser(uid);
  });
});

describe("storage: A cannot write or delete in B's folder", () => {
  it.each(BUCKETS)("%s", async (bucket) => {
    const path = `${b.id}/neg-${bucket}.png`;
    await serviceClient().storage.from(bucket).upload(path, png(), { upsert: true });

    const up = await a.client.storage.from(bucket).upload(`${b.id}/invasor.png`, png());
    expect(up.error).not.toBeNull();
    const over = await a.client.storage.from(bucket).update(path, png());
    expect(over.error).not.toBeNull();
    await a.client.storage.from(bucket).remove([path]);
    const { data } = await serviceClient().storage.from(bucket).list(b.id, { search: `neg-${bucket}` });
    expect(data?.map((f) => f.name)).toContain(`neg-${bucket}.png`);

    await serviceClient().storage.from(bucket).remove([path]);
  });
});

describe("ordinary users cannot do moderation", () => {
  it("admin functions refuse; the moderator is allowed (control)", async () => {
    for (const call of [getAdminOverview, (c: typeof a.client) => listAdminReports(c), (c: typeof a.client) => getAuditLog(c), listAdoptionsForReview, listBusinessesForReview]) {
      await expect(call(a.client)).rejects.toThrow();
    }
    await expect(getAdminOverview(mod.client)).resolves.toBeTruthy();
  });

  it("cannot write the audit log nor resolve reports directly", async () => {
    const { error } = await a.client.from("moderation_actions").insert({ moderator_id: a.id, action: "dismiss", target_type: "user", target_id: b.id } as never);
    expect(error).not.toBeNull();
    const { data } = await a.client.from("reports").update({ status: "DISMISSED" } as never).neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("push, notifications, guardian and LGPD are per person", () => {
  it("A cannot see B's devices, notifications, guardian area or consents", async () => {
    await savePushSubscription(b.client, { endpoint: `https://push.example/neg-${b.id}`, keys: { p256dh: "p".repeat(20), auth: "a".repeat(16) } });
    await serviceClient().from("notifications").insert({ user_id: b.id, kind: "guardian_alert", payload: {} } as never);
    await serviceClient().from("consents").insert({ user_id: b.id, kind: "terms_privacy", version: "x" } as never);
    for (const table of ["push_subscriptions", "notifications", "guardian_settings", "consents"]) {
      const { data } = await a.client.from(table as "consents").select("*").eq("user_id", b.id);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("only the server (secret key) reads the push queue", async () => {
    const { data } = await a.client.from("push_outbox").select("*").limit(1);
    expect(data ?? []).toEqual([]);
    await expect(claimPushBatch(a.client)).rejects.toThrow();
    await expect(claimPushBatch(anonClient())).rejects.toThrow();
  });

  it("A's export never contains B", async () => {
    const json = JSON.stringify(await exportMyData(a.client));
    expect(json).not.toContain(b.id);
  });
});
