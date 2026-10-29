// Aplica as migrations no projeto ligado ao CLI — SOMENTE se ele for de
// desenvolvimento (MEL_SAFE_TARGET_REFS). Deploy em produção é um procedimento
// separado e manual, nunca este comando.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { assertLinkedRefSafe } from "./lib/safe-target.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
assertLinkedRefSafe("db:push");
execFileSync("npx", ["supabase", "db", "push", "--linked", ...process.argv.slice(2)], { stdio: "inherit", shell: process.platform === "win32" });
