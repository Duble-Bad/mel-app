// Preenche .env.local com URL e chaves do projeto Supabase linkado,
// sem imprimir nenhum valor no terminal.
// Uso: npm run env:pull   (requer `supabase login` e `supabase link`)
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error("project-ref inválido. Rode `supabase link` primeiro.");
const raw = execSync(`npx supabase projects api-keys --project-ref ${ref} --reveal -o json`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const keys = JSON.parse(raw);
const find = (type) => keys.find((k) => k.type === type)?.api_key;

const values = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: find("publishable"),
  SUPABASE_SECRET_KEY: find("secret"),
};
for (const [name, value] of Object.entries(values)) {
  if (!value) throw new Error(`Não encontrei ${name} no projeto ${ref}.`);
}

const lines = existsSync(".env.local") ? readFileSync(".env.local", "utf8").split(/\r?\n/) : [];
const kept = lines.filter((line) => !Object.keys(values).some((name) => line.startsWith(`${name}=`)));
while (kept.length && kept.at(-1) === "") kept.pop();
const next = [...kept, ...Object.entries(values).map(([k, v]) => `${k}=${v}`), ""].join("\n");
writeFileSync(".env.local", next);

console.log(`.env.local atualizado: ${Object.keys(values).join(", ")} (projeto ${ref}).`);
