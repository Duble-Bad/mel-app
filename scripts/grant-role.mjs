// Dá (ou tira) o papel de moderação a uma conta EXISTENTE. Só o dono do projeto
// roda, com a chave secreta do .env.local. Nunca cria conta.
//
//   npm run admin:role -- pessoa@exemplo.com admin             → só mostra o que mudaria
//   npm run admin:role -- pessoa@exemplo.com admin --aplicar   → aplica (e confere depois)
//
// Papéis: user | moderator | admin. Fora do Supabase local/dev listado em
// MEL_SAFE_TARGET_REFS: acrescente --confirm-target=<ref do projeto>.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { assertAdminTarget } from "./lib/safe-target.mjs";

const root = resolve(import.meta.dirname, "..");
if (existsSync(resolve(root, ".env.local"))) process.loadEnvFile(resolve(root, ".env.local"));
const { createClient } = createRequire(resolve(root, "packages/data/package.json"))("@supabase/supabase-js");

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const [email, role = "moderator"] = args.filter((a) => !a.startsWith("--"));
if (!email || !["user", "moderator", "admin"].includes(role)) {
  console.error("Uso: npm run admin:role -- <email> <user|moderator|admin> [--aplicar]");
  process.exit(1);
}
// Fora do local/dev listado, exige --confirm-target=<ref exato> (ação deliberada).
assertAdminTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, "admin:role");
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

let user;
for (let page = 1; page <= 50 && !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 1000) break;
}
if (!user) {
  console.error(`Nenhuma conta com o e-mail ${email} (este script não cria contas).`);
  process.exit(1);
}
const read = async () => {
  const { data, error } = await admin.from("profiles").select("role, display_name").eq("id", user.id).single();
  if (error) throw error;
  return data;
};
const before = await read();
const masked = email.replace(/^(.{3}).*(@.*)$/, "$1***$2");
console.log(`Projeto: ${ref.slice(0, 4)}… · conta: ${masked} (${before.display_name ?? "sem nome"}, login ${user.app_metadata?.provider ?? "?"})`);
console.log(`Papel: ${before.role} → ${role}`);
if (before.role === role) {
  console.log("Nada a mudar.");
  process.exit(0);
}
if (!apply) {
  console.log("Prévia: nada foi alterado. Para aplicar, repita com --aplicar.");
  process.exit(0);
}
const { error } = await admin.from("profiles").update({ role }).eq("id", user.id);
if (error) throw error;
const after = await read();
if (after.role !== role) throw new Error(`O papel não mudou (ficou "${after.role}").`);
console.log(`✓ ${masked} agora é "${role}". Para desfazer: npm run admin:role -- ${email} ${before.role} --aplicar`);
