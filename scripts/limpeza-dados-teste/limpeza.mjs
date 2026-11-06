// Limpeza dos dados SINTÉTICOS de testes no Supabase de DESENVOLVIMENTO (autorizada pelo
// proprietário em 2026-11-06). Nunca roda fora do mel-dev.
//
//   node scripts/limpeza-dados-teste/limpeza.mjs selecionar   → só leitura: candidatos + evidências
//   node scripts/limpeza-dados-teste/limpeza.mjs backup       → transação DESFEITA: linhas exatas que sairiam → arquivo
//   node scripts/limpeza-dados-teste/limpeza.mjs ensaio       → transação DESFEITA: apaga, restaura do arquivo e compara
//   node scripts/limpeza-dados-teste/limpeza.mjs executar     → apaga (só se backup e ensaio passaram para a MESMA seleção)
//   node scripts/limpeza-dados-teste/limpeza.mjs restaurar <arquivo> → repõe, do backup, as linhas que não existirem mais
//
// Critério (todas as condições de um grupo; nada por título, local ou domínio isolados):
//   A) conta E2E: e-mail no formato exato de e2e/support/users.ts (e2e+<rótulo>-<8 hex>@exemplo.com)
//      E senha igual à senha fixa dos testes (conferida pelo hash no banco).
//   B) conta dos testes de banco: formato exato de packages/data/tests/helpers.ts
//      (test+<rótulo>-<8 hex>@exemplo.com) E <rótulo> escrito literalmente no código dos testes.
//   C) sessão anônima: sem e-mail, criada em 2026-10-28 (dia do E2E de "Encontrei"), com encontrado
//      exatamente na coordenada fixa dos testes (e2e/support/geo.ts).
// Qualquer conta cuja exclusão removeria linha que aponta para usuário FORA da seleção é preservada.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const DEV_REF = "oezycoghvjqefycgtyxp";
const ref = readFileSync(join(ROOT, "supabase/.temp/project-ref"), "utf8").trim();
if (ref !== DEV_REF || !(process.env.MEL_SAFE_TARGET_REFS ?? "").split(",").includes(ref)) {
  console.error("[trava] limpeza recusada: só no mel-dev listado em MEL_SAFE_TARGET_REFS.");
  process.exit(1);
}
const OUT = join(homedir(), ".mel-dev-backups");
mkdirSync(OUT, { recursive: true });
const E2E_PASSWORD = "Senha-E2E-12345"; // pública, versionada em e2e/support/users.ts
const SE = { lat: -23.55052, lng: -46.633308 }; // e2e/support/geo.ts

function sql(text) {
  const file = join(OUT, `.q-${process.pid}.sql`);
  writeFileSync(file, text);
  const raw = execFileSync("npx", ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", file], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows ?? [];
}

/** Rótulos escritos literalmente no código dos testes de banco: createTestUser("rótulo"). */
function dbTestLabels() {
  const dir = join(ROOT, "packages/data/tests");
  const labels = new Set();
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    for (const m of readFileSync(join(dir, f), "utf8").matchAll(/["'`]([a-z0-9][a-z0-9-]*)["'`]/g)) labels.add(m[1]);
  }
  return [...labels];
}

const lit = (s) => `'${String(s).replaceAll("'", "''")}'`;

function selectTargetsSql() {
  return `
with u as (
  select id, email, created_at, is_anonymous,
         substring(email from '^(?:e2e|test)\\+([a-z0-9-]+)-[0-9a-f]{8}@exemplo\\.com$') as rotulo,
         case when email ~ '^e2e\\+[a-z0-9-]+-[0-9a-f]{8}@exemplo\\.com$' then 'A'
              when email ~ '^test\\+[a-z0-9-]+-[0-9a-f]{8}@exemplo\\.com$' then 'B' end as grupo_email,
         case when email ~ '^e2e\\+' and encrypted_password like '$2%'
              then encrypted_password = extensions.crypt(${lit(E2E_PASSWORD)}, encrypted_password) else false end as senha_e2e
    from auth.users
),
anon as (
  select distinct f.reporter_id as id
    from public.found_cases f join auth.users au on au.id = f.reporter_id
   where au.is_anonymous and au.email is null and au.created_at::date = date '2026-10-28'
     and f.lat = ${SE.lat} and f.lng = ${SE.lng}
)
select u.id, coalesce(u.email, '(anônimo)') as email, u.created_at::date as criado,
       case when u.grupo_email = 'A' and u.senha_e2e then 'A'
            when u.grupo_email = 'B' and u.rotulo = any (array[${dbTestLabels().map(lit).join(",")}]::text[]) then 'B'
            when u.id in (select id from anon) then 'C' end as grupo
  from u
 where (u.grupo_email = 'A' and u.senha_e2e)
    or (u.grupo_email = 'B' and u.rotulo = any (array[${dbTestLabels().map(lit).join(",")}]::text[]))
    or u.id in (select id from anon)`;
}

/** Tabelas e colunas restauráveis (sem colunas geradas) de public + auth.users/identities. */
function tablesSql() {
  return `
select n.nspname as esquema, c.relname as tabela,
       string_agg(quote_ident(a.attname), ', ' order by a.attnum) filter (where a.attgenerated = '') as colunas,
       bool_or(a.attidentity = 'a') as identidade
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
 where c.relkind = 'r' and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users', 'identities')))
 group by 1, 2 order by 1, 2`;
}

const deleteTargetsSql = (ids) => `delete from auth.users where id = any (array[${ids.map(lit).join(",")}]::uuid[]);`;

// Linhas que a exclusão removeria: foto antes → apaga (cascata real) → diferença. Tudo numa transação desfeita.
function diffSql(tables, ids) {
  const snaps = tables.map((t, i) => `create temp table s${i} on commit drop as select * from ${t.esquema}.${t.tabela};`).join("\n");
  const diffs = tables
    .map((t, i) => `select ${lit(`${t.esquema}.${t.tabela}`)} as tabela, coalesce(json_agg(row_to_json(d)), '[]') as linhas from (select * from s${i} except all select * from ${t.esquema}.${t.tabela}) d`)
    .join("\nunion all\n");
  return `begin;\n${snaps}\n${deleteTargetsSql(ids)}\ncreate temp table resultado on commit drop as ${diffs};\nselect tabela, linhas from resultado where json_array_length(linhas) > 0;\nrollback;`;
}

const hashOf = (t) => `(select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from ${t.esquema}.${t.tabela} x)`;

function rehearsalSql(tables, ids, backup) {
  const before = tables.map((t) => `select ${lit(`${t.esquema}.${t.tabela}`)} as tabela, ${hashOf(t)} as h`).join(" union all ");
  const restores = backup
    .map((b) => {
      const t = tables.find((x) => `${x.esquema}.${x.tabela}` === b.tabela);
      return `insert into ${b.tabela} (${t.colunas}) ${t.identidade ? "overriding system value" : ""} select ${t.colunas} from json_populate_recordset(null::${b.tabela}, $j$${JSON.stringify(b.linhas)}$j$);`;
    })
    .join("\n");
  return `begin;
create temp table antes on commit drop as ${before};
${deleteTargetsSql(ids)}
-- Restauração a partir do ARQUIVO de backup (gatilhos e checagens de FK desligados só durante a carga).
set local session_replication_role = replica;
${restores}
set local session_replication_role = origin;
create temp table depois on commit drop as ${before};
select a.tabela, a.h = d.h as igual from antes a join depois d using (tabela) where a.h <> d.h or a.tabela in (${backup.map((b) => lit(b.tabela)).join(",")});
rollback;`;
}

const mode = process.argv[2];

if (mode === "restaurar") {
  const file = process.argv[3];
  const bk = JSON.parse(readFileSync(file, "utf8"));
  if (bk.projeto !== DEV_REF) throw new Error("Backup de outro projeto.");
  const tables = sql(tablesSql());
  // Só repõe o que não existe (por chave primária): rodar duas vezes não duplica nada.
  const stmts = bk.tabelas.map((b) => {
    const t = tables.find((x) => `${x.esquema}.${x.tabela}` === b.tabela);
    return `insert into ${b.tabela} (${t.colunas}) ${t.identidade ? "overriding system value" : ""} select ${t.colunas} from json_populate_recordset(null::${b.tabela}, $j$${JSON.stringify(b.linhas)}$j$) on conflict do nothing;`;
  });
  sql(["begin;", "set local session_replication_role = replica;", ...stmts, "commit;"].join(String.fromCharCode(10)));
  const back = sql(`select count(*)::int as n from auth.users where id = any (array[${bk.contas.map(lit).join(",")}]::uuid[])`)[0].n;
  console.log(`Restauradas ${back} de ${bk.contas.length} contas a partir de ${file}.`);
  process.exit(0);
}

const sel = sql(selectTargetsSql());
const selected = sel.map((r) => r.id).sort();

if (mode === "selecionar") {
  const porGrupo = {};
  for (const r of sel) porGrupo[r.grupo] = (porGrupo[r.grupo] ?? 0) + 1;
  console.log(`Contas que atendem ao critério: ${selected.length}`, porGrupo);
  process.exit(0);
}

const tables = sql(tablesSql());
const allUsers = new Set(sql("select id from auth.users").map((r) => r.id));
const latest = join(OUT, "limpeza-testes-ultimo.txt");

if (mode === "backup") {
  // Tira da seleção, em rodadas, as contas cujas linhas removidas apontam para usuário
  // fora da seleção (conversa com conta preservada, por exemplo) — até não sobrar nenhuma.
  let ids = [...selected];
  const preserved = new Set();
  let diff;
  for (let round = 0; round < 10; round++) {
    diff = sql(diffSql(tables, ids)).map((r) => ({ tabela: r.tabela, linhas: typeof r.linhas === "string" ? JSON.parse(r.linhas) : r.linhas }));
    const inSel = new Set(ids);
    const linked = new Set();
    for (const b of diff)
      for (const row of b.linhas) {
        const vals = Object.values(row).filter((v) => typeof v === "string");
        if (vals.some((v) => allUsers.has(v) && !inSel.has(v))) vals.filter((v) => inSel.has(v)).forEach((v) => linked.add(v));
      }
    if (!linked.size) break;
    linked.forEach((v) => preserved.add(v));
    ids = ids.filter((v) => !linked.has(v));
  }
  const hash = createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 16);
  const file = join(OUT, `limpeza-testes-${hash}.json`);
  const total = diff.reduce((n, b) => n + b.linhas.length, 0);
  writeFileSync(file, JSON.stringify({ criado: new Date().toISOString(), projeto: ref, selecao: hash, contas: ids, preservadas: [...preserved], tabelas: diff }, null, 1));
  writeFileSync(latest, file);
  console.log(`Backup: ${file}`);
  console.log(`Contas a remover: ${ids.length} | preservadas por vínculo com conta fora da seleção: ${preserved.size}`);
  console.log(`Linhas que sairiam (cascata real): ${total}`, Object.fromEntries(diff.map((b) => [b.tabela, b.linhas.length])));
  process.exit(0);
}

if (mode === "executar" && !process.env.MEL_LIMPEZA_FRESCA) {
  // Backup e ensaio refeitos AGORA (os dados podem ter mudado desde o último backup);
  // só então apaga, na mesma execução.
  const self = [process.argv[1]];
  const env = { ...process.env, MEL_LIMPEZA_FRESCA: "1" };
  for (const step of ["backup", "ensaio", "executar"])
    execFileSync(process.execPath, [...self, step], { cwd: ROOT, env, stdio: "inherit" });
  process.exit(0);
}

if (mode === "ensaio" || mode === "executar") {
  const file = readFileSync(latest, "utf8").trim();
  const bk = JSON.parse(readFileSync(file, "utf8")); // o backup precisa ser legível
  const ids = bk.contas;
  const hash = createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 16);
  if (bk.selecao !== hash || bk.projeto !== DEV_REF) throw new Error("Backup inconsistente.");
  // Cada conta do backup ainda precisa atender ao critério agora.
  const still = new Set(selected);
  if (ids.some((v) => !still.has(v))) throw new Error("Seleção mudou desde o backup: refaça o backup.");
  const okFile = join(OUT, `ensaio-${hash}.ok`);
  if (mode === "ensaio") {
    const res = sql(rehearsalSql(tables, ids, bk.tabelas));
    const bad = res.filter((r) => !r.igual);
    console.log(`Ensaio de restauração a partir do arquivo: ${res.length - bad.length}/${res.length} tabelas afetadas idênticas ao original.`, bad.length ? bad : "");
    writeFileSync(okFile, bad.length ? "" : new Date().toISOString());
    process.exit(bad.length ? 3 : 0);
  }
  if (!existsSync(okFile) || !readFileSync(okFile, "utf8")) throw new Error("Ensaio de restauração não passou para este backup.");
  sql(`begin; ${deleteTargetsSql(ids)} commit;`);
  const left = sql(`select count(*)::int as n from auth.users where id = any (array[${ids.map(lit).join(",")}]::uuid[])`)[0].n;
  console.log(`Removidas ${ids.length - left} de ${ids.length} contas (backup ${file}).`);
}
