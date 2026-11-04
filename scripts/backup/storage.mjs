// Backup dos arquivos do Supabase Storage e conferência banco × arquivos.
// Usa a API do Storage com a chave secreta (SUPABASE_URL / SUPABASE_SECRET_KEY).
// Nunca imprime caminhos nem conteúdo (caminhos têm ids de pessoas): só totais.
//
//   node scripts/backup/storage.mjs export <pasta>   baixa todos os arquivos + files.json (tamanho, tipo, sha256)
//   node scripts/backup/storage.mjs import <pasta>   envia de volta, nos MESMOS caminhos
//   node scripts/backup/storage.mjs check            referências do banco × arquivos (sai 1 se faltar arquivo)
//   node scripts/backup/storage.mjs stats            arquivos e bytes por bucket, sem baixar nada
//                                                    (estimar egress do backup no plano Free)
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SECRET_KEY.");
  process.exit(2);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Todos os objetos de um bucket (pastas percorridas recursivamente). */
async function listAll(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`listagem do bucket ${bucket} falhou: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listAll(bucket, path)));
      else out.push({ path, size: item.metadata?.size ?? null, contentType: item.metadata?.mimetype ?? "application/octet-stream" });
    }
    if (data.length < 1000) return out;
  }
}

async function buckets() {
  const { data, error } = await admin.storage.listBuckets();
  if (error) throw new Error(`listagem de buckets falhou: ${error.message}`);
  return data.map((b) => b.id).sort();
}

async function exportAll(dir) {
  const files = [];
  for (const bucket of await buckets()) {
    let bytes = 0;
    const objects = await listAll(bucket);
    for (const o of objects) {
      const { data, error } = await admin.storage.from(bucket).download(o.path);
      if (error) throw new Error(`download falhou (bucket ${bucket}): ${error.message}`);
      const buf = Buffer.from(await data.arrayBuffer());
      const target = join(dir, bucket, o.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buf);
      files.push({ bucket, path: o.path, size: buf.length, contentType: o.contentType, sha256: sha256(buf) });
      bytes += buf.length;
    }
    console.log(`[storage] ${bucket}: ${objects.length} arquivos, ${bytes} bytes`);
  }
  writeFileSync(join(dir, "files.json"), JSON.stringify(files));
  console.log(`[storage] total: ${files.length} arquivos`);
}

async function importAll(dir) {
  const files = JSON.parse(readFileSync(join(dir, "files.json"), "utf8"));
  const existing = new Set(await buckets());
  let done = 0;
  for (const f of files) {
    if (!existing.has(f.bucket)) throw new Error(`bucket ${f.bucket} não existe no destino (aplique as migrations antes)`);
    const buf = readFileSync(join(dir, f.bucket, f.path));
    if (sha256(buf) !== f.sha256) throw new Error(`arquivo corrompido no backup (bucket ${f.bucket})`);
    const { error } = await admin.storage.from(f.bucket).upload(f.path, buf, { contentType: f.contentType, upsert: false, cacheControl: "31536000" });
    if (error) throw new Error(`envio falhou (bucket ${f.bucket}): ${error.message}`);
    done++;
  }
  console.log(`[storage] restaurados: ${done}/${files.length} arquivos`);
}

/** Linhas de uma tabela, em páginas (a API devolve no máximo 1000 por vez). */
async function rows(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`leitura de ${table} falhou: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

/** Caminhos que o banco referencia, por bucket. */
async function references() {
  const refs = { avatars: new Set(), "pet-photos": new Set(), "sighting-media": new Set() };
  for (const r of await rows("pet_photos", "storage_path, thumb_path")) refs["pet-photos"].add(r.storage_path).add(r.thumb_path);
  for (const r of await rows("adoption_listings", "photo_paths")) for (const p of r.photo_paths ?? []) refs["pet-photos"].add(p);
  for (const r of await rows("businesses", "logo_path")) if (r.logo_path) refs["pet-photos"].add(r.logo_path);
  for (const r of await rows("sightings", "photo_path")) if (r.photo_path) refs["sighting-media"].add(r.photo_path);
  for (const r of await rows("found_cases", "photo_path")) if (r.photo_path) refs["sighting-media"].add(r.photo_path);
  // Avatar é guardado como URL pública; só conta o que aponta para o bucket avatars deste projeto.
  for (const r of await rows("profiles", "avatar_url")) {
    const m = /\/storage\/v1\/object\/public\/avatars\/([^?]+)/.exec(r.avatar_url ?? "");
    if (m && r.avatar_url.startsWith(url)) refs.avatars.add(decodeURIComponent(m[1]));
  }
  return refs;
}

async function check() {
  const refs = await references();
  let missing = 0;
  for (const bucket of await buckets()) {
    const stored = new Set((await listAll(bucket)).map((o) => o.path));
    const wanted = refs[bucket] ?? new Set();
    const lost = [...wanted].filter((p) => !stored.has(p)).length;
    const orphans = [...stored].filter((p) => !wanted.has(p)).length;
    missing += lost;
    console.log(`[check] ${bucket}: ${wanted.size} referenciados, ${stored.size} arquivos, ${lost} referências sem arquivo, ${orphans} arquivos sem referência`);
  }
  if (missing) {
    console.error(`[check] FALHA: ${missing} referências do banco apontam para arquivos ausentes`);
    process.exit(1);
  }
  console.log("[check] ok: toda referência do banco tem arquivo");
}

async function stats() {
  let files = 0;
  let bytes = 0;
  for (const bucket of await buckets()) {
    const objects = await listAll(bucket);
    const size = objects.reduce((s, o) => s + (o.size ?? 0), 0);
    files += objects.length;
    bytes += size;
    console.log(`[stats] ${bucket}: ${objects.length} arquivos, ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
  console.log(`[stats] total: ${files} arquivos, ${(bytes / 1024 / 1024).toFixed(1)} MB; backup completo diário ≈ ${((bytes * 30) / 1024 ** 3).toFixed(2)} GB/mês de egress`);
}

const [cmd, dir] = process.argv.slice(2);
try {
  if (cmd === "export" && dir) await exportAll(dir);
  else if (cmd === "import" && dir) await importAll(dir);
  else if (cmd === "check") await check();
  else if (cmd === "stats") await stats();
  else {
    console.error("uso: storage.mjs export <pasta> | import <pasta> | check | stats");
    process.exit(2);
  }
} catch (err) {
  console.error(`[storage] ${err.message}`);
  process.exit(1);
}
