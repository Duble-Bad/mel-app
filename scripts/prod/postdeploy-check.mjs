// Pós-deploy de produção: verifica o schema do mel-prod SEM criar nem alterar
// dados (transação READ ONLY, só consultas ao catálogo). Compara com as
// migrations e com a impressão digital do banco reconstruído do zero.
//   node scripts/prod/postdeploy-check.mjs --production --expect-ref=<ref>
//   (mesmas variáveis de ambiente do deploy; veja prod-target.mjs)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { audit, checkManifest, compareFingerprint, fingerprint, openReadOnly, report } from "../schema-audit/catalog.mjs";
import { assertProdTarget, maskRef } from "./prod-target.mjs";

/** Números que o schema da MEL tem que ter (validados na reconstrução do zero). */
export const EXPECTED = { migrations: 23, tabelas: 24, politicas_public: 60, politicas_storage: 9, enums: 16, funcoes_public: 40, funcoes_private: 46, triggers: 24 };

export async function runPostdeploy(target, root = process.cwd()) {
  const { files } = checkManifest(root);
  const db = await openReadOnly(target.dbUrl, target.ssl);
  try {
    // Na produção a lista de schemas expostos é do painel (não do config.toml):
    // a verificação "private fora da API" fica no checklist de configuração.
    const { inventory, results } = await audit(db.query, files, { exposedSchemas: undefined });
    for (const [k, v] of Object.entries(EXPECTED)) {
      const got = k === "migrations" ? Number(String(inventory.migrations).split("/")[0]) : inventory[k];
      results.push({ ok: got === v, msg: `${k}: ${got} (esperado ${v})` });
    }
    const pub = inventory.publication.split(", ").sort().join(", ");
    results.push({ ok: pub === "public.messages, public.notifications", msg: `Realtime: ${pub}` });
    const fp = await fingerprint(db.query);
    const diffs = compareFingerprint(fp, JSON.parse(readFileSync(resolve(root, "supabase/schema-fingerprint.json"), "utf8")));
    results.push(
      diffs.length
        ? { ok: false, msg: `drift em relação ao banco reconstruído do zero: ${diffs.join("; ")}` }
        : { ok: true, msg: `sem drift: impressão digital idêntica à do banco reconstruído (${Object.keys(fp).length} categorias, definições completas)` },
    );
    return { ok: results.every((r) => r.ok), text: report(`Pós-deploy — mel-prod ${maskRef(target.ref)}`, inventory, results) };
  } finally {
    await db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const target = assertProdTarget();
    const r = await runPostdeploy(target);
    console.log(r.text);
    process.exit(r.ok ? 0 : 1);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
