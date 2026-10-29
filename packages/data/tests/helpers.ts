import { createClient } from "@supabase/supabase-js";
import type { MelClient } from "../src/client";
import { assertSafeTarget } from "../../../scripts/lib/safe-target.mjs";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} ausente. Rode "npm run env:pull".`);
  return value;
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function anonClient(): MelClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), options);
}

/** Ignora RLS. Usar apenas para preparar/limpar dados de teste. */
export function serviceClient(): MelClient {
  // Segunda barreira (a primeira é o vitest.db.config): a chave que ignora RLS só vai para alvo seguro.
  assertSafeTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, "testes de banco");
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), options);
}

/** Cria um usuário confirmado de teste e devolve um cliente logado como ele. */
export async function createTestUser(label: string) {
  const admin = serviceClient();
  const email = `test+${label}-${crypto.randomUUID().slice(0, 8)}@exemplo.com`;
  const password = `T3st-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser falhou");

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return {
    id: data.user.id,
    client,
    cleanup: async () => {
      await admin.auth.admin.deleteUser(data.user.id);
    },
  };
}
