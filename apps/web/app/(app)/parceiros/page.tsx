import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BadgeCheck, BellRing, HeartHandshake, MapPinned, Store, type LucideIcon } from "lucide-react";
import { Suspense } from "react";
import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, DEFAULT_CENTER, DEFAULT_CENTER_LABEL, type BusinessCategory, type LatLng } from "@mel/core";
import { listBusinesses } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { MapView } from "@/components/location/MapView";
import { BusinessCard } from "@/components/partners/BusinessCard";
import { NearMeChip } from "@/components/partners/PartnerClient";
import { PartnerHero } from "@/components/partners/PartnerHero";
import { PartnerSignupForm } from "@/components/partners/PartnerSignupForm";
import { InfoTip } from "@/components/ui/InfoTip";
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
    <main className="mel-container flex-1 pt-8 pb-14 sm:pt-12">
      <ProgramIntro />
      <section id="cadastro" aria-labelledby="cadastro-titulo" className="mx-auto mt-10 max-w-[900px] scroll-mt-24 sm:mt-14">
        <div className="rounded-[22px] border border-border bg-surface p-6 md:p-8">
          <div className="flex items-center gap-1">
            <h2 id="cadastro-titulo" className="text-[28px] font-extrabold tracking-[-0.02em]">
              Cadastrar minha organização
            </h2>
            <InfoTip label="Preciso de conta?">
              Você pode ler e preencher tudo sem conta. Para enviar a inscrição, pedimos login, assim a moderação consegue falar com você e só você
              edita o perfil.
            </InfoTip>
          </div>
          <p className="mt-1.5 text-text-secondary">Escolha como você atua. Os campos mudam conforme a categoria.</p>
          {/* Como funciona, em três passos curtos (antes era um cartão de texto ao lado do título da página). */}
          <ol className="mt-5 mb-7 grid gap-2.5 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3 rounded-xl bg-surface-muted/70 p-3">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <PartnerSignupForm />
        </div>
      </section>
      <h2 id="perto" className="mt-14 mb-5 scroll-mt-24 text-2xl font-extrabold tracking-[-0.02em]">
        Parceiros perto de você
      </h2>
      <Suspense fallback={<LoadingState />}>{searchParams.then((q) => <Results {...parse(q)} />)}</Suspense>
    </main>
  );
}

const BENEFITS: { title: string; text: string; Icon: LucideIcon }[] = [
  { title: "Ponto de apoio no mapa", text: "Quem encontra um animal sabe onde pedir ajuda perto.", Icon: MapPinned },
  { title: "Alertas da sua região", text: "Receba casos próximos e ajude a divulgar.", Icon: BellRing },
  { title: "Fila de interessados", text: "Adoção com interessados já filtrados (ONGs e protetores).", Icon: HeartHandshake },
  { title: "Selo de parceiro", text: "Depois da análise da moderação.", Icon: BadgeCheck },
];

const STEPS = [
  "Escolha a categoria e preencha o essencial (2 minutos).",
  "A moderação analisa em até 3 dias úteis.",
  "Aprovado, seu perfil aparece no mapa e na lista de parceiros.",
] as const;

/** Hero do programa: proposta, chamadas e benefícios à esquerda; a rede de apoio animada à direita. */
function ProgramIntro() {
  return (
    <section aria-labelledby="programa" className="grid items-center gap-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
      <div className="motion-safe:animate-enter">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[13px] font-extrabold tracking-[.08em] text-primary uppercase">
          <Store aria-hidden="true" className="size-4" strokeWidth={2.25} />
          Programa de parceiros
        </p>
        <h1 id="programa" className="mt-4 text-[clamp(38px,5.4vw,60px)] leading-[1.02] font-black tracking-[-0.035em]">
          Seja um parceiro da MEL
        </h1>
        <p className="mt-4 max-w-[54ch] text-lg text-text-secondary">
          Clínicas, pet shops, ONGs, protetores e serviços que ajudam animais a voltar para casa. Parceria pela causa: sem mensalidade, sem venda
          dentro da MEL.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#cadastro"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground shadow-primary transition-transform duration-200 ease-mel hover:bg-primary-hover motion-safe:hover:-translate-y-0.5"
          >
            Quero me inscrever
          </a>
          <a
            href="#perto"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-border-strong px-6 font-bold text-text-primary transition-colors duration-200 ease-mel hover:bg-surface-muted"
          >
            <MapPinned aria-hidden="true" className="size-5" strokeWidth={2} />
            Ver parceiros perto de mim
          </a>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-3">
          {BENEFITS.map(({ title, text, Icon }) => (
            <li key={title} className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface/70 p-3 sm:items-start sm:gap-3 sm:p-3.5">
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary sm:size-10">
                <Icon className="size-5" strokeWidth={2} />
              </span>
              <span className="flex flex-col leading-snug">
                <strong className="text-sm sm:text-base">{title}</strong>
                <span className="hidden text-sm text-text-secondary sm:block">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="motion-safe:animate-enter">
        <PartnerHero />
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
