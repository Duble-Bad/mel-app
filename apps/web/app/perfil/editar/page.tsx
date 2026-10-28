import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOnboardedProfile } from "@/lib/session";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Editar perfil",
  robots: { index: false },
};

export default function EditProfilePage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="mb-6 text-2xl font-bold">Editar perfil</h1>
      <Suspense fallback={<LoadingState />}>
        <EditProfileContent />
      </Suspense>
    </main>
  );
}

async function EditProfileContent() {
  const profile = await requireOnboardedProfile("/perfil/editar");
  return <ProfileForm profile={profile} next="/perfil" submitLabel="Salvar alterações" />;
}
