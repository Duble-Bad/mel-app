import type { Metadata } from "next";
import { Suspense } from "react";
import { BR_STATES } from "@mel/core";
import { listMyPets } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PetCard } from "@/components/pets/PetCard";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Meu perfil",
  robots: { index: false },
};

export default function ProfilePage({ searchParams }: PageProps<"/perfil">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Carregando seu perfil…" />}>
        <ProfileContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProfileContent({ searchParams }: Pick<PageProps<"/perfil">, "searchParams">) {
  const profile = await requireOnboardedProfile("/perfil");
  const query = await searchParams;
  const stateName = BR_STATES.find((s) => s.uf === profile.state)?.name ?? profile.state;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex items-center gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-full bg-surface-muted">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar já reduzido no upload
            <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-full items-center justify-center text-3xl">
              🐾
            </span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{profile.displayName}</h1>
          <p className="text-text-secondary">
            {profile.city}, {stateName}
          </p>
        </div>
      </section>

      {query.pet_removido && <Alert tone="success">Pet excluído.</Alert>}

      <section aria-labelledby="meus-pets" className="flex flex-col gap-4">
        <h2 id="meus-pets" className="text-xl font-bold">
          Meus pets
        </h2>
        <Suspense fallback={<LoadingState label="Carregando seus pets…" />}>
          <MyPets ownerId={profile.id} />
        </Suspense>
      </section>

      <div className="flex flex-col gap-3">
        <ButtonLink href="/perfil/editar" variant="secondary" size="md">
          Editar perfil
        </ButtonLink>
        <SignOutButton />
      </div>
    </div>
  );
}

async function MyPets({ ownerId }: { ownerId: string }) {
  let pets;
  try {
    pets = await listMyPets(await createSessionClient(), ownerId);
  } catch (error) {
    console.error("[perfil] falha ao listar pets", error);
    return <ErrorState>Não conseguimos carregar seus pets agora. Atualize a página para tentar de novo.</ErrorState>;
  }

  if (pets.length === 0) {
    return (
      <EmptyState
        title="Nenhum pet cadastrado ainda"
        action={
          <ButtonLink href="/perfil/pets/novo" size="md">
            Cadastrar meu pet
          </ButtonLink>
        }
      >
        Cadastrar agora deixa tudo pronto: se ele se perder, o alerta sai em segundos.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {pets.map((pet) => (
          <li key={pet.id}>
            <PetCard pet={pet} href={`/perfil/pets/${pet.id}`} />
          </li>
        ))}
      </ul>
      <ButtonLink href="/perfil/pets/novo" variant="secondary" size="md">
        + Cadastrar outro pet
      </ButtonLink>
    </>
  );
}
