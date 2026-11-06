// SOMENTE LEITURA: conta, no Supabase de desenvolvimento, os casos ATIVOS que vêm de
// contas/sessões de teste (E2E e testes de banco) e poluem mapa, mural e listas.
// Não apaga nada — a limpeza depende de aprovação do proprietário.
// Uso: MEL_SAFE_TARGET_REFS=<ref-dev> node --env-file=.env.local scripts/dados-de-teste.mjs
import { createClient } from "@supabase/supabase-js";
import { assertSafeTarget } from "./lib/safe-target.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assertSafeTarget(url, "relatório de dados de teste");
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Padrões dos e-mails criados pelos testes (e2e/support/users.ts e packages/data/tests/helpers.ts).
const TEST_EMAIL = [/^e2e\+.*@exemplo\.com$/, /^test\+.*@exemplo\.com$/, /@mel\.test$/];
const origin = new Map();
async function originOf(id) {
  if (!origin.has(id)) {
    const { data } = await db.auth.admin.getUserById(id);
    const u = data?.user;
    origin.set(id, !u ? "conta já apagada" : u.is_anonymous ? "sessão anônima" : TEST_EMAIL.some((r) => r.test(u.email ?? "")) ? "conta de teste" : "outra conta (não é de teste)");
  }
  return origin.get(id);
}

async function tally(table, ownerCol) {
  const { data, error } = await db.from(table).select(`${ownerCol}, created_at`).eq("status", "ACTIVE");
  if (error) throw error;
  const out = {};
  for (const row of data) {
    const key = `${await originOf(row[ownerCol])} · ${row.created_at.slice(0, 10)}`;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

console.log("Alertas de perdido ativos:", await tally("lost_cases", "owner_id"));
console.log("Encontrados ativos:", await tally("found_cases", "reporter_id"));
