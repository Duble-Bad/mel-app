import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOnboardedProfile } from "@/lib/session";
import { PetForm } from "@/components/pets/PetForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Cadastrar pet",
  robots: { index: false },
};

export default function NewPetPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="text-2xl font-bold">Cadastrar pet</h1>
      <p className="mt-2 mb-6 text-text-secondary">
        Com o pet cadastrado, um alerta de desaparecimento fica pronto em segundos se você precisar.
      </p>
      <Suspense fallback={<LoadingState />}>
        <NewPetContent />
      </Suspense>
    </main>
  );
}

async function NewPetContent() {
  const profile = await requireOnboardedProfile("/perfil/pets/novo");
  return <PetForm ownerId={profile.id} defaultCity={profile.city} defaultState={profile.state} />;
}
