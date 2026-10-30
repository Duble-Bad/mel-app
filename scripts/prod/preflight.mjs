// Pre-flight do deploy de SCHEMA em produção. Qualquer verificação crítica que
// falhe ABORTA. Só lê: repositório, git, GitHub (CI) e, no banco de produção,
// a lista de migrations já registradas (transação READ ONLY).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkManifest, openReadOnly, scanForSeedData } from "../schema-audit/catalog.mjs";
import { assertProdTarget, maskRef } from "./prod-target.mjs";

export const EXPECTED_MIGRATIONS = 28;

/** Checks do GitHub que precisam estar verdes no commit que vai para produção. */
export const REQUIRED_CHECKS = ["Verificações rápidas (tipos, lint, unitários)", "Banco (RLS) e ponta a ponta", "Banco do zero, auditoria e testes"];

/**
 * O ÚNICO plano permitido. `<DB_URL>` é substituído em tempo de execução.
 * Não há link, reset, seed, config push, E2E nem nada além de `db push`.
 */
export const PLAN = [
  { step: "estado antes", kind: "read-only-sql" },
  { step: "simulação", cmd: ["supabase", "db", "push", "--db-url", "<DB_URL>", "--dry-run"] },
  { step: "aplicar migrations pendentes", cmd: ["supabase", "db", "push", "--db-url", "<DB_URL>"] },
  { step: "estado depois + pós-deploy", kind: "read-only-sql" },
];

const FORBIDDEN = /\b(reset|seed|config|link|linked|e2e|playwright|test|repair|squash|dump|restore|delete|drop|truncate|--include-seed|--include-roles|--include-all)\b/i;

/** Garante que o plano só aplica migrations versionadas, pelo URL explícito. */
export function validatePlan(plan = PLAN) {
  const problems = [];
  for (const p of plan) {
    if (p.kind === "read-only-sql") continue;
    if (!p.cmd) {
      problems.push(`passo sem comando: ${p.step}`);
      continue;
    }
    const [a, b, c, d, e, ...rest] = p.cmd;
    if (`${a} ${b} ${c} ${d} ${e}` !== "supabase db push --db-url <DB_URL>") problems.push(`comando não permitido: ${p.cmd.join(" ")}`);
    if (rest.some((x) => x !== "--dry-run")) problems.push(`flag não permitida: ${rest.join(" ")}`);
    for (const token of p.cmd) if (FORBIDDEN.test(token)) problems.push(`termo proibido "${token}" em: ${p.step}`);
  }
  return problems;
}

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

export function gitState(root) {
  const branch = git(root, "rev-parse", "--abbrev-ref", "HEAD");
  const head = git(root, "rev-parse", "HEAD");
  const dirty = git(root, "status", "--porcelain");
  const remoteMain = git(root, "ls-remote", "origin", "refs/heads/main").split(/\s+/)[0] ?? "";
  const slug = git(root, "remote", "get-url", "origin").match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1] ?? "";
  return { branch, head, dirty, remoteMain, slug };
}

/** Situação dos checks obrigatórios no commit (API pública do GitHub). */
export async function ciState(slug, sha, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com/repos/${slug}/commits/${sha}/check-runs?per_page=100`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
  const runs = (await res.json()).check_runs ?? [];
  return REQUIRED_CHECKS.map((name) => {
    const r = runs.filter((x) => x.name === name).sort((x, y) => String(y.completed_at).localeCompare(String(x.completed_at)))[0];
    return { name, ok: r?.status === "completed" && r?.conclusion === "success", state: r ? `${r.status}/${r.conclusion}` : "não encontrado" };
  });
}

/** Migrations já registradas no banco de produção (vazio se o projeto é novo). */
export async function remoteVersions(target) {
  const db = await openReadOnly(target.dbUrl, target.ssl);
  try {
    const [[exists]] = await db.query(`select (to_regclass('supabase_migrations.schema_migrations') is not null)::text`);
    if (exists !== "true") return [];
    return (await db.query(`select version from supabase_migrations.schema_migrations order by version`)).map((r) => r[0]);
  } finally {
    await db.close();
  }
}

/**
 * Executa o pre-flight completo. Devolve { ok, checks, target, pending }.
 * `deps` permite testar sem rede.
 */
export async function runPreflight({ root = process.cwd(), argv = process.argv, env = process.env, deps = {} } = {}) {
  const checks = [];
  const add = (ok, msg) => checks.push({ ok, msg });

  // 1. Alvo: produção explícita, ref esperado, URL do banco do mesmo projeto, separado do dev.
  let target;
  try {
    target = assertProdTarget({ argv, env, root });
    add(true, `alvo de produção explícito: ${maskRef(target.ref)} (conexão ${target.dbMode}, SSL verificado)`);
  } catch (err) {
    add(false, err.message);
    return { ok: false, checks };
  }

  // 2. Migrations: exatamente as validadas, sem seed.
  const { files, problems } = checkManifest(root);
  add(files.length === EXPECTED_MIGRATIONS, `${files.length} migrations (esperado ${EXPECTED_MIGRATIONS})`);
  add(problems.length === 0, problems.length ? `manifesto: ${problems.join("; ")}` : "migrations idênticas ao manifesto validado (nome, ordem e hash)");
  const seed = scanForSeedData(files);
  add(seed.length === 0, seed.length ? `seed/demo nas migrations: ${seed.join("; ")}` : "nenhum dado de seed/demo nas migrations");
  add(existsSync(resolve(root, "supabase/schema-fingerprint.json")), "impressão digital de referência versionada (supabase/schema-fingerprint.json)");

  // 3. Git: main, limpo, igual ao GitHub.
  const g = (deps.gitState ?? gitState)(root);
  add(g.branch === "main", `branch: ${g.branch} (exigido: main)`);
  add(g.dirty === "", g.dirty ? `working tree com alterações:\n${g.dirty}` : "working tree limpa");
  add(g.head === g.remoteMain, g.head === g.remoteMain ? `HEAD ${g.head.slice(0, 7)} = origin/main` : `HEAD ${g.head.slice(0, 7)} ≠ origin/main ${g.remoteMain.slice(0, 7)}`);

  // 4. CI verde no commit alvo.
  try {
    const ci = await (deps.ciState ?? ciState)(g.slug, g.head);
    for (const c of ci) add(c.ok, `CI "${c.name}": ${c.state}`);
  } catch (err) {
    add(false, `não foi possível confirmar o CI: ${err.message}`);
  }

  // 5. Plano: só db push das migrations versionadas.
  const planProblems = validatePlan(deps.plan ?? PLAN);
  add(planProblems.length === 0, planProblems.length ? `plano inválido: ${planProblems.join("; ")}` : "plano: só `supabase db push --db-url` (sem link, reset, seed, config push, E2E)");

  // 6. Estado do banco: só pode faltar um sufixo das migrations versionadas.
  let pending = [];
  try {
    const remote = await (deps.remoteVersions ?? remoteVersions)(target);
    const local = files.map((f) => f.version);
    const unknown = remote.filter((v) => !local.includes(v));
    const prefixOk = remote.every((v, i) => v === local[i]);
    pending = files.slice(remote.length).map((f) => f.name);
    add(unknown.length === 0, unknown.length ? `produção tem migrations desconhecidas: ${unknown.join(", ")}` : "produção não tem migrations fora do repositório");
    add(prefixOk, prefixOk ? `produção: ${remote.length} registradas; pendentes: ${pending.length}` : "ordem das migrations em produção difere do repositório");
    add(pending.length > 0, pending.length ? `operação planejada: aplicar ${pending.length} migration(s) pendente(s)` : "nada pendente: não há o que aplicar");
  } catch (err) {
    add(false, `não foi possível ler o estado de produção (somente leitura): ${err.message}`);
  }

  return { ok: checks.every((c) => c.ok), checks, target, pending };
}

export function printChecks(title, checks) {
  console.log(`\n${title}`);
  for (const c of checks) console.log(`  ${c.ok ? "✅" : "❌"} ${c.msg}`);
}

// Execução direta: só o pre-flight (nenhuma escrita em lugar nenhum).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await runPreflight();
  printChecks("PRE-FLIGHT — deploy de schema no mel-prod", r.checks);
  console.log(r.ok ? "\nPre-flight OK. Nada foi aplicado." : "\nABORTAR: pre-flight reprovado.");
  process.exit(r.ok ? 0 : 1);
}
