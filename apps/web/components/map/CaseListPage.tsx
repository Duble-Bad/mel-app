import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, Map as MapIcon, SearchX } from "lucide-react";
import { Suspense } from "react";
import { DEFAULT_CENTER_LABEL, PAGE_SIZE, parseSearchParams, toSearchParams, type PublicKind } from "@mel/core";
import { searchPublicCases } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { CaseCard } from "@/components/map/CaseCard";
import { SearchFiltersBar } from "@/components/map/SearchFiltersBar";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { PetCardSkeleton } from "@/components/ui/Surface";

type Params = Record<string, string | string[] | undefined>;

/** Lista pública (perdidos ou encontrados) com filtros no endereço e paginação. */
export function CaseListPage({
  title,
  intro,
  path,
  kinds,
  searchParams,
}: {
  title: string;
  intro: string;
  path: string;
  kinds: PublicKind[];
  searchParams: Promise<Params>;
}) {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-text-secondary">{intro}</p>
        </div>
        <ButtonLink href="/mapa" variant="secondary" size="md" className="w-auto">
          <MapIcon aria-hidden="true" className="size-4" strokeWidth={2} /> Ver no mapa
        </ButtonLink>
      </header>
      <Suspense fallback={<ListSkeleton />}>
        {searchParams.then((q) => (
          <Results params={q} path={path} kinds={kinds} />
        ))}
      </Suspense>
    </main>
  );
}

async function Results({ params, path, kinds }: { params: Params; path: string; kinds: PublicKind[] }) {
  // Lista "agora" (período relativo à hora atual): sempre renderizada na requisição.
  await connection();
  const filters = parseSearchParams(params, kinds);
  let result;
  try {
    result = await searchPublicCases(createPublicClient(), filters);
  } catch (error) {
    console.error("[lista pública] falha", error);
    return <ErrorState>Não conseguimos carregar agora. Atualize a página em instantes.</ErrorState>;
  }
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const link = (page: number) => `${path}${toSearchParams({ ...filters, page }, kinds)}`;

  return (
    <div className="flex flex-col gap-5">
      <SearchFiltersBar filters={filters} fixedKinds={kinds} />
      <p className="text-sm text-text-secondary" aria-live="polite">
        {result.total === 1 ? "1 resultado" : `${result.total} resultados`} em até {filters.radiusKm} km
        {filters.hasCenter ? " de você" : ` do ${DEFAULT_CENTER_LABEL}`}.
        {!filters.hasCenter && " Toque em “Perto de mim” para ver o que está ao seu redor."}
      </p>

      {result.items.length === 0 ? (
        <EmptyState title="Nada por aqui com esses filtros" icon={SearchX}>
          Isso pode ser uma boa notícia. Tente aumentar o raio ou o período para ajudar animais um pouco mais longe.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <li key={`${item.kind}-${item.code}`}>
              <CaseCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-3 pt-2">
          {filters.page > 1 ? (
            <Link href={link(filters.page - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 font-semibold text-link hover:bg-surface-muted">
              <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} /> Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-text-secondary">
            Página {filters.page} de {pages}
          </span>
          {filters.page < pages ? (
            <Link href={link(filters.page + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 font-semibold text-link hover:bg-surface-muted">
              Próxima <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <PetCardSkeleton />
      <PetCardSkeleton />
      <PetCardSkeleton />
    </div>
  );
}
