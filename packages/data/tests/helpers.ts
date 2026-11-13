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
/**
 * Apaga uma conta de teste e CONFERE o resultado. Antes o erro era ignorado: quando o banco
 * recusava (ex.: exclusões em cascata simultâneas disputando os mesmos registros), a conta e os
 * alertas dela ficavam no mel-dev e apareciam no mapa e no mural. Tenta de novo com espera e,
 * se ainda falhar, avisa no console com o motivo (sem derrubar o teste que já passou).
 */
export async function deleteTestUser(id: string, attempts = 4) {
  const admin = serviceClient();
  for (let i = 1; i <= attempts; i++) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error || /not.?found/i.test(error.message)) return true;
    if (i === attempts) {
      console.error(`[testes] não foi possível apagar a conta de teste ${id.slice(0, 8)}: ${error.message}`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 400 * i));
  }
  return false;
}

/** Apaga várias contas de teste UMA POR VEZ (em paralelo, as cascatas disputavam os mesmos registros). */
export async function cleanupSequentially(users: ({ cleanup: () => Promise<unknown> } | undefined)[]) {
  for (const u of users) if (u) await u.cleanup();
}

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
    cleanup: () => deleteTestUser(data.user.id),
  };
}
