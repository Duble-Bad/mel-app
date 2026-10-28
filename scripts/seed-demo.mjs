// Dados de demonstração — TODOS FICTÍCIOS.
// Nada de telefones, endereços ou dados pessoais reais (inclusive da família da Mel).
// Idempotente: recria os pets das contas demo a cada execução.
// Uso: npm run db:seed   (projeto de desenvolvimento; lê .env.local)
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url?.includes(".supabase.co")) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente.");

const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const DEMO_USERS = [
  {
    email: "demo.tutora@exemplo.com",
    profile: { display_name: "Clara Demonstração", city: "São Paulo", state: "SP" },
    pets: [
      {
        name: "Mel",
        species: "dog",
        breed: "Yorkshire Terrier",
        sex: "female",
        size: "mini",
        weight_kg: 2.8,
        age_estimate_months: 60,
        color_primary: "caramelo",
        colors_secondary: ["preto"],
        unique_marks: "Pelo comprido e sedoso, lacinho na cabeça, orelhas em pé.",
        description: "Pet demonstrativo. Dócil, um pouco medrosa com barulho, atende pelo nome.",
        neutered: true,
        has_microchip: true,
        city: "São Paulo",
        state: "SP",
        is_public: true,
        private: { hidden_marks: "Exemplo fictício: pequena mancha clara na barriga." },
      },
      {
        name: "Thor",
        species: "dog",
        breed: "SRD",
        sex: "male",
        size: "large",
        age_estimate_months: 36,
        color_primary: "preto",
        colors_secondary: ["branco"],
        unique_marks: "Peito branco, orelha esquerda caída.",
        city: "São Paulo",
        state: "SP",
        is_public: false,
      },
    ],
  },
  {
    email: "demo.vizinho@exemplo.com",
    profile: { display_name: "Rafael Demonstração", city: "Campinas", state: "SP" },
    pets: [
      {
        name: "Nina",
        species: "cat",
        breed: "SRD",
        sex: "female",
        size: "small",
        age_estimate_months: 18,
        color_primary: "tricolor",
        colors_secondary: [],
        unique_marks: "Ponta do rabo branca.",
        city: "Campinas",
        state: "SP",
        is_public: true,
      },
    ],
  },
];

async function findUserByEmail(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user || data.users.length < 200) return user ?? null;
  }
}

async function ensureUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) return existing.id;
  // Senha aleatória e descartada: contas demo servem para exibir dados, não para login.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

for (const demo of DEMO_USERS) {
  const userId = await ensureUser(demo.email);
  await admin
    .from("profiles")
    .update({ ...demo.profile, onboarded_at: new Date().toISOString() })
    .eq("id", userId)
    .throwOnError();

  await admin.from("pets").delete().eq("owner_id", userId).throwOnError();

  for (const { private: priv, ...pet } of demo.pets) {
    const { data } = await admin
      .from("pets")
      .insert({ owner_id: userId, ...pet })
      .select("id, mel_id, name")
      .single()
      .throwOnError();
    if (priv) {
      await admin
        .from("pet_private_details")
        .insert({ pet_id: data.id, owner_id: userId, ...priv })
        .throwOnError();
    }
    console.log(`  ${data.name.padEnd(6)} ${data.mel_id}  ${pet.is_public ? "público" : "privado"}  (${demo.email})`);
  }
}

console.log("Seed de demonstração concluído (dados fictícios).");
