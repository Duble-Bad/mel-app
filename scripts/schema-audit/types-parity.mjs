// Paridade SEMÂNTICA entre dois arquivos de tipos do Supabase (schema public):
// o gerado do mel-dev (versionado) e o gerado do banco reconstruído.
// Ignora formatação e campos que só dependem da versão do gerador
// (ComputedFields, __InternalSupabase). Compara tabelas/colunas/tipos,
// Insert/Update (opcionalidade), relações, funções (args e retorno) e enums.
// Uso: node scripts/schema-audit/types-parity.mjs <dev.types.ts> <local.types.ts>
import { readFileSync } from "node:fs";
import ts from "typescript";

const IGNORED = new Set(["ComputedFields", "__InternalSupabase"]);
const clean = (s) => s.replace(/\s+/g, "").replace(/^\|/, "").replace(/,(?=[\]}])/g, "").replace(/;/g, ",");

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
const differences = diff(dev, local);
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
