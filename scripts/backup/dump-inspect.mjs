// Lê o data.sql (blocos COPY … FROM stdin; … \.) e devolve, do PRÓPRIO dump:
//   dump-counts.csv  linhas por tabela ("schema.tabela,linhas")
//   dump-refs.json   arquivos do Storage que o banco referencia ([{ bucket, path }])
// Uma consulta separada no banco vivo poderia divergir do dump (alguém escreveu no meio).
// Uso: node dump-inspect.mjs <data.sql> <pasta de saída> <URL do projeto de origem>
import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";

const [file, out, sourceUrl] = process.argv.slice(2);
if (!file || !out || !sourceUrl) {
  console.error("uso: dump-inspect.mjs <data.sql> <pasta> <url de origem>");
  process.exit(2);
}

// Colunas que guardam caminhos do Storage (o mesmo mapa de storage.mjs check).
const MEDIA = {
  "public.pet_photos": { storage_path: "pet-photos", thumb_path: "pet-photos" },
  "public.adoption_listings": { photo_paths: "pet-photos[]" },
  "public.businesses": { logo_path: "pet-photos" },
  "public.sightings": { photo_path: "sighting-media" },
  "public.found_cases": { photo_path: "sighting-media" },
  "public.profiles": { avatar_url: "avatars-url" },
};
const AVATAR_PREFIX = `${sourceUrl.replace(/\/$/, "")}/storage/v1/object/public/avatars/`;

const unquote = (s) => s.replace(/^"|"$/g, "").replace(/""/g, '"');
// Formato texto do COPY: \N é nulo; barras escapam tab, quebra de linha e a própria barra.
const field = (s) => (s === "\\N" ? null : s.replace(/\\(.)/g, (_, c) => ({ t: "\t", n: "\n", r: "\r", "\\": "\\" })[c] ?? c));
// Array de texto do Postgres: {a,b} ou {"a b",c}.
const pgArray = (s) =>
  s
    .replace(/^\{|\}$/g, "")
    .match(/"(?:[^"\\]|\\.)*"|[^,]+/g)
    ?.map((x) => x.replace(/^"|"$/g, "").replace(/\\(.)/g, "$1")) ?? [];

const counts = new Map();
const refs = new Map();
let table = null;
let columns = [];
for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
  if (table) {
    if (line === "\\.") {
      table = null;
      continue;
    }
    counts.set(table, counts.get(table) + 1);
    const media = MEDIA[table];
    if (!media) continue;
    const values = line.split("\t");
    columns.forEach((col, i) => {
      const kind = media[col];
      const v = kind ? field(values[i] ?? "\\N") : null;
      if (!v) return;
      if (kind === "pet-photos[]") for (const p of pgArray(v)) refs.set(`pet-photos/${p}`, { bucket: "pet-photos", path: p });
      else if (kind === "avatars-url") {
        if (v.startsWith(AVATAR_PREFIX)) {
          const p = decodeURIComponent(v.slice(AVATAR_PREFIX.length).split("?")[0]);
          refs.set(`avatars/${p}`, { bucket: "avatars", path: p });
        }
      } else refs.set(`${kind}/${v}`, { bucket: kind, path: v });
    });
    continue;
  }
  const m = /^COPY\s+((?:"(?:[^"]|"")+"|[^\s.]+))\.((?:"(?:[^"]|"")+"|[^\s(]+))\s*(?:\((.*)\))?\s*FROM stdin;$/.exec(line);
  if (m) {
    table = `${unquote(m[1])}.${unquote(m[2])}`;
    columns = (m[3] ?? "").split(",").map((c) => unquote(c.trim()));
    counts.set(table, 0);
  }
}
writeFileSync(join(out, "dump-counts.csv"), [...counts].sort(([a], [b]) => (a < b ? -1 : 1)).map(([t, n]) => `${t},${n}\n`).join(""));
writeFileSync(join(out, "dump-refs.json"), JSON.stringify([...refs.values()]));
console.log(`[dump] ${counts.size} tabelas; ${refs.size} arquivos referenciados pelo banco`);
