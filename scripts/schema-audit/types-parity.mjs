// Paridade SEMÂNTICA entre dois arquivos de tipos do Supabase (schema public):
// o gerado do mel-dev (versionado) e o gerado do banco reconstruído.
// Ignora formatação e campos que só dependem da versão do gerador
// (ComputedFields, __InternalSupabase). Compara tabelas/colunas/tipos,
// Insert/Update (opcionalidade), relações, funções (args e retorno) e enums.
// Uso: node scripts/schema-audit/types-parity.mjs <dev.types.ts> <local.types.ts>
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

const IGNORED = new Set(["ComputedFields", "__InternalSupabase"]);
// Notação que muda entre versões do gerador, sem mudar o tipo:
// never ≡ Record<PropertyKey, never>; 'x' ≡ "x"; (T)[] ≡ T[]; {"k": T, …} ≡ {k: T …}.
const clean = (s) =>
  s
    .replace(/\s+/g, "")
    .replace(/^\|/, "")
    .replace(/Record<PropertyKey,never>/g, "never")
    .replace(/'/g, '"')
    .replace(/\(([^()]*)\)\[\]/g, "$1[]")
    .replace(/"(\w+)"(\??):/g, "$1$2:")
    .replace(/[,;]/g, "");

function literal(node) {
  // Converte um TypeLiteral em objeto { prop: valor | texto normalizado }.
  const out = {};
  for (const m of node.members) {
    if (!m.name) continue;
    const name = m.name.text ?? m.name.getText().replace(/^"|"$/g, "");
    if (IGNORED.has(name)) continue;
    const key = name + (m.questionToken ? "?" : "");
    out[key] = m.type && ts.isTypeLiteralNode(m.type) ? literal(m.type) : clean(m.type ? m.type.getText() : "");
  }
  return out;
}

function publicSchema(file) {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const db = sf.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === "Database");
  if (!db || !ts.isTypeLiteralNode(db.type)) throw new Error(`Database não encontrado em ${file}`);
  const pub = literal(db.type).public;
  if (!pub) throw new Error(`schema public não encontrado em ${file}`);
  return pub;
}

function diff(a, b, path = "", out = []) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of [...keys].sort()) {
    const p = path ? `${path}.${k}` : k;
    const x = a?.[k];
    const y = b?.[k];
    if (x === undefined) out.push(`+ só no reconstruído: ${p}`);
    else if (y === undefined) out.push(`- só no mel-dev: ${p}`);
    else if (typeof x === "object" && typeof y === "object") diff(x, y, p, out);
    else if (x !== y) out.push(`≠ ${p}: mel-dev=${x} | reconstruído=${y}`);
  }
  return out;
}

const [devFile, localFile] = process.argv.slice(2);
const dev = publicSchema(devFile);
const local = publicSchema(localFile);
const raw = diff(dev, local);

// Duas regras do gerador mais novo que não mudam o schema — aceitas SÓ se o
// catálogo do banco reconstruído confirmar a coluna exata:
//   Json → NonNullable<Json>   coluna jsonb NOT NULL
//   unknown → never (Insert/Update)   coluna GENERATED ALWAYS (não se escreve nela)
function column(table, col) {
  const url = process.env.DB_URL;
  if (!url) return null;
  const out = execFileSync("psql", [url, "-X", "-A", "-t", "-F", "|", "-c", `select is_nullable, is_generated, data_type from information_schema.columns where table_schema='public' and table_name='${table}' and column_name='${col}'`], { encoding: "utf8" }).trim();
  const [nullable, generated, type] = out.split("|");
  return { nullable, generated, type };
}
const accepted = [];
const differences = raw.filter((line) => {
  const m = line.match(/^≠ Tables\.(\w+)\.(Row|Insert|Update)\.(\w+)\??: mel-dev=(.*) \| reconstruído=(.*)$/);
  if (!m) return true;
  const [, table, section, col, before, after] = m;
  const c = column(table, col);
  if (!c) return true;
  if (before === "Json" && after === "NonNullable<Json>" && c.nullable === "NO" && c.type === "jsonb") {
    accepted.push(`${table}.${col} (${section}): jsonb NOT NULL`);
    return false;
  }
  if (before === "unknown" && after === "never" && section !== "Row" && c.generated === "ALWAYS") {
    accepted.push(`${table}.${col} (${section}): GENERATED ALWAYS`);
    return false;
  }
  return true;
});
if (accepted.length) console.log(`Equivalências do gerador confirmadas no catálogo (${accepted.length}): ${accepted.join("; ")}`);
const count = (o) => Object.keys(o ?? {}).length;
const cols = (o) => Object.values(o ?? {}).reduce((n, t) => n + count(t.Row), 0);
console.log(
  `mel-dev: ${count(dev.Tables)} tabelas, ${cols(dev.Tables)} colunas, ${count(dev.Functions)} funções, ${count(dev.Enums)} enums | ` +
    `reconstruído: ${count(local.Tables)} tabelas, ${cols(local.Tables)} colunas, ${count(local.Functions)} funções, ${count(local.Enums)} enums`,
);
if (differences.length) {
  console.log(`DIFERENTE: ${differences.length} diferença(s) semântica(s)`);
  console.log(differences.slice(0, 200).join("\n"));
  process.exit(1);
}
console.log("IGUAL: schema public do banco reconstruído é semanticamente idêntico ao do mel-dev (tabelas, colunas, tipos, nulabilidade, Insert/Update, relações, funções, enums).");
