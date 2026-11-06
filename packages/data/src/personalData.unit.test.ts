// Troca de e-mail: só pelo fluxo seguro do Supabase Auth (sem enviar e-mail
// de verdade aqui: o cliente é um dublê que registra a chamada).
import { describe, expect, it } from "vitest";
import { DataError, type MelClient } from "./client";
import { requestEmailChange } from "./personalData";

function fakeAuth(result: { error: null | { message: string; code?: string; status?: number } }) {
  const calls: unknown[][] = [];
  const client = {
    auth: {
      updateUser: async (...args: unknown[]) => {
        calls.push(args);
        return { data: { user: null }, error: result.error };
      },
    },
    from: () => {
      throw new Error("Não pode gravar e-mail em tabela da MEL.");
    },
  } as unknown as MelClient;
  return { client, calls };
}

describe("e-mail change (holder)", () => {
  it("calls Supabase Auth updateUser({ email }) with the confirmation redirect, and never writes a profile copy", async () => {
    const { client, calls } = fakeAuth({ error: null });
    await requestEmailChange(client, "Nova.Pessoa@exemplo.com", "https://mel.test/auth/callback?next=%2Fperfil%2Fdados");
    expect(calls).toEqual([[{ email: "Nova.Pessoa@exemplo.com" }, { emailRedirectTo: "https://mel.test/auth/callback?next=%2Fperfil%2Fdados" }]]);
  });

  it("surfaces Auth errors with their code (rate limit, address in use) for the route to map", async () => {
    const { client } = fakeAuth({ error: { message: "Email rate limit exceeded", code: "over_email_send_rate_limit", status: 429 } });
    const err = await requestEmailChange(client, "a@exemplo.com", "https://mel.test").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DataError);
    expect((err as DataError).code).toBe("over_email_send_rate_limit");
    expect((err as DataError).message).not.toMatch(/rate limit exceeded/i);
  });
});
