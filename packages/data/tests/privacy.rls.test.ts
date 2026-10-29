import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TERMS_VERSION } from "@mel/core";
import { acceptTerms, deleteAccount, exportMyData, listMyConsents } from "../src/privacy";
import { anonClient, createTestUser, serviceClient } from "./helpers";

type U = Awaited<ReturnType<typeof createTestUser>>;
let me: U, other: U;

beforeAll(async () => {
  [me, other] = (await Promise.all([createTestUser("lgpd-me"), createTestUser("lgpd-other")])) as [U, U];
});

afterAll(async () => {
  await Promise.all([me, other].map((u) => u?.cleanup()));
});

describe("privacy (LGPD)", () => {
  it("consents: each person records and reads only their own", async () => {
    await acceptTerms(me.client, me.id);
    expect(await listMyConsents(me.client)).toEqual([expect.objectContaining({ kind: "terms_privacy", version: TERMS_VERSION, granted: true })]);
    expect(await listMyConsents(other.client)).toEqual([]);
    const { error } = await other.client.from("consents").insert({ user_id: me.id, kind: "terms_privacy", version: TERMS_VERSION } as never);
    expect(error).not.toBeNull();
  });

  it("export returns only the caller's data; visitors cannot export", async () => {
    const data = (await exportMyData(me.client)) as Record<string, unknown> & { conta: { id: string }; consentimentos: unknown[] };
    expect(data.conta.id).toBe(me.id);
    expect(data.consentimentos).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain(other.id);
    await expect(exportMyData(anonClient())).rejects.toThrow();
  });

  it("deleting the account removes files and the user (cascade)", async () => {
    const victim = await createTestUser("lgpd-delete");
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    await victim.client.storage.from("avatars").upload(`${victim.id}/a.png`, png);
    await victim.client.storage.from("pet-photos").upload(`${victim.id}/parceiros/logo.png`, png);
    await acceptTerms(victim.client, victim.id);

    const service = serviceClient();
    await deleteAccount(service, victim.id);

    const { data: files } = await service.storage.from("pet-photos").list(`${victim.id}/parceiros`);
    expect(files ?? []).toHaveLength(0);
    const { data: avatars } = await service.storage.from("avatars").list(victim.id);
    expect(avatars ?? []).toHaveLength(0);
    const { data: profile } = await service.from("profiles").select("id").eq("id", victim.id).maybeSingle();
    expect(profile).toBeNull();
    const { data: consents } = await service.from("consents").select("id").eq("user_id", victim.id);
    expect(consents).toEqual([]);
    await victim.cleanup().catch(() => {});
  });
});
