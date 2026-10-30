// Leitura do schema da MEL: o que as migrations declaram × o que o catálogo do
// Postgres tem. Usado pela auditoria do banco reconstruído (local) e pelo
// pós-deploy de produção. SOMENTE LEITURA: só faz SELECT no catálogo.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
/** Conteúdo com fim de linha normalizado (Windows/CRLF × Linux/LF dão o mesmo hash). */
const normalized = (s) => s.replace(/\r\n/g, "\n");

// ---------------------------------------------------------------- migrations

export function migrationFiles(root) {
  const dir = resolve(root, "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => {
      const content = normalized(readFileSync(resolve(dir, name), "utf8"));
      return { name, version: name.split("_")[0], content, sha256: sha256(content) };
    });
}

/** Manifesto versionado: nome + hash de cada migration validada. */
export function readManifest(root) {
  return JSON.parse(readFileSync(resolve(root, "supabase/migrations.manifest.json"), "utf8"));
}

/** Arquivos em disco = manifesto (mesma lista, mesma ordem, mesmo conteúdo). */
export function checkManifest(root) {
  const files = migrationFiles(root);
  const manifest = readManifest(root);
  const problems = [];
  if (files.length !== manifest.migrations.length) problems.push(`${files.length} arquivos × ${manifest.migrations.length} no manifesto`);
  manifest.migrations.forEach((m, i) => {
    const f = files[i];
    if (!f || f.name !== m.file) problems.push(`posição ${i + 1}: esperado ${m.file}, encontrado ${f?.name ?? "nada"}`);
    else if (f.sha256 !== m.sha256) problems.push(`${m.file}: conteúdo diferente do validado (hash mudou)`);
  });
  for (const f of files.slice(manifest.migrations.length)) problems.push(`migration fora do manifesto: ${f.name}`);
  return { files, manifest, problems };
}

/**
 * Procura dados de seed/demo nas migrations. Corpo de função ($$…$$) é código,
 * não dado: é ignorado. INSERT de topo só é aceito nas tabelas de referência.
 */
export function scanForSeedData(files) {
  const ALLOWED_INSERTS = new Set(["storage.buckets", "public.plans"]);
  const problems = [];
  for (const f of files) {
    const code = f.content.replace(/--[^\n]*/g, "").replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''");
    for (const m of code.matchAll(/\binsert\s+into\s+([\w."]+)/gi)) {
      const table = m[1].replace(/"/g, "").toLowerCase();
      if (!ALLOWED_INSERTS.has(table)) problems.push(`${f.name}: INSERT de dados em ${table}`);
    }
    if (/\b(copy|truncate)\s+[\w."]+/i.test(code)) problems.push(`${f.name}: COPY/TRUNCATE`);
    if (/@exemplo\.com|\bdemo\b|\bseed\b/i.test(code)) problems.push(`${f.name}: termo de dados fictícios (exemplo.com/demo/seed)`);
  }
  return problems;
}

function declared(sql, createRe, dropRe, key) {
  const events = [
    ...[...sql.matchAll(createRe)].map((m) => ({ i: m.index, k: key(m), op: "+" })),
    ...[...sql.matchAll(dropRe)].map((m) => ({ i: m.index, k: key(m), op: "-" })),
  ].sort((a, b) => a.i - b.i);
  const set = new Set();
  for (const e of events) (e.op === "+" ? set.add(e.k) : set.delete(e.k));
  return set;
}

/** O que as migrations declaram, por tipo de objeto. */
export function expectedFromMigrations(files) {
  const sql = files.map((f) => f.content).join("\n").replace(/--[^\n]*/g, "");
  const strip = (s) => s.replace(/"/g, "");
  return {
    tables: declared(sql, /create table (?:if not exists )?public\.(\w+)/gi, /drop table (?:if exists )?public\.(\w+)/gi, (m) => m[1]),
    enums: declared(sql, /create type public\.(\w+)/gi, /drop type (?:if exists )?public\.(\w+)/gi, (m) => m[1]),
    functions: declared(sql, /create (?:or replace )?function ((?:public|private)\.\w+)/gi, /drop function (?:if exists )?((?:public|private)\.\w+)/gi, (m) => m[1]),
    triggers: declared(
      sql,
      /create (?:or replace )?trigger (\w+)\s+(?:before|after|instead of)[\s\S]*?\son ([\w.]+)/gi,
      /drop trigger (?:if exists )?(\w+) on ([\w.]+)/gi,
      (m) => `${m[2].includes(".") ? m[2] : `public.${m[2]}`}:${m[1]}`,
    ),
    policies: declared(
      sql,
      /create policy ("[^"]+"|\w+)\s+on ([\w.]+)/gi,
      /drop policy (?:if exists )?("[^"]+"|\w+)\s+on ([\w.]+)/gi,
      (m) => `${m[2].replace(/^public\./, "")}:${strip(m[1])}`,
    ),
    indexes: declared(sql, /create (?:unique )?index (?:if not exists )?(\w+)/gi, /drop index (?:if exists )?(?:public\.)?(\w+)/gi, (m) => m[1]),
    publication: declared(sql, /alter publication supabase_realtime add table ([\w.]+)/gi, /alter publication supabase_realtime drop table ([\w.]+)/gi, (m) => m[1]),
  };
}

export const EXPECTED_BUCKETS = [
  ["avatars", "true", String(2 * 1024 * 1024), "image/webp,image/jpeg,image/png"],
  ["pet-photos", "true", String(5 * 1024 * 1024), "image/webp,image/jpeg,image/png"],
  ["sighting-media", "true", String(2 * 1024 * 1024), "image/webp,image/jpeg,image/png"],
];

// ------------------------------------------------------------------- catálogo

/**
 * Abre uma conexão SOMENTE LEITURA. `ssl`: undefined (local, sem TLS) ou
 * objeto de TLS (produção). Toda consulta roda numa transação READ ONLY.
 */
export async function openReadOnly(connectionString, ssl) {
  const client = new pg.Client({ connectionString, ssl, application_name: "mel-schema-audit" });
  await client.connect();
  await client.query("begin transaction read only");
  return {
    query: async (text) => (await client.query({ text, rowMode: "array" })).rows.map((r) => r.map((v) => (v === null ? "" : String(v)))),
    close: async () => {
      await client.query("rollback").catch(() => {});
      await client.end();
    },
  };
}

const set = (rows) => new Set(rows.map((r) => r[0]));

/** Objetos do catálogo nos mesmos formatos de `expectedFromMigrations`. */
export async function collectActual(q) {
  return {
    tables: set(await q(`select tablename from pg_tables where schemaname='public'`)),
    enums: set(await q(`select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'`)),
    functions: set(
      await q(
        `select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`,
      ),
    ),
    triggers: set(
      await q(
        `select n.nspname||'.'||c.relname||':'||t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and t.tgname like 'on_auth_%'))`,
      ),
    ),
    policies: set(
      await q(`select case when schemaname='public' then tablename else schemaname||'.'||tablename end||':'||policyname from pg_policies where schemaname in ('public','storage')`),
    ),
    indexes: set(await q(`select indexname from pg_indexes where schemaname='public' and indexname not in (select conname from pg_constraint)`)),
    publication: set(await q(`select schemaname||'.'||tablename from pg_publication_tables where pubname='supabase_realtime'`)),
  };
}

/**
 * Impressão digital do schema por categoria: hash da definição COMPLETA de cada
 * objeto (não só do nome). Mesmo resultado em qualquer banco com o mesmo schema.
 */
export async function fingerprint(q, { ignoreFunctions = [] } = {}) {
  const parts = {
    columns: `select table_name||'.'||column_name||':'||data_type||':'||udt_name||':'||is_nullable||':'||coalesce(column_default,'')||':'||is_generated||':'||coalesce(generation_expression,'') from information_schema.columns where table_schema='public' and table_name in (select tablename from pg_tables where schemaname='public')`,
    constraints: `select c.conrelid::regclass::text||':'||c.conname||':'||pg_get_constraintdef(c.oid) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'`,
    indexes: `select indexdef from pg_indexes where schemaname='public'`,
    enums: `select t.typname||':'||string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname`,
    functions: `select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||md5(pg_get_functiondef(p.oid))||':'||p.prosecdef::text||':'||coalesce(array_to_string(p.proconfig,';'),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`,
    function_grants: `select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||r.rolname||':'||has_function_privilege(r.oid, p.oid, 'execute')::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r where r.rolname in ('anon','authenticated','service_role') and n.nspname in ('public','private') and p.prokind='f' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`,
    triggers: `select pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and t.tgname like 'on_auth_%'))`,
    policies: `select schemaname||'.'||tablename||':'||policyname||':'||permissive||':'||array_to_string(roles,',')||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies where schemaname in ('public','storage') and (schemaname='public' or tablename='objects')`,
    rls: `select c.relname||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`,
    table_grants: `select grantee||':'||table_name||':'||privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')`,
    schema_grants: `select s||':'||r||':'||has_schema_privilege(r, s, 'usage')::text from unnest(array['public','private']) s cross join unnest(array['anon','authenticated','service_role']) r`,
    buckets: `select id||':'||public::text||':'||coalesce(file_size_limit::text,'')||':'||coalesce(array_to_string(allowed_mime_types, ','),'') from storage.buckets`,
    publication: `select schemaname||'.'||tablename from pg_publication_tables where pubname='supabase_realtime'`,
  };
  const out = {};
  for (const [name, sql] of Object.entries(parts)) {
    // Objetos da plataforma já verificados à parte (pós-deploy) saem da comparação.
    const ignored = name === "functions" || name === "function_grants" ? ignoreFunctions.map((f) => `${f}(`) : [];
    const lines = (await q(sql))
      .map((r) => r[0])
      .filter((l) => !ignored.some((p) => l.startsWith(p)))
      .sort();
    out[name] = { count: lines.length, sha256: sha256(lines.join("\n")) };
  }
  return out;
}

/** Inventário e todas as verificações de estrutura (as mesmas em local e produção). */
export async function audit(q, files, { exposedSchemas, ignoreFunctions = [] }) {
  const expect = expectedFromMigrations(files);
  const actual = await collectActual(q);
  for (const f of ignoreFunctions) actual.functions.delete(f);
  const results = [];
  const pass = (msg) => results.push({ ok: true, msg });
  const fail = (msg) => results.push({ ok: false, msg });

  for (const kind of Object.keys(expect)) {
    const missing = [...expect[kind]].filter((x) => !actual[kind].has(x));
    const extra = [...actual[kind]].filter((x) => !expect[kind].has(x));
    if (missing.length || extra.length) fail(`${kind}: esperado ${expect[kind].size}, banco ${actual[kind].size}. Faltando: ${missing.join(", ") || "-"}. Sobrando: ${extra.join(", ") || "-"}`);
    else pass(`${kind}: ${actual[kind].size} (idênticos às migrations)`);
  }

  const applied = (await q(`select version from supabase_migrations.schema_migrations order by version`)).map((r) => r[0]);
  const versions = files.map((f) => f.version);
  JSON.stringify(applied) === JSON.stringify(versions)
    ? pass(`migrations: ${applied.length}/${files.length} registradas, na ordem dos arquivos`)
    : fail(`migrations: registradas [${applied.join(",")}] ≠ arquivos [${versions.join(",")}]`);

  const noRls = await q(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
  noRls.length ? fail(`RLS desligado em: ${noRls.map((r) => r[0]).join(", ")}`) : pass(`RLS habilitado em todas as ${actual.tables.size} tabelas public`);

  const noPk = await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not exists (select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='p')`);
  noPk.length ? fail(`tabelas sem primary key: ${noPk.map((r) => r[0]).join(", ")}`) : pass(`primary key em todas as ${actual.tables.size} tabelas`);

  const noPolicy = (await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname) order by 1`)).map((r) => r[0]);
  JSON.stringify(noPolicy) === JSON.stringify(["case_matches", "push_outbox"])
    ? pass("tabelas sem política (acesso só por funções/servidor): case_matches, push_outbox — como previsto")
    : fail(`tabelas sem política diferentes do previsto: ${noPolicy.join(", ") || "nenhuma"}`);

  const unsafeDefiner = await q(`select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')`);
  unsafeDefiner.length ? fail(`SECURITY DEFINER sem search_path: ${unsafeDefiner.map((r) => r[0]).join(", ")}`) : pass("toda função SECURITY DEFINER tem search_path fixo");

  const anonDefiner = (await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') order by 1`)).map((r) => r[0]);
  pass(`funções SECURITY DEFINER executáveis por anon (${anonDefiner.length}): ${anonDefiner.join(", ")}`);

  const [[anonPrivate]] = await q(`select has_schema_privilege('anon','private','usage')::text`);
  anonPrivate === "true" ? fail("anon tem USAGE no schema private") : pass("anon sem acesso ao schema private");
  if (exposedSchemas !== undefined) {
    exposedSchemas.includes("private")
      ? fail(`schema private exposto pela API (${exposedSchemas.join(", ")})`)
      : pass(`schema private fora da API (expostos: ${exposedSchemas.join(", ")}); authenticated tem USAGE só para as políticas RLS`);
  }

  const anonWrite = (await q(`select distinct table_name from information_schema.role_table_grants where grantee='anon' and table_schema='public' and privilege_type in ('INSERT','UPDATE','DELETE')`)).map((r) => r[0]);
  anonWrite.length ? fail(`anon com grant de escrita em: ${anonWrite.join(", ")}`) : pass("nenhum grant de escrita para anon em tabelas public");

  const buckets = await q(`select id, public::text, file_size_limit::text, array_to_string(allowed_mime_types, ',') from storage.buckets order by id`);
  JSON.stringify(buckets) === JSON.stringify(EXPECTED_BUCKETS)
    ? pass(`buckets: ${buckets.map((b) => `${b[0]} (público, ${Number(b[2]) / 1048576} MB, webp/jpeg/png)`).join("; ")}`)
    : fail(`buckets diferentes do esperado: ${JSON.stringify(buckets)}`);

  const storagePolicies = [...actual.policies].filter((p) => p.startsWith("storage.objects:")).sort();
  pass(`políticas de Storage (${storagePolicies.length}): ${storagePolicies.map((p) => p.split(":")[1]).join("; ")}`);

  const count = async (sql) => Number((await q(sql))[0][0]);
  const inventory = {
    migrations: `${applied.length}/${files.length}`,
    tabelas: actual.tables.size,
    colunas: await count(`select count(*) from information_schema.columns where table_schema='public' and table_name in (select tablename from pg_tables where schemaname='public')`),
    primary_keys: await count(`select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='p'`),
    foreign_keys: await count(`select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'`),
    checks: await count(`select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='c'`),
    uniques: await count(`select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='u'`),
    indices_total: await count(`select count(*) from pg_indexes where schemaname='public'`),
    indices_declarados: actual.indexes.size,
    enums: actual.enums.size,
    funcoes_public: [...actual.functions].filter((f) => f.startsWith("public.")).length,
    funcoes_private: [...actual.functions].filter((f) => f.startsWith("private.")).length,
    triggers: actual.triggers.size,
    triggers_auth_users: [...actual.triggers].filter((t) => t.startsWith("auth.users:")).sort().join(", "),
    politicas_public: [...actual.policies].filter((p) => !p.startsWith("storage.")).length,
    politicas_storage: storagePolicies.length,
    grants_tabelas: await count(`select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')`),
    grants_funcoes: await count(`select count(*) from information_schema.routine_privileges where specific_schema in ('public','private') and grantee in ('anon','authenticated','service_role')`),
    publication: [...actual.publication].sort().join(", "),
  };
  return { inventory, results };
}

/** Compara a impressão digital com a versionada (gerada do banco reconstruído). */
export function compareFingerprint(actual, expected) {
  const diffs = [];
  for (const k of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const a = actual[k];
    const e = expected[k];
    if (!a || !e) diffs.push(`${k}: ausente em ${a ? "esperado" : "banco"}`);
    else if (a.sha256 !== e.sha256) diffs.push(`${k}: definição diferente (banco ${a.count} itens, esperado ${e.count})`);
  }
  return diffs;
}

export function report(title, inventory, results, extra = []) {
  const failed = results.filter((r) => !r.ok);
  return [
    `# ${title}`,
    "",
    "```json",
    JSON.stringify(inventory, null, 2),
    "```",
    "",
    ...results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.msg}`),
    ...extra,
    "",
    failed.length ? `**${failed.length} verificação(ões) falharam.**` : "**Todas as verificações passaram.**",
  ].join("\n");
}
