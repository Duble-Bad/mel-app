// Apaga contas de TESTE que sobraram no projeto de desenvolvimento (e, em cascata, os pets e
// alertas delas). Só toca e-mails criados pelos testes: test+…@exemplo.com (testes de banco) e
// e2e+…@exemplo.com (testes E2E). Contas demo.* e contas reais nunca entram.
//
// Uso:  node --env-file=.env.local scripts/limpar-contas-de-teste.mjs            (só lista)
//       node --env-file=.env.local scripts/limpar-contas-de-teste.mjs --apagar   (apaga, uma por vez)
//       ... --apagar --manter=20   (mantém 20: primeiro as que têm alertas ativos, depois as mais novas)
// Trava: só roda contra o Supabase local ou um projeto em MEL_SAFE_TARGET_REFS (nunca produção).
import { createClient } from "@supabase/supabase-js";
import { assertSafeTarget } from "./lib/safe-target.mjs";

const TEST_EMAIL = /^(test|e2e)\+[a-z0-9-]+@exemplo\.com$/;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
assertSafeTarget(url, "limpeza de contas de teste");
if (!key) throw new Error('SUPABASE_SECRET_KEY ausente (rode "npm run env:pull").');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const apagar = process.argv.includes("--apagar");
const manter = Math.max(0, Number(process.argv.find((a) => a.startsWith("--manter="))?.split("=")[1] ?? 0) || 0);

const found = [];
for (let page = 1; page <= 50; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) if (TEST_EMAIL.test(u.email ?? "")) found.push(u);
  if (data.users.length < 1000) break;
}
// Alertas ativos por dono: as contas com dados ficam (servem para testar o mapa e o mural).
const active = {};
{
  const { data, error } = await db.from("lost_cases").select("pets(owner_id)").eq("status", "ACTIVE");
  if (error) throw error;
  for (const r of data ?? []) {
    const id = r.pets?.owner_id;
    if (id) active[id] = (active[id] ?? 0) + 1;
  }
}
found.sort((a, b) => (active[b.id] ?? 0) - (active[a.id] ?? 0) || b.created_at.localeCompare(a.created_at));
const kept = found.slice(0, manter);
const toDelete = found.slice(manter);
if (manter) {
  const alerts = kept.reduce((n, u) => n + (active[u.id] ?? 0), 0);
  console.log(`Mantidas: ${kept.length} conta(s), com ${alerts} alerta(s) ativo(s) no total.`);
}
const byLabel = {};
for (const u of toDelete) {
  const label = u.email.replace(/-[0-9a-f]{8}@.*$/, "");
  byLabel[label] = (byLabel[label] ?? 0) + 1;
}
console.log("Contas de teste encontradas:", found.length, "· a apagar:", toDelete.length, byLabel);
if (!apagar) {
  console.log("Nada foi apagado. Para apagar, repita com --apagar.");
  process.exit(0);
}

let ok = 0;
const failed = [];
for (const u of toDelete) {
  let error = null;
  for (let i = 1; i <= 4; i++) {
    ({ error } = await db.auth.admin.deleteUser(u.id));
    if (!error || /not.?found/i.test(error.message)) break;
    await new Promise((r) => setTimeout(r, 400 * i));
  }
  if (error && !/not.?found/i.test(error.message)) failed.push(`${u.email}: ${error.message}`);
  else ok++;
}
console.log(`${ok} apagada(s).${failed.length ? ` ${failed.length} falharam:\n  ${failed.join("\n  ")}` : ""}`);
