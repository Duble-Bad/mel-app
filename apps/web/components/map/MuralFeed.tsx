import "@/app/map.css";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, Heart, Map as MapIcon, SearchX, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { DEFAULT_CENTER_LABEL, PAGE_SIZE, parseSearchParams, type PublicAdoption, type PublicCaseItem } from "@mel/core";
import { listAdoptions, searchPublicCases } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { PetCardSkeleton } from "@/components/ui/Surface";
import { AdoptionFeedCard, CaseCard } from "./CaseCard";
import { feedQuery, type FeedState, includesAdoption, includesCases, kindsFor, parseFeed } from "./feed";
import { FeedFiltersBar } from "./FeedFiltersBar";

type Params = Record<string, string | string[] | undefined>;

/** Com porte escolhido, a busca de casos (que não filtra porte) traz os mais próximos e o mural filtra aqui. */
const SIZE_SCAN = 100;
/** Em "Todos", a adoção entra num bloco próprio na primeira página. */
const ADOPTION_IN_ALL = 6;

const grid = "mel-stagger grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-[18px]";

/**
 * Mural (Conceito B): perdidos, encontrados, vistos e adoção, com filtros no
 * endereço. Casos seguem a paginação da busca; adoção (sem ponto público) vem
 * da listagem de adoção: em "Adoção" paginada, em "Todos" num bloco na 1ª página.
 */
export function MuralFeed({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-[var(--mel-page-gutter)] pb-16">
      <header className="flex animate-enter flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-10 pb-6">
        <div className="flex max-w-2xl flex-col gap-2.5">
          <h1 className="text-[clamp(32px,5vw,48px)] leading-[1.05] font-black tracking-[-0.03em]">Mural da MEL</h1>
          <p className="max-w-[60ch] text-lg text-text-secondary">Acompanhe os pets perdidos, encontrados e disponíveis para adoção na sua região.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/adocao" variant="secondary" size="md" className="w-auto">
            <Heart aria-hidden="true" className="size-4" strokeWidth={2} /> Para adoção
          </ButtonLink>
          <ButtonLink href="/mapa" variant="secondary" size="md" className="w-auto">
            <MapIcon aria-hidden="true" className="size-4" strokeWidth={2} /> Ver no mapa
          </ButtonLink>
        </div>
      </header>
      <Suspense fallback={<ListSkeleton />}>{searchParams.then((q) => <Results params={q} />)}</Suspense>
      <p className="mt-7 flex gap-3 rounded-[14px] border border-status-sighting-accent/35 bg-status-sighting-accent/10 px-4 py-3.5 text-sm text-text-secondary">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-status-sighting-accent" strokeWidth={2} />
        <span>
          O mural mostra só o que é público: foto, nome, bairro e há quanto tempo. Telefones e endereços nunca aparecem, e o local dos casos é sempre
          aproximado (~100 m).
        </span>
      </p>
    </main>
  );
}

async function Results({ params }: { params: Params }) {
  // Lista "agora" (período relativo à hora atual): sempre renderizada na requisição.
  await connection();
  const filters = parseSearchParams(params);
  const state: FeedState = { filters, ...parseFeed(params, filters) };
  const { feed, size } = state;
  const client = createPublicClient();

  let cases: { items: PublicCaseItem[]; total: number } = { items: [], total: 0 };
  let adoptions: { items: PublicAdoption[]; total: number } = { items: [], total: 0 };
  try {
    const casesP = includesCases(feed)
      ? size
        ? searchPublicCases(client, { ...filters, kinds: kindsFor(feed), page: 1 }, { pageSize: SIZE_SCAN }).then((r) => {
            const all = r.items.filter((i) => i.size === size);
            return { items: all.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE), total: all.length };
          })
        : searchPublicCases(client, { ...filters, kinds: kindsFor(feed) })
      : null;
    const adoptionP =
      feed === "adoption"
        ? listAdoptions(client, { species: filters.species, sizes: size ? [size] : undefined, page: filters.page, pageSize: PAGE_SIZE })
        : includesAdoption(feed) && filters.page === 1
          ? // Em "Todos", falhar a adoção não derruba os casos.
            listAdoptions(client, { species: filters.species, sizes: size ? [size] : undefined, pageSize: ADOPTION_IN_ALL }).catch((error) => {
              console.error("[mural] adoção falhou", error);
              return null;
            })
          : null;
    const [c, a] = await Promise.all([casesP, adoptionP]);
    if (c) cases = c;
    if (a) adoptions = a;
  } catch (error) {
    console.error("[mural] falha", error);
    return <ErrorState>Não conseguimos carregar agora. Atualize a página em instantes.</ErrorState>;
  }

  const paged = feed === "adoption" ? adoptions.total : cases.total;
  const pages = Math.max(1, Math.ceil(paged / PAGE_SIZE));
  const link = (page: number) => `/mural${feedQuery({ ...state, filters: { ...filters, page } })}`;
  const where = filters.hasCenter ? "de você" : `do ${DEFAULT_CENTER_LABEL}`;
  const pets = (n: number) => (n === 1 ? "1 pet" : `${n} pets`);

  return (
    <div className="flex flex-col gap-5">
      <FeedFiltersBar state={state} variant="mural" />
      <p className="text-sm text-text-secondary" aria-live="polite">
        {feed === "adoption" ? (
          `${pets(adoptions.total)} para adoção.`
        ) : (
          <>
            {pets(cases.total)} em até {filters.radiusKm} km {where}
            {size && cases.total >= SIZE_SCAN ? " (entre os mais próximos)" : ""}
            {adoptions.total > 0 && ` · ${adoptions.total} para adoção`}.
            {!filters.hasCenter && " Toque em “Perto de mim” para ver o que está ao seu redor."}
          </>
        )}
      </p>

      {feed === "adoption" ? (
        adoptions.items.length === 0 ? (
          <EmptyState title="Nenhum pet com esses filtros" icon={SearchX}>
            Tente outro porte ou espécie.
          </EmptyState>
        ) : (
          <ul key={link(filters.page)} className={grid}>
            {adoptions.items.map((a) => (
              <li key={a.code}>
                <AdoptionFeedCard adoption={a} />
              </li>
            ))}
          </ul>
        )
      ) : cases.items.length === 0 ? (
        <EmptyState title="Nada por aqui com esses filtros" icon={SearchX}>
          Isso pode ser uma boa notícia. Tente aumentar o raio ou o período para ajudar animais um pouco mais longe.
        </EmptyState>
      ) : (
        <ul key={link(filters.page)} className={grid}>
          {cases.items.map((item) => (
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

      {feed === "all" && adoptions.items.length > 0 && (
        <section aria-labelledby="mural-adocao" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="mural-adocao" className="text-2xl font-extrabold tracking-[-0.02em]">
                Para adoção
              </h2>
              <p className="text-sm text-text-secondary">Anúncios de toda a rede. O local exato só é combinado pela MEL.</p>
            </div>
            {adoptions.total > adoptions.items.length && (
              <Link href={`/mural${feedQuery({ ...state, feed: "adoption", filters: { ...filters, page: 1 } })}`} className="text-sm font-semibold text-link underline-offset-4 hover:underline">
                Ver todos ({adoptions.total})
              </Link>
            )}
          </div>
          <ul className={grid}>
            {adoptions.items.map((a) => (
              <li key={a.code}>
                <AdoptionFeedCard adoption={a} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-[18px]">
      <PetCardSkeleton />
      <PetCardSkeleton />
      <PetCardSkeleton />
      <PetCardSkeleton />
    </div>
  );
}
