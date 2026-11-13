// Apaga contas de TESTE que sobraram no projeto de desenvolvimento (e, em cascata, os pets e
// alertas delas). Só toca e-mails criados pelos testes: test+…@exemplo.com (testes de banco) e
// e2e+…@exemplo.com (testes E2E). Contas demo.* e contas reais nunca entram.
//
// Uso:  node --env-file=.env.local scripts/limpar-contas-de-teste.mjs            (só lista)
//       node --env-file=.env.local scripts/limpar-contas-de-teste.mjs --apagar   (apaga, uma por vez)
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

const found = [];
for (let page = 1; page <= 50; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) if (TEST_EMAIL.test(u.email ?? "")) found.push(u);
  if (data.users.length < 1000) break;
}
const byLabel = {};
for (const u of found) {
  const label = u.email.replace(/-[0-9a-f]{8}@.*$/, "");
  byLabel[label] = (byLabel[label] ?? 0) + 1;
}
console.log(`${found.length} conta(s) de teste encontrada(s):`, byLabel);
if (!apagar) {
  console.log("Nada foi apagado. Para apagar, repita com --apagar.");
  process.exit(0);
}

let ok = 0;
const failed = [];
for (const u of found) {
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
