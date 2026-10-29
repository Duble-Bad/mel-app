// Auditoria do banco RECONSTRUÍDO a partir das migrations (Supabase local).
// Extrai das migrations o que deveria existir e compara, objeto a objeto, com
// o catálogo do Postgres. Só roda contra banco local (trava abaixo).
// Uso: DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/schema-audit/audit.mjs
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const dbUrl = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const host = new URL(dbUrl).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(`[trava] auditoria só roda contra banco local (host recebido: ${host}).`);
  process.exit(2);
}

// ---------- o que as migrations declaram ----------
const dir = resolve(root, "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n").replace(/--[^\n]*/g, "");
const all = (re) => [...sql.matchAll(re)];
const norm = (s) => s.replace(/^public\./, "").replace(/"/g, "");

function declared(createRe, dropRe, key) {
  const set = new Set();
  // Mantém a ordem real: create e drop intercalados.
  const events = [...all(createRe).map((m) => ({ i: m.index, k: key(m), op: "+" })), ...all(dropRe).map((m) => ({ i: m.index, k: key(m), op: "-" }))].sort((a, b) => a.i - b.i);
  for (const e of events) (e.op === "+" ? set.add(e.k) : set.delete(e.k));
  return set;
}

const expect = {
  tables: declared(/create table (?:if not exists )?public\.(\w+)/gi, /drop table (?:if exists )?public\.(\w+)/gi, (m) => m[1]),
  enums: declared(/create type public\.(\w+)/gi, /drop type (?:if exists )?public\.(\w+)/gi, (m) => m[1]),
  functions: declared(/create (?:or replace )?function ((?:public|private)\.\w+)/gi, /drop function (?:if exists )?((?:public|private)\.\w+)/gi, (m) => m[1]),
  triggers: declared(
    /create (?:or replace )?trigger (\w+)\s+(?:before|after|instead of)[\s\S]*?\son ([\w.]+)/gi,
    /drop trigger (?:if exists )?(\w+) on ([\w.]+)/gi,
    (m) => `${m[2].includes(".") ? m[2] : `public.${m[2]}`}:${m[1]}`,
  ),
  policies: declared(
    /create policy ("[^"]+"|\w+)\s+on ([\w.]+)/gi,
    /drop policy (?:if exists )?("[^"]+"|\w+)\s+on ([\w.]+)/gi,
    (m) => `${m[2]}:${norm(m[1])}`,
  ),
  indexes: declared(/create (?:unique )?index (?:if not exists )?(\w+)/gi, /drop index (?:if exists )?(?:public\.)?(\w+)/gi, (m) => m[1]),
  publication: declared(/alter publication supabase_realtime add table ([\w.]+)/gi, /alter publication supabase_realtime drop table ([\w.]+)/gi, (m) => m[1]),
};

// ---------- o que o banco reconstruído tem ----------
function q(query) {
  const out = execFileSync("psql", [dbUrl, "-X", "-A", "-t", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" });
  return out.split("\n").filter(Boolean).map((l) => l.split("\t"));
}
const set = (rows) => new Set(rows.map((r) => r[0]));

const actual = {
  tables: set(q(`select tablename from pg_tables where schemaname='public'`)),
  enums: set(q(`select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'`)),
  functions: set(q(`select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`)),
  triggers: set(q(`select n.nspname||'.'||c.relname||':'||t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and t.tgname like 'on_auth_%'))`)),
  policies: set(q(`select case when schemaname='public' then tablename else schemaname||'.'||tablename end||':'||policyname from pg_policies where schemaname in ('public','storage')`)),
  indexes: set(q(`select indexname from pg_indexes where schemaname='public' and indexname not in (select conname from pg_constraint)`)),
  publication: set(q(`select schemaname||'.'||tablename from pg_publication_tables where pubname='supabase_realtime'`)),
};
// Políticas de public aparecem sem o prefixo do schema no catálogo.
expect.policies = new Set([...expect.policies].map((k) => k.replace(/^public\./, "")));

const results = [];
const fail = (msg) => results.push({ ok: false, msg });
const pass = (msg) => results.push({ ok: true, msg });

for (const kind of Object.keys(expect)) {
  const missing = [...expect[kind]].filter((x) => !actual[kind].has(x));
  const extra = [...actual[kind]].filter((x) => !expect[kind].has(x));
  if (missing.length || extra.length) fail(`${kind}: esperado ${expect[kind].size}, banco ${actual[kind].size}. Faltando: ${missing.join(", ") || "-"}. Sobrando: ${extra.join(", ") || "-"}`);
  else pass(`${kind}: ${actual[kind].size} (idênticos às migrations)`);
}

// Migrations aplicadas = arquivos, na ordem.
const applied = q(`select version from supabase_migrations.schema_migrations order by version`).map((r) => r[0]);
const fileVersions = files.map((f) => f.split("_")[0]);
if (JSON.stringify(applied) === JSON.stringify(fileVersions)) pass(`migrations: ${applied.length}/${files.length} aplicadas, na ordem dos arquivos`);
else fail(`migrations: aplicadas [${applied.join(",")}] ≠ arquivos [${fileVersions.join(",")}]`);

// RLS em todas as tabelas public.
const noRls = q(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
noRls.length ? fail(`RLS desligado em: ${noRls.map((r) => r[0]).join(", ")}`) : pass(`RLS habilitado em todas as ${actual.tables.size} tabelas public`);
const noPolicy = q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)`).map((r) => r[0]);
pass(`tabelas sem nenhuma política (acesso só por funções/servidor): ${noPolicy.join(", ") || "nenhuma"}`);

// SECURITY DEFINER sempre com search_path fixo.
const unsafeDefiner = q(`select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')`);
unsafeDefiner.length ? fail(`SECURITY DEFINER sem search_path: ${unsafeDefiner.map((r) => r[0]).join(", ")}`) : pass("toda função SECURITY DEFINER tem search_path fixo");

// Funções SECURITY DEFINER executáveis por anon (devem ser só as públicas de leitura/envio previstas).
const anonDefiner = q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') order by 1`).map((r) => r[0]);
pass(`funções SECURITY DEFINER que anon pode executar (${anonDefiner.length}): ${anonDefiner.join(", ")}`);
// private: anon sem acesso; authenticated tem USAGE de propósito (foundation.sql:
// as políticas RLS chamam os helpers private.* com o papel de quem consulta).
// O que impede o acesso pela API é o schema NÃO estar exposto (config "schemas").
const [anonPrivate] = q(`select has_schema_privilege('anon','private','usage')::text`)[0];
anonPrivate === "true" ? fail("anon tem USAGE no schema private") : pass("anon sem acesso ao schema private");
const exposed = readFileSync(resolve(root, "supabase/config.toml"), "utf8").match(/^schemas = \[(.*)\]/m)?.[1] ?? "";
exposed.includes("private") ? fail(`schema private exposto pela API (${exposed})`) : pass(`schema private fora da API (expostos: ${exposed}); authenticated tem USAGE só para as políticas RLS`);

// Grants: escrita direta de anon em tabelas public.
const anonWrite = q(`select table_name||':'||string_agg(privilege_type, '/' order by privilege_type) from information_schema.role_table_grants where grantee='anon' and table_schema='public' and privilege_type in ('INSERT','UPDATE','DELETE') group by table_name order by 1`).map((r) => r[0]);
pass(`grants de escrita para anon (RLS ainda decide): ${anonWrite.join(", ") || "nenhum"}`);

// Buckets: exatamente os 3, com os limites das migrations.
const buckets = q(`select id, public::text, file_size_limit::text, array_to_string(allowed_mime_types, ',') from storage.buckets order by id`);
const want = [
  ["avatars", "true", String(2 * 1024 * 1024), "image/webp,image/jpeg,image/png"],
  ["pet-photos", "true", String(5 * 1024 * 1024), "image/webp,image/jpeg,image/png"],
  ["sighting-media", "true", String(5 * 1024 * 1024), "image/webp,image/jpeg,image/png"],
];
JSON.stringify(buckets) === JSON.stringify(want) ? pass(`buckets: ${buckets.map((b) => `${b[0]} (público, ${Number(b[2]) / 1048576} MB, webp/jpeg/png)`).join("; ")}`) : fail(`buckets diferentes: ${JSON.stringify(buckets)}`);
const storagePolicies = [...actual.policies].filter((p) => p.startsWith("storage.objects:"));
pass(`políticas de Storage (${storagePolicies.length}): ${storagePolicies.map((p) => p.split(":")[1]).join("; ")}`);

// Inventário (para o relatório).
const [[cols]] = q(`select count(*) from information_schema.columns where table_schema='public' and table_name in (select tablename from pg_tables where schemaname='public')`);
const [[pks]] = q(`select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='p'`);
const [[fks]] = q(`select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'`);
const [[checks]] = q(`select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='c'`);
const [[uniques]] = q(`select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='u'`);
const [[allIdx]] = q(`select count(*) from pg_indexes where schemaname='public'`);
const [[grantsCount]] = q(`select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')`);
const [[fnGrants]] = q(`select count(*) from information_schema.routine_privileges where specific_schema in ('public','private') and grantee in ('anon','authenticated','service_role')`);
const tablesNoPk = q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not exists (select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='p')`);
tablesNoPk.length ? fail(`tabelas sem primary key: ${tablesNoPk.map((r) => r[0]).join(", ")}`) : pass(`primary key em todas as ${actual.tables.size} tabelas`);
const fn = (s) => [...actual.functions].filter((f) => f.startsWith(s)).length;
const inventory = {
  migrations: `${applied.length}/${files.length}`,
  tabelas: actual.tables.size,
  colunas: Number(cols),
  primary_keys: Number(pks),
  foreign_keys: Number(fks),
  checks: Number(checks),
  uniques: Number(uniques),
  indices_total: Number(allIdx),
  indices_declarados: actual.indexes.size,
  enums: actual.enums.size,
  funcoes_public: fn("public."),
  funcoes_private: fn("private."),
  triggers: actual.triggers.size,
  triggers_auth_users: [...actual.triggers].filter((t) => t.startsWith("auth.users:")).join(", "),
  politicas_public: [...actual.policies].filter((p) => !p.startsWith("storage.")).length,
  politicas_storage: storagePolicies.length,
  grants_tabelas: Number(grantsCount),
  grants_funcoes: Number(fnGrants),
  publication: [...actual.publication].join(", "),
};

const failed = results.filter((r) => !r.ok);
const report = [
  "# Auditoria do schema reconstruído",
  "",
  "```json",
  JSON.stringify(inventory, null, 2),
  "```",
  "",
  ...results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.msg}`),
  "",
  failed.length ? `**${failed.length} verificação(ões) falharam.**` : "**Todas as verificações passaram.**",
].join("\n");
writeFileSync(resolve(root, "schema-audit-report.md"), report);
console.log(report);
process.exit(failed.length ? 1 : 0);
