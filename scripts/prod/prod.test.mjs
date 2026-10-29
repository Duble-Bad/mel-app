// Testes do procedimento de produção — sem rede, sem banco, refs fictícios.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { compareFingerprint, fingerprint } from "../schema-audit/catalog.mjs";
import { inspectPlatformFunctions } from "./postdeploy-check.mjs";
import { PLAN, runPreflight, validatePlan } from "./preflight.mjs";
import { assertInteractive, assertProdTarget, parseProdDbUrl, ProdTargetError } from "./prod-target.mjs";

const PROD = "pppppppppppppppppppp";
const DEV = "dddddddddddddddddddd";
const root = resolve(import.meta.dirname, "../..");

function sandbox({ linked = DEV, envLocalRef = DEV } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "mel-prod-"));
  mkdirSync(join(dir, "supabase/.temp"), { recursive: true });
  writeFileSync(join(dir, "supabase/.temp/project-ref"), `${linked}\n`);
  writeFileSync(join(dir, ".env.local"), `NEXT_PUBLIC_SUPABASE_URL=https://${envLocalRef}.supabase.co\n`);
  writeFileSync(join(dir, "ca.pem"), "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n");
  return dir;
}
const goodEnv = (dir, over = {}) => ({
  MEL_PROD_PROJECT_REF: PROD,
  MEL_PROD_DB_URL: `postgresql://postgres:senha-ficticia@db.${PROD}.supabase.co:5432/postgres`,
  MEL_PROD_DB_CA_FILE: join(dir, "ca.pem"),
  MEL_SAFE_TARGET_REFS: DEV,
  ...over,
});
const goodArgv = ["node", "deploy", "--production", `--expect-ref=${PROD}`];

test("parseProdDbUrl: only Supabase hosts where the ref decides the destination", () => {
  assert.deepEqual(parseProdDbUrl(`postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres`), { ref: PROD, mode: "direto" });
  assert.deepEqual(parseProdDbUrl(`postgresql://postgres.${PROD}:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`), { ref: PROD, mode: "pooler" });
  for (const bad of [
    undefined,
    "not a url",
    `https://${PROD}.supabase.co`,
    `postgresql://postgres@db.${PROD}.supabase.co:5432/postgres`, // sem senha
    `postgresql://postgres:x@db.${PROD}.supabase.co.evil.example:5432/postgres`,
    `postgresql://postgres:x@127.0.0.1:54322/postgres`,
    `postgresql://postgres.${PROD}:x@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`, // modo transação
  ]) {
    assert.throws(() => parseProdDbUrl(bad), ProdTargetError, String(bad));
  }
});

test("assertProdTarget accepts only when every condition holds", () => {
  const dir = sandbox();
  const t = assertProdTarget({ argv: goodArgv, env: goodEnv(dir), root: dir });
  assert.equal(t.ref, PROD);
  assert.equal(t.ssl.rejectUnauthorized, true);
});

test("assertProdTarget aborts on each missing or conflicting condition", () => {
  const dir = sandbox();
  const cases = {
    "sem --production": [["node", "x", `--expect-ref=${PROD}`], goodEnv(dir)],
    "sem --expect-ref": [["node", "x", "--production"], goodEnv(dir)],
    "refs diferentes": [goodArgv, goodEnv(dir, { MEL_PROD_PROJECT_REF: DEV })],
    "URL de outro projeto": [goodArgv, goodEnv(dir, { MEL_PROD_DB_URL: `postgresql://postgres:x@db.${DEV}.supabase.co:5432/postgres` })],
    "prod na lista de dev": [goodArgv, goodEnv(dir, { MEL_SAFE_TARGET_REFS: `${DEV},${PROD}` })],
    "sem certificado": [goodArgv, goodEnv(dir, { MEL_PROD_DB_CA_FILE: "" })],
    "em CI": [goodArgv, goodEnv(dir, { CI: "true" })],
    "GitHub Actions": [goodArgv, goodEnv(dir, { GITHUB_ACTIONS: "true" })],
    "terminal apontando para prod": [goodArgv, goodEnv(dir, { NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` })],
    "NODE_ENV não substitui nada": [["node", "x"], { NODE_ENV: "production" }],
  };
  for (const [name, [argv, env]] of Object.entries(cases)) {
    assert.throws(() => assertProdTarget({ argv, env, root: dir }), ProdTargetError, name);
  }
  assert.throws(() => assertProdTarget({ argv: goodArgv, env: goodEnv(sandbox({ linked: PROD })), root: sandbox({ linked: PROD }) }), /supabase link/);
  const envProd = sandbox({ envLocalRef: PROD });
  assert.throws(() => assertProdTarget({ argv: goodArgv, env: goodEnv(envProd), root: envProd }), /\.env\.local/);
});

test("the error never prints the full production ref", () => {
  const dir = sandbox();
  assert.throws(
    () => assertProdTarget({ argv: goodArgv, env: goodEnv(dir, { MEL_PROD_DB_URL: `postgresql://postgres:x@db.${DEV}.supabase.co:5432/postgres` }), root: dir }),
    (err) => !err.message.includes(PROD) && !err.message.includes(DEV),
  );
});

test("the only plan is `supabase db push --db-url` (+ --dry-run)", () => {
  assert.deepEqual(validatePlan(PLAN), []);
  const bad = (cmd) => validatePlan([{ step: "x", cmd }]);
  assert.notDeepEqual(bad(["supabase", "db", "reset", "--db-url", "<DB_URL>"]), []);
  assert.notDeepEqual(bad(["supabase", "db", "push", "--db-url", "<DB_URL>", "--include-seed"]), []);
  assert.notDeepEqual(bad(["supabase", "db", "push", "--db-url", "<DB_URL>", "--include-all"]), []);
  assert.notDeepEqual(bad(["supabase", "db", "push", "--linked"]), []);
  assert.notDeepEqual(bad(["supabase", "config", "push"]), []);
  assert.notDeepEqual(bad(["supabase", "link", "--project-ref", "x"]), []);
  assert.notDeepEqual(bad(["npx", "playwright", "test"]), []);
  assert.notDeepEqual(bad(["node", "scripts/seed-demo.mjs"]), []);
});

test("assertInteractive refuses non-TTY execution", () => {
  assert.throws(() => assertInteractive({ isTTY: false }, { isTTY: true }), ProdTargetError);
  assert.throws(() => assertInteractive({ isTTY: true }, { isTTY: undefined }), ProdTargetError);
  assertInteractive({ isTTY: true }, { isTTY: true });
});

test("deploy script refuses to run without a terminal, before touching anything", () => {
  const dir = sandbox();
  const r = spawnSync(process.execPath, [join(root, "scripts/prod/deploy-schema.mjs"), ...goodArgv.slice(2)], {
    cwd: dir,
    env: { ...process.env, ...goodEnv(dir), CI: "", GITHUB_ACTIONS: "" },
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /terminal interativo/);
});

test("preflight aborts on git, CI, plan or production-state problems (no network)", async () => {
  const dir = sandbox();
  const okDeps = {
    gitState: () => ({ branch: "main", head: "a".repeat(40), dirty: "", remoteMain: "a".repeat(40), slug: "x/y" }),
    ciState: async () => [{ name: "CI", ok: true, state: "completed/success" }],
    remoteVersions: async () => [],
  };
  const run = (deps, env = goodEnv(dir)) => runPreflight({ root, argv: goodArgv, env: { ...env, MEL_PROD_DB_CA_FILE: join(dir, "ca.pem") }, deps: { ...okDeps, ...deps } });
  const fails = (r) => r.checks.filter((c) => !c.ok).map((c) => c.msg).join(" | ");

  const ok = await run({});
  assert.equal(ok.ok, true, fails(ok));
  assert.equal(ok.pending.length, 23);

  assert.match(fails(await run({ gitState: () => ({ ...okDeps.gitState(), dirty: " M x" }) })), /working tree/);
  assert.match(fails(await run({ gitState: () => ({ ...okDeps.gitState(), branch: "dev" }) })), /branch/);
  assert.match(fails(await run({ gitState: () => ({ ...okDeps.gitState(), remoteMain: "b".repeat(40) }) })), /origin\/main/);
  assert.match(fails(await run({ ciState: async () => [{ name: "CI", ok: false, state: "completed/failure" }] })), /CI/);
  assert.match(fails(await run({ plan: [{ step: "x", cmd: ["supabase", "config", "push"] }] })), /plano inválido/);
  assert.match(fails(await run({ remoteVersions: async () => ["99999999999999"] })), /desconhecidas/);
  const nothing = await run({ remoteVersions: async () => (await import("../schema-audit/catalog.mjs")).migrationFiles(root).map((f) => f.version) });
  assert.match(fails(nothing), /nada pendente/);
});

test("platform functions are accepted only when every observed property equals the reviewed one", async () => {
  const NAME = "public.rls_auto_enable";
  // Catálogo simulado: responde a cada consulta da inspeção.
  const catalog = (over = {}) => {
    const f = { args: "", returns: "event_trigger", owner: "postgres", secdef: "true", config: "search_path=pg_catalog", acl: "{postgres=X/postgres}", anon: "false", md5: "abc", evt: [["ensure_rls", "ddl_command_end", "CREATE TABLE", "O", "postgres"]], callable: false, ...over };
    const calls = [];
    const q = async (sql) => {
      calls.push(sql);
      if (sql.includes("from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language"))
        return f.absent ? [] : [["1", f.args, f.returns, "plpgsql", f.owner, "false", f.secdef, f.config, f.acl, f.anon, "true", "true", f.md5, "CREATE FUNCTION ..."]];
      if (sql.includes("where evtfoid=")) return f.evt;
      if (sql.includes("pg_has_role")) return [["true"]];
      if (sql.startsWith(`select ${NAME}()`)) {
        if (f.callable) return [[""]];
        throw Object.assign(new Error("trigger functions can only be called as triggers"), { code: "0A000" });
      }
      return [];
    };
    return { q, calls };
  };
  const reviewed = async () => {
    const { q } = catalog({ callable: false });
    const r = await inspectPlatformFunctions(q, { [NAME]: { expected: null } });
    return JSON.parse(r.details.join("\n").match(/```json\n([\s\S]*?)\n```/)[1]);
  };
  const expected = await reviewed();
  const inspect = (over) => inspectPlatformFunctions(catalog(over).q, { [NAME]: { expected } });

  assert.deepEqual((await inspect({ absent: true })).present, []); // ausente (banco reconstruído, mel-dev): nada a fazer
  const ok = await inspect({});
  assert.deepEqual(ok.present, [NAME]);
  assert.equal(ok.results.every((r) => r.ok), true, ok.results.map((r) => r.msg).join(" | "));
  // A sondagem como anon roda num savepoint que é sempre desfeito.
  const { q, calls } = catalog({});
  await inspectPlatformFunctions(q, { [NAME]: { expected } });
  assert.deepEqual(calls.filter((c) => /savepoint|set local role/.test(c)), ["savepoint mel_probe", "set local role anon", "rollback to savepoint mel_probe"]);

  for (const [why, over, spec] of [
    ["ainda não revisada", {}, { expected: null }],
    ["definição alterada", { md5: "zzz" }],
    ["outro owner", { owner: "supabase_admin" }],
    ["grant novo para anon", { anon: "true", acl: "{=X/postgres}" }],
    ["event trigger diferente", { evt: [["ensure_rls", "ddl_command_end", "(todas)", "O", "postgres"]] }],
    ["event trigger desabilitado", { evt: [["ensure_rls", "ddl_command_end", "CREATE TABLE", "D", "postgres"]] }],
    ["sem event trigger", { evt: [] }],
    ["retorna outro tipo", { returns: "void" }],
    ["com argumentos", { args: "x text" }],
    ["definer sem search_path", { config: "" }],
    ["chamável como anon", { callable: true }],
  ]) {
    const r = await inspectPlatformFunctions(catalog(over).q, { [NAME]: spec ?? { expected } });
    assert.equal(r.results.some((x) => !x.ok), true, why);
  }
});

test("fingerprint ignores only the listed platform function, nothing else", async () => {
  const fns = (extra) => async (sql) =>
    sql.includes("pg_get_functiondef") || sql.includes("has_function_privilege")
      ? [["public.a(x text):h"], ...extra.map((l) => [l])]
      : [["outro"]];
  const base = await fingerprint(fns([]));
  const withPlatform = await fingerprint(fns(["public.rls_auto_enable():h"]), { ignoreFunctions: ["public.rls_auto_enable"] });
  assert.deepEqual(compareFingerprint(withPlatform, base), []);
  // Sem a exclusão, ou com outro objeto a mais, continua sendo drift.
  assert.notDeepEqual(compareFingerprint(await fingerprint(fns(["public.rls_auto_enable():h"])), base), []);
  const other = await fingerprint(fns(["public.rls_auto_enable():h", "public.rls_auto_enable_x():h"]), { ignoreFunctions: ["public.rls_auto_enable"] });
  assert.notDeepEqual(compareFingerprint(other, base), []);
});

test("deploy never runs commands through a shell (the DB URL carries the password)", () => {
  const src = readFileSync(join(root, "scripts/prod/deploy-schema.mjs"), "utf8").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /shell\s*:/);
  assert.doesNotMatch(src, /["']npx["']/);
  assert.match(src, /execFileSync\(process\.execPath, \[SUPABASE_CLI/);
});
