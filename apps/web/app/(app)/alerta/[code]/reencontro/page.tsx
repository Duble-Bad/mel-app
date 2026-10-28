import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getPublicLostCase, getTimeline } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { ReunionFlow } from "@/components/lost/ReunionFlow";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Meu pet foi encontrado", robots: { index: false } };

export default function ReunionPage({ params }: PageProps<"/alerta/[code]/reencontro">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <Suspense fallback={<LoadingState />}>{params.then(({ code }) => <Content code={code} />)}</Suspense>
    </main>
  );
}

async function Content({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  await requireOnboardedProfile(`/alerta/${code}/reencontro`);
  const supabase = await createSessionClient();
  const c = await getPublicLostCase(supabase, code);
  // Só o tutor, e só com o alerta ativo; o resto volta para a página do alerta.
  if (!c) notFound();
  if (!c.isOwner || c.status !== "ACTIVE") redirect(`/alerta/${c.code}`);
  const sightings = (await getTimeline(supabase, c.code)).filter((s) => !s.hidden);
  return <ReunionFlow code={c.code} petName={c.pet.name} photoUrl={c.pet.photos[0]?.thumbUrl ?? null} sightings={sightings} />;
}
