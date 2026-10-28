import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { parseSearchParams } from "@mel/core";
import { MapExplorer } from "@/components/map/MapExplorer";
import { SearchFiltersBar } from "@/components/map/SearchFiltersBar";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Mapa da rede MEL",
  description: "Pets perdidos, encontrados e vistos soltos perto de você, em pontos aproximados.",
};

export default function MapPage({ searchParams }: PageProps<"/mapa">) {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-[var(--mel-page-gutter)] pt-5 pb-10">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Mapa da rede MEL</h1>
          <p className="text-sm text-text-secondary">Locais sempre aproximados, para proteger quem publica.</p>
        </div>
        <nav aria-label="Listas" className="flex gap-4 text-sm font-semibold">
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
          return (
            <div className="flex flex-col gap-4">
              <SearchFiltersBar filters={filters} />
              {/* Centro/raio novos remontam o mapa já no lugar certo. */}
              <MapExplorer key={`${filters.center.lat},${filters.center.lng},${filters.radiusKm}`} filters={filters} />
            </div>
          );
        })}
      </Suspense>
    </main>
  );
}
