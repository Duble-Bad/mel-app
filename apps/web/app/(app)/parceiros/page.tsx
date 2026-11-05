import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CircleCheck, Plus, Store } from "lucide-react";
import { Suspense } from "react";
import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, DEFAULT_CENTER, DEFAULT_CENTER_LABEL, type BusinessCategory, type LatLng } from "@mel/core";
import { listBusinesses } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { MapView } from "@/components/location/MapView";
import { BusinessCard } from "@/components/partners/BusinessCard";
import { NearMeChip } from "@/components/partners/PartnerClient";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Parceiros",
  description: "Clínicas, pet shops, abrigos e serviços que ajudam a rede MEL. Cadastros revisados pela equipe.",
};

const RADIUS_M = 15000;

function parse(q: Record<string, string | string[] | undefined>) {
  const cat = typeof q.categoria === "string" && (BUSINESS_CATEGORIES as readonly string[]).includes(q.categoria) ? (q.categoria as BusinessCategory) : null;
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  const near = typeof q.lat === "string" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return { cat, near, origin: near ? { lat, lng } : DEFAULT_CENTER };
}

export default function PartnersPage({ searchParams }: PageProps<"/parceiros">) {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-[var(--mel-page-gutter)] pt-8 pb-14">
      <ProgramIntro />
      <h2 className="mt-12 mb-5 text-2xl font-extrabold tracking-[-0.02em]">Parceiros perto de você</h2>
      <Suspense fallback={<LoadingState />}>{searchParams.then((q) => <Results {...parse(q)} />)}</Suspense>
    </main>
  );
}

const BENEFITS = [
  { title: "Ponto de apoio no mapa", text: "Quem encontra um animal sabe onde pedir ajuda perto." },
  { title: "Alertas da sua região", text: "Receba casos próximos e ajude a divulgar." },
  { title: "Selo de parceiro", text: "Cadastro revisado pela moderação antes de aparecer." },
] as const;

/** O programa explicado antes de pedir login: o cadastro (com conta) vem só no botão. */
function ProgramIntro() {
  return (
    <section aria-labelledby="programa" className="grid gap-6 rounded-hero border border-border bg-surface-warm p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-10 lg:p-10">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold tracking-[.08em] text-primary uppercase">Programa de parceiros</p>
        <h1 id="programa" className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Seja um parceiro da MEL
        </h1>
        <p className="text-text-secondary sm:text-body-lg">
          Clínicas, pet shops, ONGs e serviços que ajudam animais a voltarem para casa. Parceria pela causa: sem mensalidade e sem venda dentro da MEL.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <ButtonLink href="/publicar/parceiro" size="md" className="w-auto">
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.25} /> Quero me inscrever
          </ButtonLink>
        </div>
        <p className="text-sm text-text-secondary">Para enviar a inscrição pedimos uma conta, assim a moderação consegue falar com você.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-3 rounded-card border border-border bg-surface p-4">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.25} />
            <span>
              <strong className="block font-bold">{b.title}</strong>
              <span className="text-sm text-text-secondary">{b.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function chipHref(cat: BusinessCategory | null, near: boolean, origin: LatLng) {
  const q = new URLSearchParams();
  if (cat) q.set("categoria", cat);
  if (near) {
    q.set("lat", String(origin.lat));
    q.set("lng", String(origin.lng));
  }
  const s = q.toString();
  return s ? `/parceiros?${s}` : "/parceiros";
}

async function Results({ cat, near, origin }: { cat: BusinessCategory | null; near: boolean; origin: LatLng }) {
  await connection();
  let items;
  try {
    items = await listBusinesses(createPublicClient(), origin, { radiusM: RADIUS_M, categories: cat ? [cat] : undefined });
  } catch (error) {
    console.error("[parceiros] falha", error);
    return <ErrorState>Não conseguimos carregar os parceiros agora. Atualize a página.</ErrorState>;
  }
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Filtrar por categoria" className="flex flex-wrap gap-2">
        <NearMeChip active={near} />
        {[null, ...BUSINESS_CATEGORIES].map((c) => (
          <Link
            key={c ?? "todos"}
            href={chipHref(c, near, origin)}
            aria-current={cat === c ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-semibold ${
              cat === c ? "border-primary bg-primary text-primary-foreground shadow-primary" : "border-border bg-surface text-text-secondary hover:text-text-primary"
            }`}
          >
            {c ? BUSINESS_CATEGORY_LABELS[c] : "Todos"}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-text-secondary">
        {near ? "Perto de você" : `Perto do ${DEFAULT_CENTER_LABEL}`} · até {RADIUS_M / 1000} km
      </p>
      {items.length === 0 ? (
        <EmptyState title="Nenhum parceiro nesta região ainda" icon={Store}>
          Conhece uma clínica ou pet shop que ajuda a comunidade? Convide para se cadastrar na MEL.
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,460px)]">
          <ul className="flex flex-col gap-3">
            {items.map((b) => (
              <li key={b.code}>
                <BusinessCard b={b} />
              </li>
            ))}
          </ul>
          <div className="lg:sticky lg:top-20 lg:self-start">
            <MapView
              key={`${origin.lat},${origin.lng},${cat}`}
              center={items[0]!.position}
              zoom={13}
              className="h-64 lg:h-[480px]"
              label={`Mapa com ${items.length} parceiro${items.length > 1 ? "s" : ""}`}
              pins={items.map((b) => ({ id: b.code, kind: "business", position: b.position, label: b.name }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
