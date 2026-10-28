// Diagnóstico: usuários com identidade Google e seus profiles.
// Uso: node scripts/inspect-google-users.mjs   (lê .env.local; e-mails mascarados)
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const mask = (email = "") => email.replace(/^(.{2}).*(@.*)$/, "$1***$2");

const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
// A listagem nem sempre traz `identities`; `app_metadata.providers` é confiável.
const providersOf = (u) => u.app_metadata?.providers ?? u.identities?.map((i) => i.provider) ?? [];
const google = data.users.filter((u) => providersOf(u).includes("google"));

const ids = google.map((u) => u.id);
const { data: profiles } = ids.length
  ? await admin.from("profiles").select("id, display_name, avatar_url, onboarded_at, is_anonymous").in("id", ids)
  : { data: [] };

console.log(`Usuários Google: ${google.length}`);
for (const u of google) {
  const rows = profiles.filter((p) => p.id === u.id);
  console.log(
    JSON.stringify({
      id: u.id,
      email: mask(u.email),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      providers: providersOf(u),
      profiles: rows.length,
      display_name: rows[0]?.display_name ?? null,
      has_avatar: Boolean(rows[0]?.avatar_url),
      onboarded: Boolean(rows[0]?.onboarded_at),
      is_anonymous: rows[0]?.is_anonymous ?? null,
    }),
  );
}
