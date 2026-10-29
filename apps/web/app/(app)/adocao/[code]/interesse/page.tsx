import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdoption } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { InterestForm } from "@/components/adoption/AdoptionClient";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Quero adotar", robots: { index: false } };

export default function InterestPage({ params }: PageProps<"/adocao/[code]/interesse">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <Suspense fallback={<LoadingState />}>{params.then(({ code }) => <Content code={code} />)}</Suspense>
    </main>
  );
}

async function Content({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  await requireOnboardedProfile(`/adocao/${code}/interesse`);
  const a = await getAdoption(await createSessionClient(), code);
  if (!a) notFound();
  if (a.isOwner || (a.status !== "AVAILABLE" && a.status !== "IN_PROCESS")) redirect(`/adocao/${a.code}`);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        {a.photoUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio
          <img src={a.photoUrls[0]} alt={`Foto de ${a.name}`} className="size-16 shrink-0 rounded-lg object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-bold">Quero adotar {a.name}</h1>
          <p className="text-text-secondary">Algumas perguntas rápidas para quem está doando te conhecer.</p>
        </div>
      </header>
      <InterestForm code={a.code} petName={a.name} />
    </div>
  );
}
