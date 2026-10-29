// Auditoria do banco RECONSTRUÍDO a partir das migrations (Supabase local).
// Só roda contra banco local. Compara o catálogo com as migrations, confere o
// manifesto e a impressão digital versionada (supabase/schema-fingerprint.json),
// que é a referência do pós-deploy de produção.
// Uso: DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/schema-audit/audit.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { audit, checkManifest, compareFingerprint, fingerprint, openReadOnly, report, scanForSeedData } from "./catalog.mjs";

const root = resolve(import.meta.dirname, "../..");
const dbUrl = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const host = new URL(dbUrl).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(`[trava] auditoria local só roda contra banco local (host recebido: ${host}).`);
  process.exit(2);
}

const { files, problems: manifestProblems } = checkManifest(root);
const seedProblems = scanForSeedData(files);
const exposedSchemas = (readFileSync(resolve(root, "supabase/config.toml"), "utf8").match(/^schemas = \[(.*)\]/m)?.[1] ?? "").split(",").map((s) => s.trim().replace(/"/g, ""));

const db = await openReadOnly(dbUrl);
let failed = true;
try {
  const { inventory, results } = await audit(db.query, files, { exposedSchemas });
  results.push(
    manifestProblems.length ? { ok: false, msg: `manifesto: ${manifestProblems.join("; ")}` } : { ok: true, msg: `manifesto: ${files.length} migrations idênticas às validadas` },
    seedProblems.length ? { ok: false, msg: `dados de seed/demo nas migrations: ${seedProblems.join("; ")}` } : { ok: true, msg: "nenhum dado de seed/demo nas migrations" },
  );

  const fp = await fingerprint(db.query);
  const fpFile = resolve(root, "supabase/schema-fingerprint.json");
  if (process.argv.includes("--write-fingerprint")) {
    writeFileSync(fpFile, `${JSON.stringify(fp, null, 2)}\n`);
    results.push({ ok: true, msg: "impressão digital gravada em supabase/schema-fingerprint.json" });
  } else if (!existsSync(fpFile)) {
    results.push({ ok: false, msg: "supabase/schema-fingerprint.json ausente: versione a impressão digital abaixo" });
  } else {
    const diffs = compareFingerprint(fp, JSON.parse(readFileSync(fpFile, "utf8")));
    results.push(
      diffs.length
        ? { ok: false, msg: `impressão digital diferente da versionada: ${diffs.join("; ")}` }
        : { ok: true, msg: `impressão digital idêntica à versionada (${Object.keys(fp).length} categorias)` },
    );
  }

  const text = report("Auditoria do schema reconstruído", inventory, results, ["", "Impressão digital do banco reconstruído:", "```json", JSON.stringify(fp, null, 2), "```"]);
  writeFileSync(resolve(root, "schema-audit-report.md"), text);
  writeFileSync(resolve(root, "schema-fingerprint.generated.json"), `${JSON.stringify(fp, null, 2)}\n`);
  console.log(text);
  failed = results.some((r) => !r.ok);
} finally {
  await db.close();
}
process.exit(failed ? 1 : 0);
