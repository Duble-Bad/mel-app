import type { Metadata } from "next";
import { Suspense } from "react";
import { BR_STATES } from "@mel/core";
import { requireOnboardedProfile } from "@/lib/session";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ButtonLink } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Meu perfil",
  robots: { index: false },
};

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Carregando seu perfil…" />}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}

async function ProfileContent() {
  const profile = await requireOnboardedProfile("/perfil");
  const stateName = BR_STATES.find((s) => s.uf === profile.state)?.name ?? profile.state;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex items-center gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-full bg-surface-muted">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage; otimização de imagens vem no M3
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

      <ButtonLink href="/perfil/editar" variant="secondary" size="md">
        Editar perfil
      </ButtonLink>

      <SignOutButton />
    </div>
  );
}
