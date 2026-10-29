import { createClient } from "@supabase/supabase-js";
import { assertSafeTarget } from "../../scripts/lib/safe-target.mjs";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  // A limpeza apaga visitantes anônimos em massa: jamais fora do local/dev listado.
  assertSafeTarget(url, "limpeza dos testes E2E");
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

async function anonymousIds(client: NonNullable<ReturnType<typeof admin>>): Promise<Set<string> | null> {
  const ids = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[e2e] não foi possível listar usuários:", error.message);
      return null;
    }
    data.users.filter((u) => u.is_anonymous).forEach((u) => ids.add(u.id));
    if (data.users.length < 1000) break;
  }
  return ids;
}

/**
 * Os testes criam visitantes SEM conta (sessões anônimas do navegador) que não
 * passam pelos helpers de usuário. O setup anota os anônimos que já existiam e
 * devolve a limpeza, que remove só os criados durante esta execução. Não usa
 * horário: o relógio local pode divergir do servidor.
 */
export default async function globalSetup() {
  const client = admin();
  const before = client ? await anonymousIds(client) : null;
  return async function removeAnonymousTestUsers() {
    if (!client || !before) return;
    const after = await anonymousIds(client);
    if (!after) return;
    let removed = 0;
    for (const id of after) {
      if (before.has(id)) continue;
      await client.auth.admin.deleteUser(id);
      removed++;
    }
    console.log(`[e2e] ${removed} visitante(s) anônimo(s) de teste removido(s).`);
  };
}
