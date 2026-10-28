import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { Suspense } from "react";
import { listMyMatches } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/found/MatchCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Correspondências do Radar", robots: { index: false } };

export default function MatchesPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Radar aria-hidden="true" className="size-6 text-brand" strokeWidth={2} /> Radar MEL
        </h1>
        <p className="text-text-secondary">Animais encontrados ou vistos por perto que podem ser o seu pet.</p>
      </div>
      <Suspense fallback={<LoadingState />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await requireOnboardedProfile("/perfil/correspondencias");
  let matches;
  try {
    matches = (await listMyMatches(await createSessionClient())).filter((m) => m.role === "owner");
  } catch (error) {
    console.error("[correspondencias] falha", error);
    return <ErrorState>Não conseguimos carregar as correspondências agora. Atualize a página.</ErrorState>;
  }
  if (!matches.length) {
    return (
      <EmptyState title="Nenhuma correspondência por enquanto" icon={Radar}>
        Quando alguém publicar um animal encontrado parecido com o seu pet perto do último local, ele aparece aqui e você
        recebe um aviso.
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  );
}
