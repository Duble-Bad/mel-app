import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOnboardedProfile } from "@/lib/session";
import { AdoptionForm } from "@/components/adoption/AdoptionForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Colocar para adoção", robots: { index: false } };

export default function PublishAdoptionPage() {
  return (
    <main className="mel-container max-w-[1184px] flex-1 pt-6 pb-12">
      <h1 className="mb-1.5 text-2xl font-bold lg:text-3xl">Colocar para adoção</h1>
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
