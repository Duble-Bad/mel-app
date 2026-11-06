import "@/app/map.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { parseSearchParams } from "@mel/core";
import { parseFeed } from "@/components/map/feed";
import { MapExplorer } from "@/components/map/MapExplorer";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Mapa da rede MEL",
  description: "Pets perdidos, encontrados e vistos soltos perto de você, em áreas aproximadas.",
};

export default function MapPage({ searchParams }: PageProps<"/mapa">) {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-[var(--mel-page-gutter)] pb-14">
      <header className="flex animate-enter flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-10 pb-6">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[clamp(32px,5vw,48px)] leading-[1.05] font-black tracking-[-0.03em]">Mapa da rede MEL</h1>
          <p className="max-w-[60ch] text-lg text-text-secondary">Ocorrências e avistamentos próximos da sua região. Toque numa área para ver o caso.</p>
        </div>
        <nav aria-label="Listas" className="flex gap-4 text-sm font-semibold">
          <Link href="/mural" className="text-link underline-offset-4 hover:underline">
            Ver no mural
          </Link>
          <Link href="/perdidos" className="text-link underline-offset-4 hover:underline">
            Lista de perdidos
          </Link>
          <Link href="/encontrados" className="text-link underline-offset-4 hover:underline">
            Encontrados
          </Link>
        </nav>
      </header>
      <Suspense fallback={<LoadingState label="Carregando mapa…" />}>
        {searchParams.then((q) => {
          const filters = parseSearchParams(q);
          const state = { filters, ...parseFeed(q, filters) };
          // Centro/raio novos remontam o mapa já no lugar certo.
          // Sem key: trocar centro/raio move o mapa já montado (não volta para "Lista" nem perde o zoom).
          return <MapExplorer state={state} />;
        })}
      </Suspense>
    </main>
  );
}
