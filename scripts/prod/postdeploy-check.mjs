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
export const EXPECTED = { migrations: 27, tabelas: 24, politicas_public: 60, politicas_storage: 9, enums: 16, funcoes_public: 40, funcoes_private: 51, triggers: 26 };

/**
 * Funções de PLATAFORMA (não são migrations da MEL) aceitas no mel-prod.
 * Só são aceitas quando TODAS as propriedades observadas (assinatura, md5 da
 * definição, owner, segurança, search_path, ACL, grants e event triggers)
 * forem iguais às revisadas em `expected`, e a chamada como anon for recusada.
 * Ausente em produção também reprova. Qualquer outra função a mais é drift.
 */
export const PLATFORM_FUNCTIONS = {
  // Auditada em 2026-10-29 (READ ONLY): criada antes das migrations da MEL
  // (OID anterior ao schema supabase_migrations). Origem no provisionamento do
  // Supabase PROVÁVEL, não comprovada. Mantida: só liga RLS em tabelas novas do public.
  "public.rls_auto_enable": {
    expected: {
      signature: "public.rls_auto_enable() returns event_trigger",
      language: "plpgsql",
      owner: "postgres",
      ownerSuperuser: false,
      security: "DEFINER",
      config: "search_path=pg_catalog",
      acl: "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      execute: { anon: true, authenticated: true, service_role: true },
      md5: "846ec2fbff751d24b890656d63c3a9bf",
      eventTriggers: [{ name: "ensure_rls", event: "ddl_command_end", tags: "CREATE TABLE,CREATE TABLE AS,SELECT INTO", enabled: "O", owner: "postgres" }],
    },
  },
};

/**
 * Lista EXATA de event triggers do mel-prod (auditada em 2026-10-29). Nenhum
 * vem das migrations da MEL: `ensure_rls` é o da função acima; os demais são
 * infraestrutura do Supabase (owner supabase_admin, funções em `extensions`).
 * Um a mais, a menos ou com qualquer atributo diferente reprova — inclusive
 * uma atualização da plataforma, que precisa ser revisada antes de aceita.
 */
export const EXPECTED_EVENT_TRIGGERS = [
  { name: "ensure_rls", event: "ddl_command_end", tags: "CREATE TABLE,CREATE TABLE AS,SELECT INTO", enabled: "O", owner: "postgres", function: "public.rls_auto_enable()" },
  { name: "issue_graphql_placeholder", event: "sql_drop", tags: "DROP EXTENSION", enabled: "O", owner: "supabase_admin", function: "extensions.set_graphql_placeholder()" },
  { name: "issue_pg_cron_access", event: "ddl_command_end", tags: "CREATE EXTENSION", enabled: "O", owner: "supabase_admin", function: "extensions.grant_pg_cron_access()" },
  { name: "issue_pg_graphql_access", event: "ddl_command_end", tags: "CREATE EXTENSION", enabled: "O", owner: "supabase_admin", function: "extensions.grant_pg_graphql_access()" },
  { name: "issue_pg_net_access", event: "ddl_command_end", tags: "CREATE EXTENSION", enabled: "O", owner: "supabase_admin", function: "extensions.grant_pg_net_access()" },
  { name: "pgrst_ddl_watch", event: "ddl_command_end", tags: "(todas)", enabled: "O", owner: "supabase_admin", function: "extensions.pgrst_ddl_watch()" },
  { name: "pgrst_drop_watch", event: "sql_drop", tags: "(todas)", enabled: "O", owner: "supabase_admin", function: "extensions.pgrst_drop_watch()" },
];

/** Compara os event triggers do banco, um a um, com a lista esperada. */
export async function checkEventTriggers(q, expected = EXPECTED_EVENT_TRIGGERS) {
  const actual = (
    await q(
      `select e.evtname, e.evtevent, coalesce(array_to_string(e.evttags, ','),'(todas)'), e.evtenabled::text, pg_get_userbyid(e.evtowner), n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid join pg_namespace n on n.oid=p.pronamespace order by 1`,
    )
  ).map(([name, event, tags, enabled, owner, fn]) => ({ name, event, tags, enabled, owner, function: fn }));
  const byName = new Map(actual.map((e) => [e.name, e]));
  const problems = [];
  for (const e of expected) {
    const a = byName.get(e.name);
    if (!a) problems.push(`${e.name} ausente`);
    else {
      const diff = Object.keys(e).filter((k) => a[k] !== e[k]);
      if (diff.length) problems.push(`${e.name} diferente em ${diff.map((k) => `${k}=${a[k]}`).join(", ")}`);
    }
  }
  for (const a of actual) if (!expected.some((e) => e.name === a.name)) problems.push(`${a.name} a mais (${a.event} → ${a.function})`);
  const list = actual.map((e) => `${e.name} (${e.event}; ${e.function})`).join(", ");
  return [
    problems.length
      ? { ok: false, msg: `event triggers diferentes do esperado: ${problems.join("; ")}` }
      : { ok: true, msg: `event triggers: ${actual.length}, idênticos ao esperado (nome, evento, tags, estado, owner, função): ${list}` },
  ];
}

/** Todas as propriedades de segurança de uma função, num objeto comparável. */
async function observeFunction(q, name) {
  const rows = await q(
    `select p.oid::text, pg_get_function_identity_arguments(p.oid), p.prorettype::regtype::text, l.lanname, pg_get_userbyid(p.proowner), (select rolsuper::text from pg_roles where oid=p.proowner), p.prosecdef::text, coalesce(array_to_string(p.proconfig,';'),''), coalesce(p.proacl::text,'(padrão)'), has_function_privilege('anon', p.oid, 'execute')::text, has_function_privilege('authenticated', p.oid, 'execute')::text, has_function_privilege('service_role', p.oid, 'execute')::text, md5(pg_get_functiondef(p.oid)), pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname||'.'||p.proname='${name}' order by 2`,
  );
  const out = [];
  for (const [oid, args, returns, language, owner, ownerSuper, secdef, config, acl, anon, authenticated, serviceRole, md5, definition] of rows) {
    const eventTriggers = (
      await q(`select evtname, evtevent, coalesce(array_to_string(evttags, ','),'(todas)'), evtenabled::text, pg_get_userbyid(evtowner) from pg_event_trigger where evtfoid=${Number(oid)} order by 1`)
    ).map(([evtName, event, tags, enabled, evtOwner]) => ({ name: evtName, event, tags, enabled, owner: evtOwner }));
    out.push({
      observed: {
        signature: `${name}(${args}) returns ${returns}`,
        language,
        owner,
        ownerSuperuser: ownerSuper === "true",
        security: secdef === "true" ? "DEFINER" : "INVOKER",
        config,
        acl,
        execute: { anon: anon === "true", authenticated: authenticated === "true", service_role: serviceRole === "true" },
        md5,
        eventTriggers,
      },
      definition,
    });
  }
  return out;
}

/**
 * Tenta chamar a função COMO anon, dentro da transação READ ONLY e de um
 * savepoint desfeito em seguida. Prova empírica, sem efeito no banco.
 */
async function probeCallAsAnon(q, name) {
  const [[member]] = await q(`select pg_has_role(current_user, 'anon', 'member')::text`);
  if (member !== "true") return { called: null, msg: "não testado: o usuário da conexão não pode assumir o papel anon" };
  await q("savepoint mel_probe");
  try {
    await q("set local role anon");
    await q(`select ${name}()`);
    return { called: true, msg: "a chamada como anon EXECUTOU sem erro" };
  } catch (err) {
    return { called: false, msg: `recusada pelo Postgres: [${err.code ?? "?"}] ${err.message}` };
  } finally {
    await q("rollback to savepoint mel_probe");
  }
}

/** Verifica as funções da plataforma presentes no banco (somente leitura). */
export async function inspectPlatformFunctions(q, known = PLATFORM_FUNCTIONS) {
  const results = [];
  const details = [];
  const present = [];
  for (const [name, spec] of Object.entries(known)) {
    const found = await observeFunction(q, name);
    // Revisada e esperada em produção: sumir também é diferença.
    if (!found.length && spec.expected !== null) results.push({ ok: false, msg: `objeto da plataforma ${name}: ausente (era esperado, conforme auditoria)` });
    for (const { observed: o, definition } of found) {
      present.push(name);
      const problems = [];
      // Requisitos estruturais, valem mesmo antes da revisão.
      if (o.signature !== `${name}() returns event_trigger`) problems.push(`assinatura inesperada: ${o.signature}`);
      if (!o.eventTriggers.length) problems.push("não está ligada a nenhum event trigger");
      if (o.security === "DEFINER" && !o.config.split(";").some((c) => c.startsWith("search_path="))) problems.push("SECURITY DEFINER sem search_path");
      // A chamada como anon tem que ser RECUSADA; executar ou não testar reprova.
      const probe = await probeCallAsAnon(q, name);
      if (probe.called !== false) problems.push(`chamada como anon: ${probe.msg}`);
      // Tudo o que foi observado tem que ser igual ao revisado.
      if (spec.expected === null) problems.push("propriedades ainda não revisadas (veja o detalhe no fim do relatório)");
      else {
        const diff = Object.keys({ ...spec.expected, ...o }).filter((k) => JSON.stringify(spec.expected[k]) !== JSON.stringify(o[k]));
        if (diff.length) problems.push(`diferente do revisado em: ${diff.join(", ")}`);
      }
      results.push(
        problems.length
          ? { ok: false, msg: `objeto da plataforma ${name}: ${problems.join("; ")}` }
          : { ok: true, msg: `objeto da plataforma ${name}() idêntico ao revisado (md5 ${o.md5}, owner, segurança, ACL, grants, event trigger); chamada como anon ${probe.msg}` },
      );
      if (!problems.length) continue;
      details.push(
        "",
        `### ${name} — fora das migrations`,
        "",
        `- chamada \`select ${name}()\` como anon: ${probe.msg}`,
        "",
        "Propriedades observadas:",
        "```json",
        JSON.stringify(o, null, 2),
        "```",
        "Definição completa:",
        "```sql",
        definition.trim(),
        "```",
      );
    }
  }
  if (present.length) {
    // anon/authenticated não podem criar tabelas (o que dispararia event triggers de DDL).
    const ddl = await q(
      `select r, coalesce((select string_agg(n.nspname, ', ' order by n.nspname) from pg_namespace n where has_schema_privilege(r, n.oid, 'CREATE')),'nenhum'), has_database_privilege(r, current_database(), 'CREATE')::text from unnest(array['anon','authenticated']) r`,
    );
    const canCreate = ddl.filter(([, schemas, db]) => schemas !== "nenhum" || db === "true");
    results.push(
      canCreate.length
        ? { ok: false, msg: `papéis da API podem criar objetos: ${canCreate.map(([r, s, db]) => `${r} (schemas: ${s}; banco: ${db})`).join("; ")}` }
        : { ok: true, msg: "anon e authenticated sem CREATE em schemas e no banco" },
    );
  }
  return { present, results, details };
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
    results.push(...platform.results, ...(await checkEventTriggers(db.query)));
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
