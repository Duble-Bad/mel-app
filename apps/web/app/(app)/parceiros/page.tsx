import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CircleCheck, Store } from "lucide-react";
import { Suspense } from "react";
import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, DEFAULT_CENTER, DEFAULT_CENTER_LABEL, type BusinessCategory, type LatLng } from "@mel/core";
import { listBusinesses } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { MapView } from "@/components/location/MapView";
import { BusinessCard } from "@/components/partners/BusinessCard";
import { NearMeChip } from "@/components/partners/PartnerClient";
import { PartnerSignupForm } from "@/components/partners/PartnerSignupForm";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Parceiros",
  description: "Clínicas, pet shops, ONGs, protetores e serviços que ajudam a rede MEL. Inscrição gratuita, revisada pela moderação.",
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
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-[var(--mel-page-gutter)] pt-8 pb-14 sm:pt-12">
      <ProgramIntro />
      <section id="cadastro" aria-labelledby="cadastro-titulo" className="mx-auto mt-10 max-w-[900px] scroll-mt-24 sm:mt-14">
        <div className="rounded-[22px] border border-border bg-surface p-6 md:p-8">
          <h2 id="cadastro-titulo" className="text-[28px] font-extrabold tracking-[-0.02em]">
            Cadastrar minha organização
          </h2>
          <p className="mt-1.5 mb-6 text-text-secondary">Escolha como você atua. Os campos mudam conforme a categoria.</p>
          <PartnerSignupForm />
        </div>
      </section>
      <h2 className="mt-14 mb-5 text-2xl font-extrabold tracking-[-0.02em]">Parceiros perto de você</h2>
      <Suspense fallback={<LoadingState />}>{searchParams.then((q) => <Results {...parse(q)} />)}</Suspense>
    </main>
  );
}

const BENEFITS = [
  { title: "Ponto de apoio no mapa", text: "quem encontra um animal sabe onde pedir ajuda perto." },
  { title: "Alertas da sua região", text: "receba casos próximos e ajude a divulgar." },
  { title: "Adoção com fila de interessados", text: "(ONGs e protetores)." },
  { title: "Selo de parceiro", text: "depois da análise da moderação." },
] as const;

const STEPS = [
  "Escolha a categoria e preencha o essencial (2 minutos).",
  "A moderação analisa em até 3 dias úteis.",
  "Aprovado, seu perfil aparece no mapa e na lista de parceiros.",
] as const;

/** O programa explicado antes de pedir login; o formulário vem logo abaixo, na mesma página. */
function ProgramIntro() {
  return (
    <section aria-labelledby="programa" className="grid items-center gap-7 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
      <div className="motion-safe:animate-enter">
        <p className="text-[13px] font-extrabold tracking-[.12em] text-primary uppercase">Programa de parceiros</p>
        <h1 id="programa" className="mt-2.5 text-[clamp(34px,5vw,52px)] leading-[1.05] font-black tracking-[-0.03em]">
          Seja um parceiro da MEL
        </h1>
        <p className="mt-3.5 max-w-[58ch] text-lg text-text-secondary">
          Clínicas, pet shops, ONGs, protetores e serviços que ajudam animais a voltar para casa. Parceria pela causa: sem mensalidade, sem venda
          dentro da MEL.
        </p>
        <ul className="mt-5.5 grid gap-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex items-start gap-3">
              <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-primary" strokeWidth={2} />
              <span>
                <strong>{b.title}:</strong> {b.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3.5 rounded-[22px] border border-border bg-surface p-6 motion-safe:animate-enter md:p-8">
        <h2 className="text-[22px] font-extrabold">Antes de começar</h2>
        <p className="text-text-secondary">
          Você pode ler e preencher tudo sem conta. Para enviar a inscrição, pedimos login, assim a moderação consegue falar com você e só você
          edita o perfil.
        </p>
        <ol className="m-0 grid list-decimal gap-2 pl-5 text-text-secondary">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <a
          href="#cadastro"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-[22px] font-bold text-primary-foreground shadow-primary transition-transform duration-200 ease-mel hover:bg-primary-hover motion-safe:hover:-translate-y-0.5"
        >
          Quero me inscrever
        </a>
      </div>
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
        <EmptyState title="Ainda não há parceiros aqui" icon={Store}>
          Conhece uma clínica, ONG ou protetor que ajuda a comunidade?{" "}
          <a href="#cadastro" className="font-semibold text-link underline underline-offset-2">
            Indique ou cadastre um parceiro
          </a>
          .
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
