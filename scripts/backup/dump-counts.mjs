// Linhas por tabela DENTRO do data.sql (blocos COPY … FROM stdin; … \.).
// Conta o que o dump realmente tem: uma contagem separada no banco vivo poderia
// divergir (alguém escreveu entre o dump e a contagem).
// Uso: node dump-counts.mjs <data.sql>  →  "schema.tabela,linhas" por linha.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const counts = new Map();
let current = null;
const unquote = (s) => s.replace(/^"|"$/g, "").replace(/""/g, '"');
for await (const line of createInterface({ input: createReadStream(process.argv[2]), crlfDelay: Infinity })) {
  if (current) {
    if (line === "\\.") current = null;
    else counts.set(current, counts.get(current) + 1);
    continue;
  }
  const m = /^COPY\s+((?:"(?:[^"]|"")+"|[^\s.]+))\.((?:"(?:[^"]|"")+"|[^\s(]+))\s.*FROM stdin;$/.exec(line);
  if (m) {
    current = `${unquote(m[1])}.${unquote(m[2])}`;
    counts.set(current, 0);
  }
}
for (const [t, n] of [...counts].sort(([a], [b]) => (a < b ? -1 : 1))) console.log(`${t},${n}`);
