// Deploy do SCHEMA (somente migrations versionadas) no mel-prod.
//
// Exige TUDO ao mesmo tempo (falha segura por padrão):
//   - terminal interativo, fora de CI;
//   - --production e --expect-ref=<ref> iguais a MEL_PROD_PROJECT_REF;
//   - MEL_PROD_DB_URL do MESMO projeto e MEL_PROD_DB_CA_FILE (SSL verificado);
//   - mel-prod fora de MEL_SAFE_TARGET_REFS, do `supabase link` e do .env.local;
//   - pre-flight completo verde (manifesto, seed, git, CI, plano, estado);
//   - digitar o ref completo e a frase de confirmação;
//   - responder "y" ao prompt do próprio Supabase CLI.
// Nunca faz link, reset, seed, config push, E2E ou qualquer outra coisa além de
// `supabase db push --db-url`. Termina com o pós-deploy (somente leitura).
//
//   node scripts/prod/deploy-schema.mjs --production --expect-ref=<ref do mel-prod>
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { runPostdeploy } from "./postdeploy-check.mjs";
import { EXPECTED_MIGRATIONS, PLAN, printChecks, remoteVersions, runPreflight, validatePlan } from "./preflight.mjs";
import { assertInteractive, maskRef } from "./prod-target.mjs";

export const CONFIRM_PHRASE = "APLICAR MIGRATIONS NO MEL-PROD";

// CLI do Supabase instalado no projeto (versão do package-lock), chamado pelo
// próprio Node SEM shell: a URL com senha vai como argumento, nunca passa pelo
// cmd.exe/bash (caracteres como & % ^ | na senha não são interpretados).
const SUPABASE_CLI = resolve(import.meta.dirname, "../../node_modules/supabase/dist/supabase.js");

function run(cmd, dbUrl) {
  if (cmd[0] !== "supabase") throw new Error("ABORTADO: só o CLI do Supabase pode ser executado.");
  if (!existsSync(SUPABASE_CLI)) throw new Error("ABORTADO: CLI do Supabase não instalado (rode npm ci).");
  const args = cmd.slice(1).map((a) => (a === "<DB_URL>" ? dbUrl : a));
  // Sem --yes: o próprio CLI pede a última confirmação.
  execFileSync(process.execPath, [SUPABASE_CLI, ...args], { stdio: "inherit" });
}

async function main() {
  // Antes de qualquer coisa: pessoa num terminal, fora de CI.
  assertInteractive();

  const pre = await runPreflight();
  printChecks("PRE-FLIGHT — deploy de schema no mel-prod", pre.checks);
  if (!pre.ok) throw new Error("ABORTADO: pre-flight reprovado. Nada foi aplicado.");
  if (validatePlan(PLAN).length) throw new Error("ABORTADO: plano inválido.");
  const { target, pending } = pre;

  console.log(`\nAlvo: mel-prod ${maskRef(target.ref)}  |  pendentes (${pending.length}):\n  ${pending.join("\n  ")}`);
  console.log("\nSimulação (nada é aplicado):");
  run(PLAN[1].cmd, target.dbUrl);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typedRef = (await rl.question("\nDigite o ref COMPLETO do mel-prod para confirmar o alvo: ")).trim();
  if (typedRef !== target.ref) {
    rl.close();
    throw new Error("ABORTADO: ref digitado não confere. Nada foi aplicado.");
  }
  const phrase = (await rl.question(`Digite exatamente "${CONFIRM_PHRASE}": `)).trim();
  rl.close();
  if (phrase !== CONFIRM_PHRASE) throw new Error("ABORTADO: frase de confirmação não confere. Nada foi aplicado.");

  // Estado pode ter mudado entre o pre-flight e a confirmação: confere de novo.
  const again = await remoteVersions(target);
  if (again.length !== EXPECTED_MIGRATIONS - pending.length) throw new Error("ABORTADO: o estado de produção mudou desde o pre-flight.");

  console.log("\nAplicando migrations pendentes:");
  run(PLAN[2].cmd, target.dbUrl);

  console.log("\nPós-deploy (somente leitura):");
  const post = await runPostdeploy(target);
  console.log(post.text);
  if (!post.ok) throw new Error("Pós-deploy REPROVADO. Não siga para configuração; investigue antes.");
  console.log("\nDeploy de schema concluído e verificado.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
