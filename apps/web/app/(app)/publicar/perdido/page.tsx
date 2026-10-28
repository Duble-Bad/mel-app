import type { Metadata } from "next";
import { Suspense } from "react";
import { getMyDraft, listMyPets } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { LostWizard } from "@/components/lost/LostWizard";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Perdi meu pet",
  robots: { index: false },
};

export default function LostPetPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Preparando o alerta…" />}>
        <LostPetContent />
      </Suspense>
    </main>
  );
}

async function LostPetContent() {
  const profile = await requireOnboardedProfile("/publicar/perdido");
  const supabase = await createSessionClient();
  let data;
  try {
    const [pets, draft] = await Promise.all([listMyPets(supabase, profile.id), getMyDraft(supabase, profile.id)]);
    data = { pets, draft };
  } catch (error) {
    console.error("[publicar/perdido] falha ao carregar", error);
    return <ErrorState>Não conseguimos carregar agora. Atualize a página para tentar de novo.</ErrorState>;
  }
  return (
    <LostWizard
      profile={{ id: profile.id, city: profile.city, state: profile.state }}
      pets={data.pets}
      draft={data.draft}
    />
  );
}
