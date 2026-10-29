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

/**
 * Funções que o PRÓPRIO Supabase cria em projetos novos, fora das migrations
 * (não existem no banco reconstruído do zero nem no mel-dev). Só são aceitas
 * com a assinatura exata, ligadas a um event trigger e com a definição
 * revisada (md5 de pg_get_functiondef). Qualquer outro objeto a mais é drift.
 */
export const PLATFORM_FUNCTIONS = {
  // Opção "Enable automatic RLS" na criação do projeto: event trigger que liga
  // RLS em tabelas novas do public. Retorna event_trigger: não é chamável via API.
  "public.rls_auto_enable": { args: "", returns: "event_trigger", md5: null },
};

/** Verifica as funções da plataforma presentes no banco (somente leitura). */
export async function inspectPlatformFunctions(q, known = PLATFORM_FUNCTIONS) {
  const names = Object.keys(known);
  const rows = await q(
    `select n.nspname||'.'||p.proname, pg_get_function_identity_arguments(p.oid), p.prorettype::regtype::text, p.prosecdef::text, coalesce(array_to_string(p.proconfig,';'),''), md5(pg_get_functiondef(p.oid)), coalesce((select string_agg(e.evtname||' ('||e.evtevent||', enabled='||e.evtenabled||')', ', ' order by e.evtname) from pg_event_trigger e where e.evtfoid=p.oid),''), pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in (${names.map((n) => `'${n}'`).join(",")}) order by 1, 2`,
  );
  const results = [];
  const details = [];
  for (const [name, args, returns, secdef, config, md5, events, def] of rows) {
    const spec = known[name];
    const problems = [];
    if (args !== spec.args || returns !== spec.returns) problems.push(`assinatura inesperada: ${name}(${args}) returns ${returns}`);
    if (!events) problems.push("não está ligada a nenhum event trigger");
    if (secdef === "true" && !config.split(";").some((c) => c.startsWith("search_path="))) problems.push("SECURITY DEFINER sem search_path");
    if (spec.md5 === null) problems.push(`definição ainda não revisada (md5 ${md5})`);
    else if (md5 !== spec.md5) problems.push(`definição diferente da revisada (md5 ${md5})`);
    results.push(
      problems.length
        ? { ok: false, msg: `objeto da plataforma ${name}: ${problems.join("; ")}` }
        : { ok: true, msg: `objeto da plataforma ${name}() reconhecido (event trigger: ${events}; definição revisada)` },
    );
    details.push("", `### ${name} (fora das migrations; event trigger: ${events || "nenhum"}; md5 ${md5})`, "```sql", def.trim(), "```");
  }
  return { present: [...new Set(rows.map((r) => r[0]))], results, details };
}

export async function runPostdeploy(target, root = process.cwd()) {
  const { files } = checkManifest(root);
  const db = await openReadOnly(target.dbUrl, target.ssl);
  try {
    // Objetos da plataforma são verificados à parte e saem das demais comparações:
    // assim qualquer diferença restante é drift do schema da MEL.
    const platform = await inspectPlatformFunctions(db.query);
    const ignoreFunctions = platform.present;
    // Na produção a lista de schemas expostos é do painel (não do config.toml):
    // a verificação "private fora da API" fica no checklist de configuração.
    const { inventory, results } = await audit(db.query, files, { exposedSchemas: undefined, ignoreFunctions });
    results.push(...platform.results);
    for (const [k, v] of Object.entries(EXPECTED)) {
      const got = k === "migrations" ? Number(String(inventory.migrations).split("/")[0]) : inventory[k];
      results.push({ ok: got === v, msg: `${k}: ${got} (esperado ${v})` });
    }
    const pub = inventory.publication.split(", ").sort().join(", ");
    results.push({ ok: pub === "public.messages, public.notifications", msg: `Realtime: ${pub}` });
    const fp = await fingerprint(db.query, { ignoreFunctions });
    const diffs = compareFingerprint(fp, JSON.parse(readFileSync(resolve(root, "supabase/schema-fingerprint.json"), "utf8")));
    const besides = ignoreFunctions.length ? ` (desconsiderando só ${ignoreFunctions.join(", ")}, verificado acima)` : "";
    results.push(
      diffs.length
        ? { ok: false, msg: `drift em relação ao banco reconstruído do zero${besides}: ${diffs.join("; ")}` }
        : { ok: true, msg: `sem drift: impressão digital idêntica à do banco reconstruído (${Object.keys(fp).length} categorias, definições completas)${besides}` },
    );
    return { ok: results.every((r) => r.ok), text: report(`Pós-deploy — mel-prod ${maskRef(target.ref)}`, inventory, results, platform.details) };
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
