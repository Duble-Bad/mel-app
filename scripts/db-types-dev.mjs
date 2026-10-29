// Gera os tipos do banco a partir do projeto ligado ao CLI — SOMENTE se ele for
// de desenvolvimento (MEL_SAFE_TARGET_REFS). Produção nunca fica ligada ao CLI.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { assertLinkedRefSafe } from "./lib/safe-target.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
assertLinkedRefSafe("db:types");
const types = execFileSync("npx", ["supabase", "gen", "types", "typescript", "--linked", "--schema", "public"], { encoding: "utf8", shell: process.platform === "win32" });
writeFileSync("packages/data/src/database.types.ts", types);
console.log("packages/data/src/database.types.ts atualizado.");
