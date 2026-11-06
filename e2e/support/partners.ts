import { createClient } from "@supabase/supabase-js";
import { adoptionInputSchema, partnerInputSchema, partnerRecord } from "../../packages/core/src/index";
import { createAdoption, reviewAdoption, uploadAdoptionPhoto } from "../../packages/data/src/adoption";
import { createPartner, reviewBusiness } from "../../packages/data/src/partners";
import type { MelClient } from "../../packages/data/src/client";
import { solidPng } from "./png";
import { createUser, setRole, TEST_PASSWORD } from "./users";

/** Cliente com a sessão de um usuário de teste (RLS e gatilhos valem, como no app). */
export async function signedClient(email: string): Promise<MelClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  }) as unknown as MelClient;
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw error;
  return client;
}

/** Moderador de teste (aprova parceiros e anúncios). */
export async function createModerator(label: string) {
  const mod = await createUser(label, { onboarded: true });
  await setRole(mod.id, "moderator");
  return { ...mod, client: await signedClient(mod.email) };
}

/** CNPJ válido e aleatório (dígitos verificadores calculados): testes em paralelo não colidem. */
export function randomCnpj(): string {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1]);
  const dv = (digits: number[]) => {
    const weights = digits.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = digits.reduce((sum, d, i) => sum + d * weights[i]!, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

type Place = { lat: number; lng: number; label: string; neighborhood: string };

/** ONG (fictícia) aprovada, com ou sem endereço institucional autorizado. */
export async function createApprovedNgo(ownerEmail: string, ownerId: string, mod: MelClient, name: string, at: Place, addressPublic: boolean) {
  const owner = await signedClient(ownerEmail);
  const input = partnerInputSchema.parse({
    kind: "ngo",
    name,
    description: "ONG fictícia de teste automatizado: resgate e adoção responsável.",
    position: { lat: at.lat, lng: at.lng },
    phone: "1133334444",
    neighborhood: at.neighborhood,
    city: "São Paulo – SP",
    cnpj: randomCnpj(),
    activityArea: "Cães e gatos",
    responsibleName: "Pessoa Fictícia",
    addressPublic,
    addressLabel: addressPublic ? at.label : null,
  });
  const { code } = await createPartner(owner, ownerId, partnerRecord(input));
  await reviewBusiness(mod, code, true);
  return code;
}

/** Anúncio de adoção aprovado (foto sólida, local fictício). */
export async function createApprovedAdoption(ownerEmail: string, ownerId: string, mod: MelClient, name: string, at: Place) {
  const owner = await signedClient(ownerEmail);
  const png = new Blob([new Uint8Array(solidPng(400, 400, [200, 160, 60]))], { type: "image/png" });
  const photo = await uploadAdoptionPhoto(owner, ownerId, png);
  const code = await createAdoption(
    owner,
    ownerId,
    adoptionInputSchema.parse({
      name,
      species: "dog",
      sex: "female",
      size: "medium",
      ageMonths: 24,
      description: "Anúncio fictício de teste automatizado, não é um animal real.",
      position: { lat: at.lat, lng: at.lng },
      areaLabel: `${at.neighborhood}, São Paulo – SP`,
      photoPaths: [photo],
    }),
  );
  await reviewAdoption(mod, code, true);
  return code;
}
