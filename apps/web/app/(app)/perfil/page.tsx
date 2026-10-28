import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BR_STATES, timeAgo } from "@mel/core";
import { listMyLostCases, listMyPets } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ThemeOptions } from "@/components/theme/ThemeSwitcher";
import { PetCard } from "@/components/pets/PetCard";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";

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

      <Suspense fallback={null}>
        <MyAlerts ownerId={profile.id} />
      </Suspense>

      <section aria-labelledby="meus-pets" className="flex flex-col gap-4">
        <h2 id="meus-pets" className="text-xl font-bold">
          Meus pets
        </h2>
        <Suspense fallback={<LoadingState label="Carregando seus pets…" />}>
          <MyPets ownerId={profile.id} />
        </Suspense>
      </section>

      <section aria-labelledby="aparencia" className="flex flex-col gap-3">
        <h2 id="aparencia" className="text-xl font-bold">
          Aparência
        </h2>
        <ThemeOptions layout="segmented" />
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

async function MyAlerts({ ownerId }: { ownerId: string }) {
  const supabase = await createSessionClient();
  let data;
  try {
    const [cases, pets] = await Promise.all([listMyLostCases(supabase, ownerId), listMyPets(supabase, ownerId)]);
    data = { cases, pets };
  } catch (error) {
    console.error("[perfil] falha ao listar alertas", error);
    return <ErrorState>Não conseguimos carregar seus alertas agora. Atualize a página.</ErrorState>;
  }
  if (data.cases.length === 0) return null;
  const petName = (id: string) => data.pets.find((p) => p.id === id)?.name ?? "Pet";

  return (
    <section aria-labelledby="meus-alertas" className="flex flex-col gap-3">
      <h2 id="meus-alertas" className="text-xl font-bold">
        Meus alertas
      </h2>
      <ul className="flex flex-col gap-3">
        {data.cases.map((c) => (
          <li key={c.id}>
            <Link
              href={c.status === "DRAFT" ? "/publicar/perdido" : `/alerta/${c.code}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-card"
            >
              <span>
                <span className="block font-bold">{petName(c.petId)}</span>
                <span className="text-sm text-text-secondary">
                  {c.status === "DRAFT"
                    ? "Rascunho — toque para continuar"
                    : c.publishedAt
                      ? `Publicado ${timeAgo(c.publishedAt)}`
                      : ""}
                </span>
              </span>
              {c.status === "DRAFT" ? (
                <StatusBadge status="draft">Rascunho</StatusBadge>
              ) : c.status === "FOUND" ? (
                <StatusBadge status="found">Encontrado</StatusBadge>
              ) : (
                <StatusBadge status="lost">Perdido</StatusBadge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
