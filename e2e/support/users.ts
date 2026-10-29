import { createClient } from "@supabase/supabase-js";
import { assertSafeTarget } from "../../scripts/lib/safe-target.mjs";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Rode "npm run env:pull" antes dos testes E2E.');
  assertSafeTarget(url, "testes E2E");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const testEmail = (label: string) => `e2e+${label}-${crypto.randomUUID().slice(0, 8)}@exemplo.com`;
export const TEST_PASSWORD = "Senha-E2E-12345";

/** Cria usuário confirmado; com `onboarded`, já com perfil preenchido (dados fictícios). */
export async function createUser(label: string, { onboarded = false } = {}) {
  const email = testEmail(label);
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser falhou");
  if (onboarded) {
    await admin()
      .from("profiles")
      .update({ display_name: "Bia Teste", city: "Campinas", state: "SP", onboarded_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }
  return { id: data.user.id, email };
}

/** Papel de moderação (somente testes; em produção use `npm run admin:role`). */
export async function setRole(id: string, role: "user" | "moderator" | "admin") {
  const { error } = await admin().from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function deleteUserById(id: string) {
  await admin().auth.admin.deleteUser(id);
}

export async function deleteUserByEmail(email: string) {
  const client = admin();
  // Usuários de teste são poucos; a primeira página basta.
  const { data } = await client.auth.admin.listUsers({ perPage: 200 });
  const user = data.users.find((u) => u.email === email);
  if (user) await client.auth.admin.deleteUser(user.id);
}
