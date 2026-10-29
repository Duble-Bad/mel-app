import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Heart, Plus } from "lucide-react";
import { Suspense } from "react";
import { SPECIES, type Species } from "@mel/core";
import { listAdoptions } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { AdoptionCard } from "@/components/adoption/AdoptionCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { PetCardSkeleton } from "@/components/ui/Surface";

export const metadata: Metadata = {
  title: "Adoção",
  description: "Cães e gatos procurando um lar. Anúncios revisados pela equipe da MEL, sem venda de animais.",
};

const LABELS: Record<Species, string> = { dog: "Cachorros", cat: "Gatos", other: "Outros" };

export default function AdoptionListPage({ searchParams }: PageProps<"/adocao">) {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold">Adote um amigo</h1>
          <p className="text-text-secondary">Anúncios revisados pela equipe da MEL. Adoção é responsabilidade, e nunca tem preço.</p>
        </div>
        <ButtonLink href="/publicar/adocao" variant="secondary" size="md" className="w-auto">
          <Plus aria-hidden="true" className="size-4" strokeWidth={2} /> Colocar para adoção
        </ButtonLink>
      </header>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <PetCardSkeleton />
            <PetCardSkeleton />
          </div>
        }
      >
        {searchParams.then((q) => (
          <Results species={typeof q.especie === "string" && (SPECIES as readonly string[]).includes(q.especie) ? (q.especie as Species) : null} />
        ))}
      </Suspense>
    </main>
  );
}

async function Results({ species }: { species: Species | null }) {
  await connection();
  let result;
  try {
    result = await listAdoptions(createPublicClient(), { species: species ? [species] : undefined, pageSize: 48 });
  } catch (error) {
    console.error("[adocao] falha", error);
    return <ErrorState>Não conseguimos carregar os anúncios agora. Atualize a página.</ErrorState>;
  }
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Filtrar por espécie" className="flex flex-wrap gap-2">
        {[null, ...SPECIES].map((s) => (
          <Link
            key={s ?? "todos"}
            href={s ? `/adocao?especie=${s}` : "/adocao"}
            aria-current={species === s ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-semibold ${
              species === s ? "border-focus bg-primary-soft text-primary-soft-foreground" : "border-border bg-surface text-text-secondary hover:text-text-primary"
            }`}
          >
            {s ? LABELS[s] : "Todos"}
          </Link>
        ))}
      </nav>
      {result.items.length === 0 ? (
        <EmptyState title="Nenhum anúncio por aqui ainda" icon={Heart}>
          Quando um pet for colocado para adoção e aprovado pela equipe, ele aparece aqui.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {result.items.map((a) => (
            <li key={a.code}>
              <AdoptionCard a={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
