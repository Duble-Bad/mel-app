// Repositório de backups da MEL: arquivos do Storage incrementais + fotos do banco.
// O repositório é qualquer destino do rclone (pasta local no ensaio; bucket B2/R2 em
// produção). Nada aqui imprime caminhos, dados ou segredos: só totais.
//
// Estrutura do repositório:
//   blobs/<chave>.age          um arquivo do Storage, criptografado (age)
//   blobs/<chave>.age.sha256   sha256 do CIFRADO (confere sem a chave privada)
//   snapshots/<data>.tar.gz.age  banco + manifesto (caminho → blob) de um ponto
//   snapshots/<data>.refs      chaves dos blobs que o ponto usa (sem dados)
//   snapshots/<data>.ok        escrito POR ÚLTIMO e SÓ para ponto íntegro (toda
//                              referência do banco tem arquivo): sha256 do snapshot e do
//                              .refs, status "complete". Sem .ok, o ponto não existe
//   snapshots/<data>.incomplete  no lugar do .ok quando falta arquivo referenciado: o ponto
//                              fica guardado para diagnóstico, mas nunca é "o mais
//                              recente", não passa no verify e não é restaurado
//
// <chave> = sha256(bucket, caminho, eTag, tamanho, updated_at): calculável pela
// listagem do Storage, sem baixar. Arquivo substituído → outra chave → blob novo; o
// antigo continua servindo os pontos anteriores. Não há índice que possa se perder:
// o que já está no repositório é a própria listagem de blobs/.
//
//   node incremental.mjs store-files <trabalho>          envia os blobs novos; grava storage/manifest.json
//   node incremental.mjs seal <trabalho> <data>           cifra o ponto, grava .refs e por fim .ok
//   node incremental.mjs list [--incomplete]              pontos íntegros (ou os incompletos)
//   node incremental.mjs verify <data|latest> [--quick]   confere snapshot e blobs (sem a chave privada);
//                                                         --quick não baixa os blobs (uso diário: egress)
//   node incremental.mjs fetch <data|latest> <trabalho>   confere tudo e abre o ponto (precisa da chave)
//   node incremental.mjs prune <dias>                     retenção: apaga pontos velhos e blobs sem uso
//   node incremental.mjs rebuild-refs                     refaz os .refs a partir dos snapshots (precisa da chave)
//   node incremental.mjs missing <data>                   diagnóstico LOCAL: caminhos sem arquivo de um ponto
//                                                         incompleto (precisa da chave; não rodar no CI)
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const REPO = process.env.BACKUP_REPO;
if (!REPO) fail("defina BACKUP_REPO (destino do rclone; ex.: /tmp/repo ou r2:mel-backup)");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const STAMP = /^\d{8}T\d{6}Z$/;

function fail(msg) {
  console.error(`[repo] ${msg}`);
  process.exit(1);
}

function run(cmd, args, input) {
  const r = spawnSync(cmd, args, { input, maxBuffer: 1024 ** 3 });
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]} falhou: ${String(r.stderr).split("\n")[0].slice(0, 200)}`);
  return r.stdout;
}

// --- Repositório (rclone) ---------------------------------------------------
const remote = (name) => `${REPO.replace(/\/$/, "")}/${name}`;
const scratch = mkdtempSync(join(tmpdir(), "mel-repo-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

function list(dir) {
  const out = spawnSync("rclone", ["lsjson", "--files-only", remote(dir)], { maxBuffer: 1024 ** 3 });
  if (out.status !== 0) return [];
  return JSON.parse(String(out.stdout)).map((f) => ({ name: f.Name, size: f.Size, modTime: Date.parse(f.ModTime) }));
}
function put(name, buf) {
  const tmp = join(scratch, "up");
  writeFileSync(tmp, buf);
  run("rclone", ["copyto", tmp, remote(name)]);
}
const get = (name) => run("rclone", ["cat", remote(name)]);

/** Todos os .sha256 dos blobs, numa única chamada (são poucos bytes cada). */
function sidecars() {
  const dir = mkdtempSync(join(scratch, "sc-"));
  spawnSync("rclone", ["copy", "--include", "*.age.sha256", remote("blobs"), dir], { maxBuffer: 1024 ** 3 });
  return (key) => {
    const file = join(dir, `${key}.age.sha256`);
    return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
  };
}
const del = (name) => run("rclone", ["deletefile", remote(name)]);

// --- age ----------------------------------------------------------------------
function encrypt(buf) {
  const recipient = process.env.BACKUP_AGE_RECIPIENT;
  if (!recipient) fail("defina BACKUP_AGE_RECIPIENT (chave pública age)");
  return run("age", ["-r", recipient], buf);
}
function decrypt(buf) {
  const identity = process.env.BACKUP_AGE_IDENTITY;
  if (!identity) fail("defina BACKUP_AGE_IDENTITY (arquivo da chave privada age)");
  return run("age", ["-d", "-i", identity], buf);
}

// --- Storage (origem) --------------------------------------------------------------
function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) fail("defina SUPABASE_URL e SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listStorage(admin) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw new Error(`listagem de buckets falhou: ${error.message}`);
  const out = [];
  async function walk(bucket, prefix) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error: e } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (e) throw new Error(`listagem do bucket ${bucket} falhou: ${e.message}`);
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) await walk(bucket, path);
        else
          out.push({
            bucket,
            path,
            size: item.metadata?.size ?? 0,
            contentType: item.metadata?.mimetype ?? "application/octet-stream",
            etag: item.metadata?.eTag ?? "",
            updatedAt: item.updated_at ?? item.metadata?.lastModified ?? "",
          });
      }
      if (data.length < 1000) return;
    }
  }
  for (const b of buckets.map((x) => x.id).sort()) await walk(b, "");
  return out;
}

const blobKey = (o) => sha256(["mel-blob-v1", o.bucket, o.path, o.etag, String(o.size), o.updatedAt].join("\n"));

// --- Comandos -------------------------------------------------------------------------
async function storeFiles(work) {
  const admin = storageClient();
  const objects = await listStorage(admin);
  const present = new Set(list("blobs").map((f) => f.name));
  const shaOf = sidecars();
  const interruptAfter = Number(process.env.BACKUP_TEST_INTERRUPT_AFTER_BLOBS ?? "-1"); // só para o ensaio
  let fresh = 0;
  let reused = 0;
  let bytes = 0;
  const files = [];
  for (const o of objects) {
    const key = blobKey(o);
    const name = `blobs/${key}.age`;
    let cipherSha;
    // Blob só conta como existente se o .sha256 (escrito depois dele) também existir.
    const known = present.has(`${key}.age`) ? shaOf(key) : null;
    if (known) {
      cipherSha = known;
      reused++;
    } else {
      if (fresh === interruptAfter) fail("ensaio: backup interrompido de propósito no meio do envio");
      const { data, error } = await admin.storage.from(o.bucket).download(o.path);
      if (error) throw new Error(`download falhou (bucket ${o.bucket}): ${error.message}`);
      const plain = Buffer.from(await data.arrayBuffer());
      if (plain.length !== o.size) throw new Error(`tamanho mudou durante o backup (bucket ${o.bucket}); rode de novo`);
      const cipher = encrypt(plain);
      cipherSha = sha256(cipher);
      put(name, cipher);
      put(`${name}.sha256`, Buffer.from(`${cipherSha}\n`));
      fresh++;
      bytes += plain.length;
    }
    files.push({ ...o, blob: key, cipherSha256: cipherSha });
  }
  mkdirSync(join(work, "storage"), { recursive: true });
  writeFileSync(join(work, "storage", "manifest.json"), JSON.stringify(files));
  console.log(`[repo] arquivos: ${files.length} no Storage; ${fresh} novos/alterados enviados (${bytes} bytes baixados), ${reused} já no repositório`);
}

/** Referências do banco (do próprio dump) sem arquivo no manifesto. */
function missingRefs(work, files) {
  const have = new Set(files.map((f) => `${f.bucket}/${f.path}`));
  return JSON.parse(readFileSync(join(work, "dump-refs.json"), "utf8"))
    .map((r) => `${r.bucket}/${r.path}`)
    .filter((k) => !have.has(k))
    .sort();
}

function seal(work, stamp) {
  if (!STAMP.test(stamp)) fail("data inválida");
  const files = JSON.parse(readFileSync(join(work, "storage", "manifest.json"), "utf8"));
  // Todo blob do manifesto precisa estar no repositório (com o .sha256) ANTES do .ok:
  // uma retenção rodando ao mesmo tempo, ou um envio perdido, não vira ponto "completo".
  const present = new Set(list("blobs").map((f) => f.name));
  const absent = files.filter((f) => !present.has(`${f.blob}.age`) || !present.has(`${f.blob}.age.sha256`)).length;
  if (absent) fail(`${absent} blobs do manifesto não estão no repositório — ponto NÃO selado`);
  // Referência do banco sem arquivo (apagado entre o dump e a listagem, ou já quebrada na
  // origem): o ponto é fiel ao que existia, mas fica REGISTRADO, e a restauração confere.
  const missing = missingRefs(work, files);
  writeFileSync(join(work, "storage", "missing-refs.json"), JSON.stringify(missing));
  const archive = encrypt(run("tar", ["-C", work, "-czf", "-", "."]));
  const refs = Buffer.from(`${[...new Set(files.map((f) => f.blob))].sort().join("\n")}\n`);
  put(`snapshots/${stamp}.tar.gz.age`, archive);
  put(`snapshots/${stamp}.refs`, refs);
  if (process.env.BACKUP_TEST_INTERRUPT_BEFORE_OK === "1") fail("ensaio: backup interrompido antes de marcar como completo");
  const marker = { snapshot: sha256(archive), refs: sha256(refs), files: files.length, missingRefs: missing.length };
  if (missing.length) {
    // Guardado para diagnóstico, nunca como ponto válido; o backup FALHA (sem ping de sucesso).
    put(`snapshots/${stamp}.incomplete`, Buffer.from(JSON.stringify({ ...marker, status: "incomplete" })));
    fail(`FALHA: ${missing.length} referências do banco sem arquivo — ponto ${stamp} INCOMPLETO (guardado para diagnóstico, não é backup válido)`);
  }
  put(`snapshots/${stamp}.ok`, Buffer.from(JSON.stringify({ ...marker, status: "complete" })));
  console.log(`[repo] ponto ${stamp} completo: ${files.length} arquivos, snapshot ${archive.length} bytes`);
}

/** Pontos com .ok, do mais antigo ao mais novo. */
const complete = () =>
  list("snapshots")
    .map((f) => f.name)
    .filter((n) => n.endsWith(".ok"))
    .map((n) => n.slice(0, -3))
    .filter((s) => STAMP.test(s))
    .sort();

/** Pontos marcados .incomplete (falta arquivo referenciado). */
const incomplete = () =>
  list("snapshots")
    .map((f) => f.name)
    .filter((n) => n.endsWith(".incomplete"))
    .map((n) => n.slice(0, -".incomplete".length))
    .filter((s) => STAMP.test(s))
    .sort();

function pick(which) {
  const points = complete();
  const stamp = which === "latest" ? points.at(-1) : which;
  if (stamp && incomplete().includes(stamp)) fail(`ponto ${stamp} INCOMPLETO (referências sem arquivo): não é backup válido`);
  if (!stamp || !points.includes(stamp)) fail(`ponto ${which} não existe ou está incompleto (sem .ok)`);
  const ok = JSON.parse(String(get(`snapshots/${stamp}.ok`)));
  if (ok.status !== "complete" || ok.missingRefs) fail(`ponto ${stamp}: marcador .ok sem status íntegro`);
  return stamp;
}

/** Confere o snapshot com o .ok. Devolve o arquivo cifrado. */
function checkedSnapshot(stamp) {
  const ok = JSON.parse(String(get(`snapshots/${stamp}.ok`)));
  const archive = get(`snapshots/${stamp}.tar.gz.age`);
  if (sha256(archive) !== ok.snapshot) fail(`ponto ${stamp}: snapshot não confere com o .ok (corrompido ou adulterado)`);
  return { ok, archive };
}

/** Confere os blobs de um manifesto (sha256 do cifrado), sem a chave privada. */
function checkBlobs(files) {
  const present = new Set(list("blobs").map((f) => f.name));
  let bad = 0;
  for (const f of new Map(files.map((x) => [x.blob, x])).values()) {
    if (!present.has(`${f.blob}.age`)) bad++;
    else if (sha256(get(`blobs/${f.blob}.age`)) !== f.cipherSha256) bad++;
  }
  return bad;
}

function verify(which, quick) {
  const stamp = pick(which);
  const { ok } = checkedSnapshot(stamp);
  // Sem a chave privada, os blobs são conferidos pelo .refs (cujo hash está no .ok).
  const refs = get(`snapshots/${stamp}.refs`);
  if (sha256(refs) !== ok.refs) fail(`ponto ${stamp}: .refs não confere com o .ok`);
  const present = new Set(list("blobs").map((f) => f.name));
  const shaOf = sidecars();
  let bad = 0;
  for (const key of String(refs).split("\n").filter(Boolean)) {
    if (!present.has(`${key}.age`) || !shaOf(key)) bad++;
    // Rápido (diário): só presença. Completo (mensal): baixa e confere o hash de cada blob.
    else if (!quick && sha256(get(`blobs/${key}.age`)) !== shaOf(key)) bad++;
  }
  if (bad) fail(`ponto ${stamp}: ${bad} blobs ausentes${quick ? "" : " ou corrompidos"}`);
  console.log(`[repo] ponto ${stamp} íntegro${quick ? " (rápido: presença, sem baixar os blobs)" : ""}: ${ok.files} arquivos`);
}

function fetchPoint(which, work) {
  const stamp = pick(which);
  const { archive } = checkedSnapshot(stamp);
  mkdirSync(work, { recursive: true });
  run("tar", ["-C", work, "-xzf", "-"], decrypt(archive));
  const files = JSON.parse(readFileSync(join(work, "storage", "manifest.json"), "utf8"));
  // Tudo conferido ANTES de qualquer escrita no destino.
  const recorded = JSON.parse(readFileSync(join(work, "storage", "missing-refs.json"), "utf8"));
  const missing = missingRefs(work, files);
  if (missing.length || recorded.length)
    fail(`ponto ${stamp}: ${Math.max(missing.length, recorded.length)} referências do banco sem arquivo — nada foi restaurado`);
  writeFileSync(join(work, "expected-missing-refs.txt"), "0");
  const bad = checkBlobs(files);
  if (bad) fail(`ponto ${stamp}: ${bad} blobs ausentes ou corrompidos — nada foi restaurado`);
  const out = [];
  for (const f of files) {
    const plain = decrypt(get(`blobs/${f.blob}.age`));
    if (plain.length !== f.size) fail(`ponto ${stamp}: tamanho de arquivo não confere — nada foi restaurado`);
    const target = join(work, "storage", f.bucket, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, plain);
    out.push({ bucket: f.bucket, path: f.path, size: plain.length, contentType: f.contentType, sha256: sha256(plain) });
  }
  writeFileSync(join(work, "storage", "files.json"), JSON.stringify(out));
  writeFileSync(join(work, "point.txt"), stamp);
  console.log(`[repo] ponto ${stamp} aberto: ${out.length} arquivos conferidos`);
}

function stampTime(s) {
  return Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`);
}

function prune(days) {
  const limit = Date.now() - Number(days) * 86_400_000;
  const points = complete();
  if (!points.length) fail("nenhum ponto completo: nada é apagado");
  // Sempre fica o ponto mais novo, mesmo que velho (backup parado não apaga tudo).
  const keep = points.filter((s, i) => stampTime(s) >= limit || i === points.length - 1);
  const drop = points.filter((s) => !keep.includes(s));
  // Blobs em uso: os .refs dos pontos mantidos, cada um conferido com o seu .ok.
  const used = new Set();
  for (const s of keep) {
    const ok = JSON.parse(String(get(`snapshots/${s}.ok`)));
    const refs = (() => {
      try {
        return get(`snapshots/${s}.refs`);
      } catch {
        return null;
      }
    })();
    if (!refs || sha256(refs) !== ok.refs) fail(`ponto ${s}: .refs ausente ou adulterado — retenção suspensa (rode rebuild-refs)`);
    for (const k of String(refs).split("\n").filter(Boolean)) used.add(k);
  }
  for (const s of drop) for (const ext of [".ok", ".refs", ".tar.gz.age"]) del(`snapshots/${s}${ext}`);
  // Pontos .incomplete ficam para diagnóstico pelo mesmo prazo e depois saem; não
  // contam como "mais novo" nem protegem blobs. Sobras de backup interrompido (sem
  // marcador nenhum) saem após 1 dia.
  const broken = incomplete();
  const files = list("snapshots");
  for (const f of files) {
    const s = f.name.replace(/\.(ok|incomplete|refs|tar\.gz\.age)$/, "");
    if (keep.includes(s)) continue;
    const expired = broken.includes(s) ? stampTime(s) < limit : f.modTime < Date.now() - 86_400_000;
    if (expired) del(`snapshots/${f.name}`);
  }
  // Blob sem uso só sai se também for velho: um backup em andamento pode tê-lo acabado de enviar.
  let removed = 0;
  for (const f of list("blobs")) {
    const key = f.name.replace(/\.age(\.sha256)?$/, "");
    if (!used.has(key) && f.modTime < limit) {
      del(`blobs/${f.name}`);
      if (f.name.endsWith(".age")) removed++;
    }
  }
  const brokenKept = broken.filter((s) => stampTime(s) >= limit).length;
  console.log(`[repo] retenção de ${days} dias: ${keep.length} pontos mantidos, ${drop.length} apagados, ${removed} blobs sem uso apagados; ${brokenKept} incompletos guardados para diagnóstico`);
}

function rebuildRefs() {
  let rebuilt = 0;
  for (const s of complete()) {
    const { archive } = checkedSnapshot(s);
    const dir = mkdtempSync(join(scratch, "rb-"));
    run("tar", ["-C", dir, "-xzf", "-", "./storage/manifest.json"], decrypt(archive));
    const files = JSON.parse(readFileSync(join(dir, "storage", "manifest.json"), "utf8"));
    const refs = Buffer.from(`${[...new Set(files.map((f) => f.blob))].sort().join("\n")}\n`);
    const ok = JSON.parse(String(get(`snapshots/${s}.ok`)));
    if (sha256(refs) !== ok.refs) fail(`ponto ${s}: manifesto não bate com o .ok`);
    put(`snapshots/${s}.refs`, refs);
    rebuilt++;
  }
  console.log(`[repo] .refs refeitos: ${rebuilt}`);
}

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === "store-files" && a) await storeFiles(a);
  else if (cmd === "seal" && a && b) seal(a, b);
  else if (cmd === "list") console.log((a === "--incomplete" ? incomplete() : complete()).join("\n"));
  else if (cmd === "missing" && a) {
    if (!incomplete().includes(a)) fail(`ponto ${a} não está marcado como incompleto`);
    const dir = mkdtempSync(join(scratch, "mi-"));
    run("tar", ["-C", dir, "-xzf", "-", "./storage/missing-refs.json"], decrypt(get(`snapshots/${a}.tar.gz.age`)));
    for (const k of JSON.parse(readFileSync(join(dir, "storage", "missing-refs.json"), "utf8"))) console.log(k);
  }
  else if (cmd === "verify" && a) verify(a, b === "--quick");
  else if (cmd === "fetch" && a && b) fetchPoint(a, b);
  else if (cmd === "prune" && a) prune(a);
  else if (cmd === "rebuild-refs") rebuildRefs();
  else fail("uso: store-files <trab> | seal <trab> <data> | list | verify <data|latest> | fetch <data|latest> <trab> | prune <dias> | rebuild-refs");
} catch (err) {
  fail(err.message);
}
