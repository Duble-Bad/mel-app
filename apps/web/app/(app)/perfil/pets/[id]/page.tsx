import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Globe, Lock } from "lucide-react";
import { getPet, getPetPrivateDetails } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { DeletePetButton } from "@/components/pets/DeletePetButton";
import { PetForm } from "@/components/pets/PetForm";
import { Alert } from "@/components/ui/Alert";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Editar pet",
  robots: { index: false },
};

export default function EditPetPage({ params, searchParams }: PageProps<"/perfil/pets/[id]">) {
  return (
    <main className="mel-container max-w-[1184px] flex-1 pt-6 pb-12">
      <Suspense fallback={<LoadingState />}>
        <EditPetContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function EditPetContent({ params, searchParams }: PageProps<"/perfil/pets/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const profile = await requireOnboardedProfile(`/perfil/pets/${id}`);

  const supabase = await createSessionClient();
  const pet = /^[0-9a-f-]{36}$/i.test(id) ? await getPet(supabase, id) : null;
  if (!pet || pet.ownerId !== profile.id) notFound();
  const privateDetails = await getPetPrivateDetails(supabase, pet.id);
  const failedPhotos = Number(query.fotos_falharam ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <Link href="/perfil" className="text-sm font-semibold text-link underline-offset-4 hover:underline">
            ‹ Meus pets
          </Link>
          <h1 className="mt-2 text-2xl font-bold lg:text-3xl">{pet.name}</h1>
          <p className="text-text-secondary">
            MEL ID <span className="font-mono font-semibold text-text-primary">{pet.melId}</span>
          </p>
        </div>
        <Link
          href={`/pet/${pet.melId}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong px-4 font-semibold transition-colors duration-200 ease-mel hover:bg-surface-muted"
        >
          {pet.isPublic ? <Globe aria-hidden="true" className="size-4" /> : <Lock aria-hidden="true" className="size-4" />}
          Ver página do pet <span className="font-normal text-text-secondary">{pet.isPublic ? "(pública)" : "(só você vê)"}</span>
        </Link>
      </div>

      {query.novo && (
        <Alert tone="success">
          {pet.name} está cadastrado(a) na MEL. Se um dia precisar, o alerta fica pronto em segundos.
        </Alert>
      )}
      {query.salvo && !query.novo && <Alert tone="success">Alterações salvas.</Alert>}
      {failedPhotos > 0 && (
        <Alert tone="error">
          {failedPhotos === 1 ? "Uma foto não foi enviada." : `${failedPhotos} fotos não foram enviadas.`} Tente
          adicioná-las de novo.
        </Alert>
      )}

      <PetForm ownerId={profile.id} pet={pet} privateDetails={privateDetails} asideFooter={<DeletePetButton pet={pet} />} />
    </div>
  );
}
