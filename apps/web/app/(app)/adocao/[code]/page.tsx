import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, HeartHandshake, MapPin, MessageCircle, Minus, X } from "lucide-react";
import { Suspense } from "react";
import { ADOPTION_STATUS_LABELS, ageLabel, colorLabel, SEX_LABELS, SIZE_LABELS, SPECIES_LABELS, TEMPERAMENT_LABELS, type PublicAdoption } from "@mel/core";
import { getAdoption } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { createSessionClient } from "@/lib/supabase/server";
import { AdoptionStatusControls } from "@/components/adoption/AdoptionClient";
import { ReportButton } from "@/components/report/ReportButton";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";

const isCode = (c: string) => /^[a-z2-9]{6}$/i.test(c);

export async function generateMetadata({ params }: PageProps<"/adocao/[code]">): Promise<Metadata> {
  const { code } = await params;
  const a = isCode(code) ? await getAdoption(createPublicClient(), code).catch(() => null) : null;
  if (!a) return { title: "Anúncio não encontrado", robots: { index: false } };
  return {
    title: `Adote ${a.name}`,
    description: a.description.slice(0, 150),
    openGraph: a.photoUrls[0] ? { images: [{ url: a.photoUrls[0] }] } : undefined,
  };
}

export default function AdoptionPage({ params, searchParams }: PageProps<"/adocao/[code]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 pb-12">
      <Suspense
        fallback={
          <div className="px-4 pt-6">
            <LoadingState />
          </div>
        }
      >
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Health({ label, value }: { label: string; value: boolean | null }) {
  const Icon = value === null ? Minus : value ? Check : X;
  return (
    <li className="flex items-center gap-2">
      <Icon aria-hidden="true" className={`size-4 ${value ? "text-status-found" : "text-text-muted"}`} strokeWidth={2.25} />
      <span>
        {label}: <strong>{value === null ? "não informado" : value ? "sim" : "não"}</strong>
      </span>
    </li>
  );
}

async function Content({ params, searchParams }: PageProps<"/adocao/[code]">) {
  const { code } = await params;
  const q = await searchParams;
  if (!isCode(code)) notFound();
  const a = await getAdoption(await createSessionClient(), code);
  if (!a) notFound();
  const traits = [
    SPECIES_LABELS[a.species],
    a.breed,
    ageLabel(a.ageMonths),
    a.size && SIZE_LABELS[a.size].label,
    a.sex !== "unknown" && SEX_LABELS[a.sex],
    a.colorPrimary && colorLabel(a.colorPrimary),
  ].filter(Boolean);
  const open = a.status === "AVAILABLE" || a.status === "IN_PROCESS";

  return (
    <article className="flex flex-col gap-6">
      <Gallery a={a} />
      <div className="flex flex-col gap-6 px-[var(--mel-page-gutter)]">
        {a.isOwner && <OwnerPanel a={a} justPublished={Boolean(q.novo)} />}

        <header className="flex flex-col gap-2">
          <div>
            <StatusBadge status="adoption">{a.status === "AVAILABLE" ? "Para adoção" : ADOPTION_STATUS_LABELS[a.status]}</StatusBadge>
          </div>
          <h1 className="text-3xl font-bold">{a.name}</h1>
          <p className="text-lg text-text-secondary">{traits.join(" · ")}</p>
          {a.areaLabel && (
            <p className="flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-4 text-brand" strokeWidth={2} /> {a.areaLabel}
            </p>
          )}
        </header>

        {!a.isOwner && open && (
          <ButtonLink href={`/adocao/${a.code}/interesse`}>
            <HeartHandshake aria-hidden="true" className="size-5" strokeWidth={2} /> Quero adotar {a.name}
          </ButtonLink>
        )}
        {a.status === "ADOPTED" && <Alert tone="success">{a.name} já encontrou um lar. Obrigado a todos que ajudaram!</Alert>}

        {a.temperament.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Jeito dele">
            {a.temperament.map((t) => (
              <li key={t} className="rounded-full bg-status-adoption-soft px-3 py-1 text-sm font-semibold text-status-adoption">
                {TEMPERAMENT_LABELS[t]}
              </li>
            ))}
          </ul>
        )}

        <section aria-labelledby="sobre" className="flex flex-col gap-2">
          <h2 id="sobre" className="text-xl font-bold">
            Sobre {a.name}
          </h2>
          <p className="whitespace-pre-line">{a.description}</p>
        </section>

        <section aria-labelledby="saude" className="flex flex-col gap-2 rounded-card border border-border/70 bg-surface p-4 shadow-xs">
          <h2 id="saude" className="font-semibold">
            Saúde
          </h2>
          <ul className="flex flex-col gap-1.5">
            <Health label="Castrado" value={a.neutered} />
            <Health label="Vacinas em dia" value={a.vaccinated} />
            <Health label="Vermifugado" value={a.dewormed} />
          </ul>
        </section>

        {a.requirements && (
          <section aria-labelledby="requisitos" className="flex flex-col gap-2">
            <h2 id="requisitos" className="font-semibold">
              Requisitos de quem está doando
            </h2>
            <p className="whitespace-pre-line text-text-secondary">{a.requirements}</p>
          </section>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-text-secondary">Adoção na MEL é sempre gratuita. Desconfie de qualquer cobrança e denuncie.</p>
          {!a.isOwner && (open || a.status === "ADOPTED") && <ReportButton type="adoption" targetKey={a.code} />}
        </div>
      </div>
    </article>
  );
}

function Gallery({ a }: { a: PublicAdoption }) {
  const [first, ...rest] = a.photoUrls;
  return (
    <div className="flex flex-col gap-2">
      {first && (
        // eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio
        <img src={first} alt={`Foto de ${a.name}`} className="aspect-square w-full bg-surface-muted object-cover sm:rounded-b-hero" />
      )}
      {rest.length > 0 && (
        <div className="grid grid-cols-3 gap-2 px-[var(--mel-page-gutter)]">
          {rest.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio
            <img key={u} src={u} alt={`Foto ${i + 2} de ${a.name}`} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerPanel({ a, justPublished }: { a: PublicAdoption; justPublished: boolean }) {
  return (
    <section aria-label="Seu anúncio" className="flex flex-col gap-3 rounded-card border border-border bg-surface-warm p-4">
      {a.status === "PENDING_REVIEW" && (
        <Alert tone="info">
          {justPublished ? <strong>Anúncio enviado! </strong> : null}A equipe da MEL está revisando. Assim que for aprovado, ele aparece na
          lista de adoção.
        </Alert>
      )}
      {a.status === "REJECTED" && <Alert tone="error">O anúncio não foi aprovado.{a.reviewNote ? ` Motivo: ${a.reviewNote}` : ""}</Alert>}
      {(a.status === "AVAILABLE" || a.status === "IN_PROCESS" || a.status === "ADOPTED") && (
        <>
          <p className="font-semibold">Status do anúncio</p>
          <AdoptionStatusControls code={a.code} status={a.status} />
          <Link href="/conversas" className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-link hover:underline">
            <MessageCircle aria-hidden="true" className="size-4" strokeWidth={2} />
            {a.interests ? `${a.interests} interessado${a.interests > 1 ? "s" : ""}: ver conversas` : "Ainda sem interessados"}
          </Link>
        </>
      )}
    </section>
  );
}
