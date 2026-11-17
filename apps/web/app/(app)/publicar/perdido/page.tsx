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

export default function LostPetPage({ searchParams }: PageProps<"/publicar/perdido">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10 md:max-w-2xl lg:max-w-3xl">
      <Suspense fallback={<LoadingState label="Preparando o alerta…" />}>
        <LostPetContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LostPetContent({ searchParams }: Pick<PageProps<"/publicar/perdido">, "searchParams">) {
  // ?pet=<id>: atalho "Ele está desaparecido? Publicar alerta" (cadastro e página do pet).
  const { pet: petParam } = await searchParams;
  const profile = await requireOnboardedProfile(typeof petParam === "string" ? `/publicar/perdido?pet=${encodeURIComponent(petParam)}` : "/publicar/perdido");
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
      preselectPetId={typeof petParam === "string" && data.pets.some((p) => p.id === petParam) ? petParam : undefined}
    />
  );
}
