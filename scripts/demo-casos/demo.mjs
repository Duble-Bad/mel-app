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
// - Sem fotos de animais ou pessoas: as imagens são ILUSTRAÇÕES geradas aqui (desenho
//   vetorial simples de cão/gato com a faixa "DEMONSTRAÇÃO" e "não é um animal real"),
//   obra própria, sem direitos de terceiros. Quantidades respeitam os limites do app:
//   perdido 1, 2 e 6 (máx. 6 por pet); encontrado/visto 1 (máx. 1); adoção 4 e 1 (máx. 4).
//   Formatos variados (paisagem, retrato, quadrado, panorâmico) para conferir o recorte.
// - Inseridos com gatilhos desligados (session_replication_role = replica): nenhum aviso,
//   push, correspondência do Radar ou contato é gerado. Os campos que os gatilhos
//   calculariam (ponto público aproximado, códigos, datas) são calculados aqui com as
//   mesmas funções do banco.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp"; // já instalado (dependência do Next.js)
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
    { name: "DEMO Pipoca", species: "dog", size: "small", sex: "female", color: "caramelo", area: "Penha, São Paulo – SP", lat: -23.5262, lng: -46.542, when: ago(2 * 24 * H), wearing: ["collar"], photos: 1 },
    { name: "DEMO Frajola", species: "cat", size: "small", sex: "male", color: "preto e branco", area: "Vila Esperança, São Paulo – SP", lat: -23.5206, lng: -46.5335, when: ago(5 * 24 * H), wearing: [], photos: 2 },
    { name: "DEMO Thor", species: "dog", size: "large", sex: "male", color: "preto", area: "Pinheiros, São Paulo – SP", lat: -23.5617, lng: -46.6919, when: ago(12 * 24 * H), wearing: ["harness", "tag"], photos: 6 },
  ],
  found: [
    { species: "dog", size: "medium", sex: "male", color: "branco", area: "Mooca, São Paulo – SP", lat: -23.5587, lng: -46.5996, when: ago(24 * H), custody: "with_me", photos: 1 },
    { species: "cat", size: "small", sex: "unknown", color: "cinza", area: "Penha de França, São Paulo – SP", lat: -23.53, lng: -46.548, when: ago(3 * 24 * H), custody: "with_me", photos: 1 },
  ],
  // "Visto" no modelo atual = encontrado com custody 'street' (visto solto na rua).
  sighting: [
    { species: "dog", size: "small", sex: "unknown", color: "marrom", area: "Tatuapé, São Paulo – SP", lat: -23.5404, lng: -46.5765, when: ago(6 * H), custody: "street", photos: 1 },
    { species: "dog", size: "large", sex: "unknown", color: "caramelo", area: "Santana, São Paulo – SP", lat: -23.5009, lng: -46.6252, when: ago(4 * 24 * H), custody: "street", photos: 0 },
  ],
  adoption: [
    { name: "DEMO Amora", species: "dog", size: "medium", sex: "female", months: 24, color: "tricolor", area: "Vila Mariana, São Paulo – SP", lat: -23.5893, lng: -46.6346, photos: 4 },
    { name: "DEMO Mingau", species: "cat", size: "small", sex: "male", months: 6, color: "branco", area: "Penha, São Paulo – SP", lat: -23.525, lng: -46.546, photos: 1 },
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

// Cores aproximadas da pelagem (só para a ilustração).
const FUR = { caramelo: "#d9954a", "preto e branco": "#2b2b2b", preto: "#262626", branco: "#f1efe9", cinza: "#9aa1a9", marrom: "#7a4b2a", tricolor: "#c47a3a" };
const BGS = ["#1f3a5f", "#3b2f5c", "#24524a", "#5a3a22", "#1d4e6b", "#4a2c40"];
const SHAPES = [[1280, 960], [960, 1280], [1080, 1080], [1600, 900], [1280, 960], [960, 1280]];

/** Ilustração de DEMONSTRAÇÃO (SVG → JPEG): cão ou gato desenhado, nunca uma foto. */
async function demoImage({ species, color, title }, n, total) {
  const [w, h] = SHAPES[n % SHAPES.length];
  const fur = FUR[color] ?? "#c98a3f";
  // Área segura = o que sobra em TODOS os recortes do app: quadrado (página do caso, miniaturas)
  // e faixa larga ~1,8:1 (painel do mapa no celular). Faixas e rosto ficam só nela.
  const sw = Math.min(w, h);
  const sh = Math.min(h, w / 1.8);
  const top = (h - sh) / 2;
  const u = Math.min(sh / 600, sw / 860);
  const bandTop = 84 * u, bandBottom = 104 * u;
  const cx = w / 2;
  const cy = top + bandTop + (sh - bandTop - bandBottom) / 2 + 12 * u;
  const s = (u * 140) / 230; // escala do desenho (rosto com raio de 140u)
  const ears = species === "cat"
    ? `<path d="M${cx - 230 * s} ${cy - 120 * s} L${cx - 170 * s} ${cy - 310 * s} L${cx - 60 * s} ${cy - 200 * s}Z M${cx + 230 * s} ${cy - 120 * s} L${cx + 170 * s} ${cy - 310 * s} L${cx + 60 * s} ${cy - 200 * s}Z" fill="${fur}" stroke="#111" stroke-width="${6 * s}"/>`
    : `<ellipse cx="${cx - 215 * s}" cy="${cy - 40 * s}" rx="${75 * s}" ry="${170 * s}" transform="rotate(18 ${cx - 215 * s} ${cy - 40 * s})" fill="${fur}" stroke="#111" stroke-width="${6 * s}"/><ellipse cx="${cx + 215 * s}" cy="${cy - 40 * s}" rx="${75 * s}" ry="${170 * s}" transform="rotate(-18 ${cx + 215 * s} ${cy - 40 * s})" fill="${fur}" stroke="#111" stroke-width="${6 * s}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${BGS[n % BGS.length]}"/>
    <g opacity="0.12" fill="#fff">${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 157) % w}" cy="${(i * 241) % h}" r="${40 + (i % 4) * 22}"/>`).join("")}</g>
    ${ears}
    <circle cx="${cx}" cy="${cy}" r="${230 * s}" fill="${fur}" stroke="#111" stroke-width="${6 * s}"/>
    <ellipse cx="${cx}" cy="${cy + 95 * s}" rx="${110 * s}" ry="${80 * s}" fill="#f6efe2" opacity="0.9"/>
    <circle cx="${cx - 85 * s}" cy="${cy - 45 * s}" r="${26 * s}" fill="#111"/><circle cx="${cx + 85 * s}" cy="${cy - 45 * s}" r="${26 * s}" fill="#111"/>
    <circle cx="${cx - 77 * s}" cy="${cy - 53 * s}" r="${8 * s}" fill="#fff"/><circle cx="${cx + 93 * s}" cy="${cy - 53 * s}" r="${8 * s}" fill="#fff"/>
    <ellipse cx="${cx}" cy="${cy + 55 * s}" rx="${34 * s}" ry="${24 * s}" fill="#111"/>
    <path d="M${cx} ${cy + 78 * s} q${-30 * s} ${45 * s} ${-70 * s} ${20 * s} M${cx} ${cy + 78 * s} q${30 * s} ${45 * s} ${70 * s} ${20 * s}" fill="none" stroke="#111" stroke-width="${7 * s}" stroke-linecap="round"/>
    <rect x="0" y="${top}" width="${w}" height="${bandTop}" fill="#f6b928"/>
    <text x="${cx}" y="${top + 58 * u}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${48 * u}" fill="#1c1404" letter-spacing="${5 * u}">DEMONSTRAÇÃO</text>
    <rect x="0" y="${top + sh - bandBottom}" width="${w}" height="${bandBottom}" fill="#0a111d" opacity="0.9"/>
    <text x="${cx}" y="${top + sh - 60 * u}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${28 * u}" fill="#ffffff">${title} · imagem ${n + 1} de ${total}</text>
    <text x="${cx}" y="${top + sh - 24 * u}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${22 * u}" fill="#dbe1ea">Ilustração de teste MEL — não é um animal real</text>
  </svg>`;
  const img = sharp(Buffer.from(svg));
  return { full: await img.clone().jpeg({ quality: 82 }).toBuffer(), thumb: await img.clone().resize(320, 320, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer() };
}

async function upload(bucket, path, body) {
  const up = await admin.storage.from(bucket).upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw up.error;
  return path;
}

/** Todos os arquivos da conta demo num bucket (pastas aninhadas). */
async function listAll(bucket, prefix) {
  const out = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) out.push(path);
    else out.push(...(await listAll(bucket, path)));
  }
  return out;
}

async function remove() {
  const u = await demoUser();
  if (!u) return console.log("Nenhuma conta de demonstração.");
  for (const bucket of ["pet-photos", "sighting-media"]) {
    const files = await listAll(bucket, u.id);
    if (files.length) await admin.storage.from(bucket).remove(files);
  }
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
  const label = (c, fallback) => `DEMO ${c.name?.replace(/^DEMO /, "") ?? fallback}`;
  // Imagens primeiro (ilustrações, ver o cabeçalho); as linhas do banco só apontam para elas.
  const lostPhotos = [];
  for (const c of CASES.lost) {
    const petId = crypto.randomUUID();
    const files = [];
    for (let n = 0; n < c.photos; n++) {
      const img = await demoImage({ ...c, title: label(c) }, n, c.photos);
      const base = `${id}/${petId}/demo-${n + 1}`;
      files.push({ full: await upload("pet-photos", `${base}.jpg`, img.full), thumb: await upload("pet-photos", `${base}-thumb.jpg`, img.thumb) });
    }
    lostPhotos.push({ petId, files });
  }
  const foundPhotos = [];
  for (const c of [...CASES.found, ...CASES.sighting]) {
    const title = label(c, c.custody === "street" ? "Visto" : "Encontrado");
    foundPhotos.push(c.photos ? await upload("sighting-media", `${id}/demo-${crypto.randomUUID()}.jpg`, (await demoImage({ ...c, title }, 0, 1)).full) : null);
  }
  const adoptionPhotos = [];
  for (const c of CASES.adoption) {
    const paths = [];
    for (let n = 0; n < c.photos; n++) paths.push(await upload("pet-photos", `${id}/adocao/demo-${crypto.randomUUID()}.jpg`, (await demoImage({ ...c, title: label(c) }, n, c.photos)).full));
    adoptionPhotos.push(paths);
  }
  const stmts = [
    "begin;",
    // Sem gatilhos: nenhum aviso, push, Radar ou contato (ver o cabeçalho).
    "set local session_replication_role = replica;",
    `update public.profiles set display_name = 'DEMONSTRAÇÃO MEL (teste)', city = 'São Paulo', state = 'SP', onboarded_at = now() where id = ${lit(id)};`,
  ];
  for (const [i, c] of CASES.lost.entries()) {
    const { petId, files } = lostPhotos[i];
    stmts.push(`with p as (insert into public.pets (id, owner_id, mel_id, name, species, size, sex, color_primary, description, city, state, is_public)
      values (${lit(petId)}, ${lit(id)}, private.generate_mel_id(), ${lit(c.name)}, ${lit(c.species)}, ${lit(c.size)}, ${lit(c.sex)}, ${lit(c.color)}, ${lit(NOTE)}, 'São Paulo', 'SP', true) returning id)
    insert into public.lost_cases (pet_id, owner_id, short_code, status, last_seen_lat, last_seen_lng, last_seen_label, public_point_exact, public_lat, public_lng, public_area_label,
      city, state, lost_at, lost_at_uncertain, wearing, notes, contact_chat, contact_whatsapp_public, contact_phone_public, indexable, published_at, created_at, updated_at)
    select p.id, ${lit(id)}, private.generate_short_code(), 'ACTIVE', ${c.lat}, ${c.lng}, ${lit(c.area)}, false, f.fuzzed_lat, f.fuzzed_lng, ${lit(c.area)},
      'São Paulo', 'SP', ${lit(c.when)}, false, ${arr(c.wearing)}, ${lit(NOTE)}, true, false, false, false, ${lit(c.when)}, ${lit(c.when)}, ${lit(c.when)}
      from p, private.fuzz_lat_lng(${c.lat}, ${c.lng}) f;`);
    files.forEach((p, n) =>
      stmts.push(`insert into public.pet_photos (pet_id, owner_id, storage_path, thumb_path, is_primary, position) values (${lit(petId)}, ${lit(id)}, ${lit(p.full)}, ${lit(p.thumb)}, ${n === 0}, ${n});`),
    );
  }
  for (const [i, c] of [...CASES.found, ...CASES.sighting].entries()) {
    stmts.push(`insert into public.found_cases (reporter_id, short_code, status, species, sex, size, color_primary, description, lat, lng, public_lat, public_lng, public_area_label, found_at, custody, photo_path, created_at)
    select ${lit(id)}, private.generate_found_code(), 'ACTIVE', ${lit(c.species)}, ${lit(c.sex)}, ${lit(c.size)}, ${lit(c.color)}, ${lit(NOTE)}, ${c.lat}, ${c.lng}, f.fuzzed_lat, f.fuzzed_lng, ${lit(c.area)}, ${lit(c.when)}, ${lit(c.custody)}, ${lit(foundPhotos[i])}, ${lit(c.when)}
      from private.fuzz_lat_lng(${c.lat}, ${c.lng}) f;`);
  }
  for (const [i, c] of CASES.adoption.entries()) {
    stmts.push(`insert into public.adoption_listings (owner_id, short_code, status, name, species, sex, size, age_months, color_primary, description, lat, lng, public_lat, public_lng, public_area_label, photo_paths, published_at)
    select ${lit(id)}, private.generate_adoption_code(), 'AVAILABLE', ${lit(c.name)}, ${lit(c.species)}, ${lit(c.sex)}, ${lit(c.size)}, ${c.months}, ${lit(c.color)}, ${lit(`${NOTE} Imagens: ilustrações de demonstração, não é um animal real.`)}, ${c.lat}, ${c.lng}, f.fuzzed_lat, f.fuzzed_lng, ${lit(c.area)}, ${arr(adoptionPhotos[i])}, now()
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
