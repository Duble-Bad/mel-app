import { createClient } from "@supabase/supabase-js";
import { petInputSchema } from "../../packages/core/src/index";
import { activateLostCase, startLostCase, updateLostCase } from "../../packages/data/src/lostCases";
import { addPetPhoto, createPet } from "../../packages/data/src/pets";
import type { MelClient } from "../../packages/data/src/client";
import { solidPng } from "./png";
import { createUser, TEST_PASSWORD } from "./users";

interface AlertOptions {
  petName?: string;
  breed?: string;
  uniqueMarks?: string;
  withPhoto?: boolean;
  /** Número FICTÍCIO publicado como WhatsApp no alerta. */
  whatsapp?: string;
}

/** Tutor de teste com um alerta ATIVO (dados fictícios, local público: Praça da Sé). */
export async function createTutorWithActiveAlert(label: string, petNameOrOptions: string | AlertOptions = "Mel") {
  const opts: AlertOptions = typeof petNameOrOptions === "string" ? { petName: petNameOrOptions } : petNameOrOptions;
  const user = await createUser(label, { onboarded: true });
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  }) as unknown as MelClient;
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: TEST_PASSWORD });
  if (error) throw error;

  const pet = await createPet(
    client,
    user.id,
    petInputSchema.parse({
      name: opts.petName ?? "Mel",
      species: "dog",
      breed: opts.breed,
      sex: "female",
      size: "mini",
      uniqueMarks: opts.uniqueMarks,
    }),
  );
  if (opts.withPhoto) {
    const png = new Blob([new Uint8Array(solidPng(400, 400, [176, 120, 64]))], { type: "image/png" });
    await addPetPhoto(client, pet, { full: png, thumb: png, width: 400, height: 400 }, 0);
  }
  const draft = await startLostCase(client, user.id, pet.id);
  await updateLostCase(client, draft.id, {
    lastSeen: { lat: -23.55052, lng: -46.633308 },
    publicAreaLabel: "Sé, São Paulo – SP",
    lostAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    ...(opts.whatsapp ? { contactWhatsappPublic: true, contactPhone: opts.whatsapp } : {}),
  });
  const active = await activateLostCase(client, draft.id);
  return { ...user, code: active.code };
}
