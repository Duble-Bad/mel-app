// Dá (ou tira) o papel de moderação a uma conta. Só o dono do projeto roda,
// com a chave secreta do .env.local:
//   npm run admin:role -- pessoa@exemplo.com moderator   (ou admin / user)
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
if (existsSync(resolve(root, ".env.local"))) process.loadEnvFile(resolve(root, ".env.local"));
const { createClient } = createRequire(resolve(root, "packages/data/package.json"))("@supabase/supabase-js");

const [email, role = "moderator"] = process.argv.slice(2);
if (!email || !["user", "moderator", "admin"].includes(role)) {
  console.error("Uso: npm run admin:role -- <email> <user|moderator|admin>");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
let user;
for (let page = 1; page <= 50 && !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 1000) break;
}
if (!user) {
  console.error(`Nenhuma conta com o e-mail ${email}.`);
  process.exit(1);
}
const { error } = await admin.from("profiles").update({ role }).eq("id", user.id);
if (error) throw error;
console.log(`✓ ${email} agora é "${role}".`);
