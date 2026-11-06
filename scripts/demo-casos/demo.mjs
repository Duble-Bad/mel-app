// Casos de DEMONSTRAÇÃO controlados no Supabase de DESENVOLVIMENTO (autorizado pelo
// proprietário em 2026-11-06). Nunca roda fora do mel-dev.
//
//   node --env-file=.env.local scripts/demo-casos/demo.mjs criar    → recria os 9 casos (idempotente)
//   node --env-file=.env.local scripts/demo-casos/demo.mjs listar   → o que existe hoje
//   node --env-file=.env.local scripts/demo-casos/demo.mjs remover  → apaga a conta demo e tudo dela (antes do piloto)
//
// Regras:
// - Tudo pertence a UMA conta marcada (app_metadata.mel_demo = true, e-mail fixo abaixo);
//   remover a conta remove todos os casos em cascata.
// - Nomes e textos começam com "DEMO" e dizem que não são casos reais.
// - Sem fotos de animais: os casos ficam com a patinha; a adoção (que exige imagem) usa
//   um cartaz gráfico "DEMONSTRAÇÃO — sem foto real".
// - Inseridos com gatilhos desligados (session_replication_role = replica): nenhum aviso,
//   push, correspondência do Radar ou contato é gerado. Os campos que os gatilhos
//   calculariam (ponto público aproximado, códigos, datas) são calculados aqui com as
//   mesmas funções do banco.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { assertSafeTarget } from "../lib/safe-target.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assertSafeTarget(url, "casos de demonstração");
if (readFileSync(join(ROOT, "supabase/.temp/project-ref"), "utf8").trim() !== "oezycoghvjqefycgtyxp") throw new Error("[trava] projeto vinculado não é o mel-dev.");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

export const DEMO_EMAIL = "demo.casos@exemplo.com";
const NOTE = "DEMONSTRAÇÃO — registro de teste da equipe MEL, não é um caso real.";

const H = 3_600_000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
// Bairros de São Paulo (3 na Penha, para testar o GPS).
const CASES = {
  lost: [
    { name: "DEMO Pipoca", species: "dog", size: "small", sex: "female", color: "caramelo", area: "Penha, São Paulo – SP", lat: -23.5262, lng: -46.542, when: ago(2 * 24 * H), wearing: ["collar"] },
    { name: "DEMO Frajola", species: "cat", size: "small", sex: "male", color: "preto e branco", area: "Vila Esperança, São Paulo – SP", lat: -23.5206, lng: -46.5335, when: ago(5 * 24 * H), wearing: [] },
    { name: "DEMO Thor", species: "dog", size: "large", sex: "male", color: "preto", area: "Pinheiros, São Paulo – SP", lat: -23.5617, lng: -46.6919, when: ago(12 * 24 * H), wearing: ["harness", "tag"] },
  ],
  found: [
    { species: "dog", size: "medium", sex: "male", color: "branco", area: "Mooca, São Paulo – SP", lat: -23.5587, lng: -46.5996, when: ago(24 * H), custody: "with_me" },
    { species: "cat", size: "small", sex: "unknown", color: "cinza", area: "Penha de França, São Paulo – SP", lat: -23.53, lng: -46.548, when: ago(3 * 24 * H), custody: "with_me" },
  ],
  // "Visto" no modelo atual = encontrado com custody 'street' (visto solto na rua).
  sighting: [
    { species: "dog", size: "small", sex: "unknown", color: "marrom", area: "Tatuapé, São Paulo – SP", lat: -23.5404, lng: -46.5765, when: ago(6 * H), custody: "street" },
    { species: "dog", size: "large", sex: "unknown", color: "caramelo", area: "Santana, São Paulo – SP", lat: -23.5009, lng: -46.6252, when: ago(4 * 24 * H), custody: "street" },
  ],
  adoption: [
    { name: "DEMO Amora", species: "dog", size: "medium", sex: "female", months: 24, color: "tricolor", area: "Vila Mariana, São Paulo – SP", lat: -23.5893, lng: -46.6346 },
    { name: "DEMO Mingau", species: "cat", size: "small", sex: "male", months: 6, color: "branco", area: "Penha, São Paulo – SP", lat: -23.525, lng: -46.546 },
  ],
};

function sql(text) {
  const dir = join(homedir(), ".mel-dev-backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `.demo-${process.pid}.sql`);
  writeFileSync(file, text);
  const raw = execFileSync("npx", ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", file], {
    cwd: ROOT, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64e6, stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows ?? [];
}
const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const arr = (a) => `array[${a.map(lit).join(",")}]::text[]`;

async function demoUser() {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === DEMO_EMAIL && x.app_metadata?.mel_demo === true);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Cartaz PNG "DEMO" (faixas diagonais âmbar/cinza) — gráfico, não foto de animal. */
function demoPoster(w = 480, h = 360) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const stripe = Math.floor((x + y) / 24) % 2 === 0;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      [raw[o], raw[o + 1], raw[o + 2]] = stripe ? [246, 185, 40] : [40, 48, 62];
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function remove() {
  const u = await demoUser();
  if (!u) return console.log("Nenhuma conta de demonstração.");
  const { data: files } = await admin.storage.from("pet-photos").list(`${u.id}/adocao`);
  if (files?.length) await admin.storage.from("pet-photos").remove(files.map((f) => `${u.id}/adocao/${f.name}`));
  const { error } = await admin.auth.admin.deleteUser(u.id); // cascata: perfil, pets, alertas, encontrados, adoções
  if (error) throw error;
  console.log(`Conta de demonstração ${u.id} removida, com todos os casos.`);
}

async function create() {
  await remove(); // idempotente: sempre recria do zero
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: `Demo-${crypto.randomUUID()}`,
    email_confirm: true,
    app_metadata: { mel_demo: true },
  });
  if (error) throw error;
  const id = data.user.id;
  const photos = [];
  for (const [i] of CASES.adoption.entries()) {
    const path = `${id}/adocao/demo-sem-foto-${i + 1}.png`;
    const up = await admin.storage.from("pet-photos").upload(path, demoPoster(), { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    photos.push(path);
  }
  const stmts = [
    "begin;",
    // Sem gatilhos: nenhum aviso, push, Radar ou contato (ver o cabeçalho).
    "set local session_replication_role = replica;",
    `update public.profiles set display_name = 'DEMONSTRAÇÃO MEL (teste)', city = 'São Paulo', state = 'SP', onboarded_at = now() where id = ${lit(id)};`,
  ];
  for (const c of CASES.lost) {
    stmts.push(`with p as (insert into public.pets (owner_id, mel_id, name, species, size, sex, color_primary, description, city, state, is_public)
      values (${lit(id)}, private.generate_mel_id(), ${lit(c.name)}, ${lit(c.species)}, ${lit(c.size)}, ${lit(c.sex)}, ${lit(c.color)}, ${lit(NOTE)}, 'São Paulo', 'SP', true) returning id)
    insert into public.lost_cases (pet_id, owner_id, short_code, status, last_seen_lat, last_seen_lng, last_seen_label, public_point_exact, public_lat, public_lng, public_area_label,
      city, state, lost_at, lost_at_uncertain, wearing, notes, contact_chat, contact_whatsapp_public, contact_phone_public, indexable, published_at, created_at, updated_at)
    select p.id, ${lit(id)}, private.generate_short_code(), 'ACTIVE', ${c.lat}, ${c.lng}, ${lit(c.area)}, false, f.fuzzed_lat, f.fuzzed_lng, ${lit(c.area)},
      'São Paulo', 'SP', ${lit(c.when)}, false, ${arr(c.wearing)}, ${lit(NOTE)}, true, false, false, false, ${lit(c.when)}, ${lit(c.when)}, ${lit(c.when)}
      from p, private.fuzz_lat_lng(${c.lat}, ${c.lng}) f;`);
  }
  for (const c of [...CASES.found, ...CASES.sighting]) {
    stmts.push(`insert into public.found_cases (reporter_id, short_code, status, species, sex, size, color_primary, description, lat, lng, public_lat, public_lng, public_area_label, found_at, custody, created_at)
    select ${lit(id)}, private.generate_found_code(), 'ACTIVE', ${lit(c.species)}, ${lit(c.sex)}, ${lit(c.size)}, ${lit(c.color)}, ${lit(NOTE)}, ${c.lat}, ${c.lng}, f.fuzzed_lat, f.fuzzed_lng, ${lit(c.area)}, ${lit(c.when)}, ${lit(c.custody)}, ${lit(c.when)}
      from private.fuzz_lat_lng(${c.lat}, ${c.lng}) f;`);
  }
  for (const [i, c] of CASES.adoption.entries()) {
    stmts.push(`insert into public.adoption_listings (owner_id, short_code, status, name, species, sex, size, age_months, color_primary, description, lat, lng, public_lat, public_lng, public_area_label, photo_paths, published_at)
    select ${lit(id)}, private.generate_adoption_code(), 'AVAILABLE', ${lit(c.name)}, ${lit(c.species)}, ${lit(c.sex)}, ${lit(c.size)}, ${c.months}, ${lit(c.color)}, ${lit(`${NOTE} Imagem: cartaz de demonstração, sem foto real.`)}, ${c.lat}, ${c.lng}, f.fuzzed_lat, f.fuzzed_lng, ${lit(c.area)}, ${arr([photos[i]])}, now()
      from private.fuzz_lat_lng(${c.lat}, ${c.lng}) f;`);
  }
  stmts.push("commit;");
  sql(stmts.join("\n"));
  await list();
}

async function list() {
  const u = await demoUser();
  if (!u) return console.log("Nenhuma conta de demonstração.");
  const [r] = sql(`select
    (select count(*) from public.lost_cases where owner_id = ${lit(u.id)} and status = 'ACTIVE')::int as perdidos,
    (select count(*) from public.found_cases where reporter_id = ${lit(u.id)} and custody <> 'street' and status = 'ACTIVE')::int as encontrados,
    (select count(*) from public.found_cases where reporter_id = ${lit(u.id)} and custody = 'street' and status = 'ACTIVE')::int as vistos,
    (select count(*) from public.adoption_listings where owner_id = ${lit(u.id)} and status = 'AVAILABLE')::int as adocao,
    (select count(*) from public.notifications n where n.created_at > now() - interval '1 hour' and n.user_id <> ${lit(u.id)})::int as avisos_para_outros_ultima_hora,
    (select count(*) from public.case_matches m join public.lost_cases l on l.id = m.lost_case_id where l.owner_id = ${lit(u.id)})::int as radar,
    (select count(*) from public.push_outbox o where o.user_id = ${lit(u.id)})::int as push_demo`);
  console.log(`Conta de demonstração ${u.id}:`, r);
}

const mode = process.argv[2];
if (mode === "criar") await create();
else if (mode === "remover") await remove();
else if (mode === "listar") await list();
else console.log("Uso: demo.mjs criar | listar | remover");
