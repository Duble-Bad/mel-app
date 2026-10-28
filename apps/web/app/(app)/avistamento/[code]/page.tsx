import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { petSummary } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { SightingForm } from "@/components/sighting/SightingForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Eu vi este pet",
  robots: { index: false },
};

export default function SightingPage({ params }: PageProps<"/avistamento/[code]">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState />}>{params.then(({ code }) => <SightingContent code={code} />)}</Suspense>
    </main>
  );
}

async function SightingContent({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const c = await getPublicLostCase(createPublicClient(), code);
  if (!c) notFound();
  const photo = c.pet.photos[0];

  if (c.status !== "ACTIVE") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{c.pet.name} já está em casa ❤️</h1>
        <p className="text-text-secondary">Este alerta foi encerrado. Obrigado por querer ajudar!</p>
        <Link href={`/alerta/${c.code}`} className="font-semibold text-link underline">
          Ver o alerta
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada
          <img src={photo.thumbUrl} alt={`Foto de ${c.pet.name}`} className="size-20 shrink-0 rounded-lg object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-bold">Você viu {c.pet.name}?</h1>
          <p className="text-text-secondary">{petSummary(c.pet)}</p>
        </div>
      </header>
      <SightingForm code={c.code} petName={c.pet.name} chatEnabled={c.contactChat} />
    </div>
  );
}
