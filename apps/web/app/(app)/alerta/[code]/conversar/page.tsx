import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { petSummary } from "@mel/core";
import { getPublicLostCase, myConversationForCase } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { AntiScamNotice } from "@/components/chat/AntiScamNotice";
import { StartConversationForm } from "@/components/chat/StartConversationForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Conversar com o tutor", robots: { index: false } };

export default function StartConversationPage({ params }: PageProps<"/alerta/[code]/conversar">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState />}>{params.then(({ code }) => <Content code={code} />)}</Suspense>
    </main>
  );
}

async function Content({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const supabase = await createSessionClient();
  const c = await getPublicLostCase(supabase, code);
  if (!c) notFound();
  if (c.isOwner) redirect(`/alerta/${c.code}`);

  const user = await getSessionUser();
  // Já conversou sobre este alerta: continua de onde parou.
  const existing = user ? await myConversationForCase(supabase, c.code) : null;
  if (existing) redirect(`/conversas/${existing}`);

  const back = (
    <Link href={`/alerta/${c.code}`} className="font-semibold text-link underline">
      Voltar ao alerta
    </Link>
  );
  if (c.status !== "ACTIVE") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Este alerta foi encerrado</h1>
        <p className="text-text-secondary">Não é possível iniciar uma conversa agora. Obrigado por querer ajudar!</p>
        {back}
      </div>
    );
  }
  if (!c.contactChat) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">O tutor não está recebendo mensagens</h1>
        <p className="text-text-secondary">Viu {c.pet.name}? Envie um avistamento ou use o contato mostrado no alerta.</p>
        {back}
      </div>
    );
  }

  const photo = c.pet.photos[0];
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada
          <img src={photo.thumbUrl} alt={`Foto de ${c.pet.name}`} className="size-16 shrink-0 rounded-lg object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-bold">Conversar com o tutor de {c.pet.name}</h1>
          <p className="text-text-secondary">{petSummary(c.pet)}</p>
        </div>
      </header>
      <AntiScamNotice />
      <StartConversationForm code={c.code} petName={c.pet.name} needsCaptcha={!user || user.isAnonymous} />
      {back}
    </div>
  );
}
