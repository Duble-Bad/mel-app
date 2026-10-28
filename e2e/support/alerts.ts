import { createClient } from "@supabase/supabase-js";
import { petInputSchema } from "../../packages/core/src/index";
import { activateLostCase, startLostCase, updateLostCase } from "../../packages/data/src/lostCases";
import { createPet } from "../../packages/data/src/pets";
import type { MelClient } from "../../packages/data/src/client";
import { createUser, TEST_PASSWORD } from "./users";

/** Tutor de teste com um alerta ATIVO (dados fictícios, local público: Praça da Sé). */
export async function createTutorWithActiveAlert(label: string, petName = "Mel") {
  const user = await createUser(label, { onboarded: true });
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  }) as unknown as MelClient;
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: TEST_PASSWORD });
  if (error) throw error;

  const pet = await createPet(client, user.id, petInputSchema.parse({ name: petName, species: "dog" }));
  const draft = await startLostCase(client, user.id, pet.id);
  await updateLostCase(client, draft.id, {
    lastSeen: { lat: -23.55052, lng: -46.633308 },
    publicAreaLabel: "Sé, São Paulo – SP",
    lostAt: new Date(Date.now() - 60 * 60_000).toISOString(),
  });
  const active = await activateLostCase(client, draft.id);
  return { ...user, code: active.code };
}
