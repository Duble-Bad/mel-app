import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOnboardedProfile } from "@/lib/session";
import { AdoptionForm } from "@/components/adoption/AdoptionForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Colocar para adoção", robots: { index: false } };

export default function PublishAdoptionPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <h1 className="mb-1.5 text-2xl font-bold">Colocar para adoção</h1>
      <p className="mb-6 text-text-secondary">Conte sobre o pet. A equipe da MEL revisa antes de publicar.</p>
      <Suspense fallback={<LoadingState />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const profile = await requireOnboardedProfile("/publicar/adocao");
  return <AdoptionForm userId={profile.id} />;
}
