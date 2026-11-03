// Renomeia as fotos antigas do sighting-media (<sessão>/<uuid>.ext) para o nome
// neutro (<uuid>.ext) e atualiza o avistamento/encontrado que as usa. O UUID da
// sessão no caminho era um pseudônimo público de quem enviou (P0 de privacidade,
// migration 29). Idempotente: só mexe no que ainda tem "/" no caminho. Se o
// arquivo já não existe, limpa a referência (photo_path = null).
//
//   node scripts/sighting-media-neutral-names.mjs            (só lista)
//   node scripts/sighting-media-neutral-names.mjs --apply    (renomeia)
//
// Fora do Supabase local/dev listado em MEL_SAFE_TARGET_REFS: acrescente
// --confirm-target=<ref do projeto> (ação deliberada, ex.: no lançamento).
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { assertAdminTarget } from "./lib/safe-target.mjs";

const root = resolve(import.meta.dirname, "..");
if (existsSync(resolve(root, ".env.local"))) process.loadEnvFile(resolve(root, ".env.local"));
const { createClient } = createRequire(resolve(root, "packages/data/package.json"))("@supabase/supabase-js");

assertAdminTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, "sighting-media-neutral-names");
const apply = process.argv.includes("--apply");
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const bucket = service.storage.from("sighting-media");
const NEUTRAL = /^[0-9a-f-]{36}\.(webp|jpg|png)$/;

let moved = 0;
let cleared = 0;
let failed = 0;

/** Confirma que o arquivo não existe (não confia só na mensagem de erro do move). */
async function missing(path) {
  const slash = path.lastIndexOf("/");
  const { data, error } = await bucket.list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 10 });
  return !error && !(data ?? []).some((f) => f.name === path.slice(slash + 1));
}
for (const table of ["sightings", "found_cases"]) {
  const { data, error } = await service.from(table).select("id, photo_path").like("photo_path", "%/%");
  if (error) throw error;
  console.log(`${table}: ${data.length} foto(s) com caminho antigo`);
  if (!apply) continue;
  for (const row of data) {
    const base = row.photo_path.split("/").pop();
    const ext = base.split(".").pop();
    const target = NEUTRAL.test(base) ? base : `${crypto.randomUUID()}.${["webp", "jpg", "png"].includes(ext) ? ext : "webp"}`;
    const { error: moveError } = await bucket.move(row.photo_path, target);
    if (moveError && (await missing(row.photo_path))) {
      // Arquivo já não existe (ex.: apagado): a referência só guardava o pseudônimo.
      const { error: clearError } = await service.from(table).update({ photo_path: null }).eq("id", row.id);
      if (clearError) {
        failed++;
        console.warn(`  ${table} ${row.id}: arquivo inexistente; referência não limpa (${clearError.message})`);
      } else cleared++;
      continue;
    }
    if (moveError) {
      failed++;
      console.warn(`  ${table} ${row.id}: não movida (${moveError.message})`);
      continue;
    }
    const { error: updateError } = await service.from(table).update({ photo_path: target }).eq("id", row.id);
    if (updateError) {
      failed++;
      console.warn(`  ${table} ${row.id}: movida, mas o envio não foi atualizado (${updateError.message}); desfazendo`);
      await bucket.move(target, row.photo_path);
      continue;
    }
    moved++;
  }
}
console.log(apply ? `Renomeadas: ${moved}. Referências a arquivo inexistente limpas: ${cleared}. Falhas: ${failed}.` : "Nada alterado (use --apply).");
if (failed) process.exitCode = 1;
