import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { needsOnboarding, safeNextPath } from "@mel/core";
import { getCurrentProfile } from "@/lib/session";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Boas-vindas",
  robots: { index: false },
};

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="text-2xl font-bold">Que bom ter você na rede MEL</h1>
      <p className="mt-2 mb-6 text-text-secondary">Só mais um passo. Leva menos de um minuto.</p>
      <Suspense fallback={<LoadingState />}>
        <OnboardingContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OnboardingContent({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const next = safeNextPath(String((await searchParams).next ?? ""));
  const profile = await getCurrentProfile();
  if (!profile) {
    return <ErrorState>Não encontramos seu perfil. Saia e entre novamente.</ErrorState>;
  }
  if (!needsOnboarding(profile)) redirect(next);
  return <ProfileForm profile={profile} next={next} submitLabel="Continuar" />;
}
