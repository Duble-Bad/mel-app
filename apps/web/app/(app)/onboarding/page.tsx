import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { needsOnboarding, safeNextPath } from "@mel/core";
import { getCurrentProfile } from "@/lib/session";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ButtonLink } from "@/components/ui/Button";
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
      {/* Saída sempre visível: quem entrou na conta errada não fica preso aqui. */}
      <div className="mt-8 border-t border-border pt-4">
        <SignOutButton />
      </div>
    </main>
  );
}

async function OnboardingContent({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const next = safeNextPath(String((await searchParams).next ?? ""));
  const profile = await getCurrentProfile();
  if (!profile) {
    return (
      <ErrorState
        title="Não conseguimos carregar seu perfil."
        action={
          <ButtonLink href={`/onboarding?next=${encodeURIComponent(next)}`} variant="secondary" size="md">
            Tentar novamente
          </ButtonLink>
        }
      >
        Pode ser uma instabilidade passageira. Tente de novo; se continuar, saia e entre novamente.
      </ErrorState>
    );
  }
  if (!needsOnboarding(profile)) redirect(next);
  return <ProfileForm profile={profile} next={next} submitLabel="Continuar" requireTerms />;
}
