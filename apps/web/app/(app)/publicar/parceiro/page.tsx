import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOnboardedProfile } from "@/lib/session";
import { BusinessForm } from "@/components/partners/BusinessForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Cadastrar empresa parceira", robots: { index: false } };

export default function PublishPartnerPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <h1 className="mb-1.5 text-2xl font-bold">Cadastrar empresa parceira</h1>
      <p className="mb-6 text-text-secondary">Apareça para quem procura ajuda com pets na sua região. A equipe da MEL revisa antes de publicar.</p>
      <Suspense fallback={<LoadingState />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const profile = await requireOnboardedProfile("/publicar/parceiro");
  return <BusinessForm userId={profile.id} />;
}
