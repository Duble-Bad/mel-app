import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Lock, MapPin, PawPrint, Radar } from "lucide-react";
import { Suspense } from "react";
import {
  colorLabel,
  formatDateTimeBr,
  FOUND_CUSTODY_PUBLIC,
  SEX_LABELS,
  SIZE_LABELS,
  SPECIES_LABELS,
  timeAgo,
  type PublicFoundCase,
} from "@mel/core";
import { getPublicFoundCase, listMyMatches } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { createSessionClient } from "@/lib/supabase/server";
import { CloseFoundCase } from "@/components/found/CloseFoundCase";
import { MatchCard } from "@/components/found/MatchCard";
import { ReportButton } from "@/components/report/ReportButton";
import { MapView } from "@/components/location/MapView";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";

const isCode = (code: string) => /^[a-z2-9]{6}$/i.test(code);
const title = (f: PublicFoundCase) => `${f.custody === "street" ? "Visto solto" : "Encontrado"}: ${SPECIES_LABELS[f.species].toLowerCase()}${f.areaLabel ? ` perto de ${f.areaLabel}` : ""}`;

export async function generateMetadata({ params }: PageProps<"/encontrado/[code]">): Promise<Metadata> {
  const { code } = await params;
  const f = isCode(code) ? await getPublicFoundCase(createPublicClient(), code).catch(() => null) : null;
  if (!f) return { title: "Não encontrado", robots: { index: false } };
  return {
    title: title(f),
    description: "É seu? A MEL ajuda a conectar quem encontrou com o tutor.",
    robots: { index: false },
    openGraph: f.photoUrl ? { images: [{ url: f.photoUrl }] } : undefined,
  };
}

export default function FoundCasePage({ params, searchParams }: PageProps<"/encontrado/[code]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 pb-12">
      <Suspense fallback={<div className="px-4 pt-6"><LoadingState /></div>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ params, searchParams }: PageProps<"/encontrado/[code]">) {
  const { code } = await params;
  const query = await searchParams;
  if (!isCode(code)) notFound();
  const supabase = await createSessionClient();
  const f = await getPublicFoundCase(supabase, code);
  if (!f) notFound();
  const matches = f.isReporter ? await listMyMatches(supabase, f.code).catch(() => []) : [];
  const active = f.status === "ACTIVE";
  const traits = [
    SPECIES_LABELS[f.species],
    f.breedGuess,
    f.size && SIZE_LABELS[f.size].label,
    f.colorPrimary && colorLabel(f.colorPrimary),
    f.sex !== "unknown" && SEX_LABELS[f.sex],
  ].filter(Boolean);

  return (
    <article className="flex flex-col gap-6">
      {f.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio
        <img src={f.photoUrl} alt="Foto do animal encontrado" className="aspect-square w-full bg-surface-muted object-cover sm:rounded-b-hero" />
      ) : (
        <div className="flex aspect-[3/1] items-center justify-center bg-surface-muted text-text-muted" aria-hidden="true">
          <PawPrint className="size-12" strokeWidth={1.5} />
        </div>
      )}

      <div className="flex flex-col gap-6 px-[var(--mel-page-gutter)]">
        {f.isReporter && query.novo && (
          <Alert tone="success">
            <strong>Publicado.</strong> Obrigado por ajudar! O Radar MEL já cruzou com os alertas de pets perdidos por perto.
          </Alert>
        )}

        <header className="flex flex-col gap-2">
          <div>
            {active ? (
              f.custody === "street" ? <StatusBadge status="sighting">Visto solto</StatusBadge> : <StatusBadge status="found">Encontrado</StatusBadge>
            ) : (
              <StatusBadge status="draft">{f.status === "REUNITED" ? "Devolvido ao tutor" : "Encerrado"}</StatusBadge>
            )}
          </div>
          <h1 className="text-3xl font-bold">{f.custody === "street" ? "Visto solto na rua" : "Animal encontrado"}</h1>
          <p className="text-lg text-text-secondary">{traits.join(" · ")}</p>
        </header>

        <ul className="flex flex-col gap-2.5 rounded-card border border-border/70 bg-surface p-4 shadow-xs">
          {f.areaLabel && (
            <li className="flex items-start gap-2.5">
              <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={1.75} />
              <span>
                Perto de <strong>{f.areaLabel}</strong> <span className="text-text-secondary">(região aproximada)</span>
              </span>
            </li>
          )}
          <li className="flex items-start gap-2.5">
            <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={1.75} />
            <span>
              {formatDateTimeBr(f.foundAt)} <span className="text-text-secondary">· {timeAgo(f.foundAt)}</span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <PawPrint aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={1.75} />
            <span>{FOUND_CUSTODY_PUBLIC[f.custody]}</span>
          </li>
        </ul>
        {f.description && <p className="whitespace-pre-line">{f.description}</p>}

        {f.isReporter && (
          <>
            <section id="radar" aria-labelledby="radar-titulo" className="flex scroll-mt-4 flex-col gap-3">
              <h2 id="radar-titulo" className="flex items-center gap-2 text-xl font-bold">
                <Radar aria-hidden="true" className="size-5 text-brand" strokeWidth={2} /> Radar MEL
              </h2>
              {matches.length ? (
                <>
                  <p className="text-text-secondary">
                    Encontramos {matches.length === 1 ? "1 possível correspondência" : `${matches.length} possíveis correspondências`} perto daqui.
                  </p>
                  {matches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </>
              ) : (
                <EmptyState title="Ainda não há alerta parecido" icon={Radar}>
                  Vamos avisar você se aparecer um pet perdido com essas características por perto. Compartilhar este link
                  também ajuda o tutor a achar.
                </EmptyState>
              )}
            </section>

            {f.verificationHint && (
              <section id="conferir" aria-labelledby="conferir-titulo" className="flex scroll-mt-4 flex-col gap-2 rounded-card border border-border bg-surface-warm p-4">
                <h2 id="conferir-titulo" className="flex items-center gap-2 font-semibold">
                  <Lock aria-hidden="true" className="size-4 text-brand" strokeWidth={2} /> Seu detalhe para conferir o tutor
                </h2>
                <p className="text-lg font-semibold">{f.verificationHint}</p>
                <p className="text-sm text-text-secondary">
                  Só você vê. Antes de devolver, peça ao tutor que descreva esse detalhe sem dar a dica. A MEL nunca pede
                  pagamento, e você também não deve pagar nem cobrar nada.
                </p>
              </section>
            )}

            {active && (
              <section aria-label="Encerrar publicação" className="flex flex-col gap-2">
                <CloseFoundCase code={f.code} />
              </section>
            )}
          </>
        )}

        {!f.isReporter && active && (
          <section aria-labelledby="e-seu" className="flex flex-col gap-3 rounded-card border border-border/70 bg-surface p-5 shadow-sm">
            <h2 id="e-seu" className="text-xl font-bold">
              Este pet é seu?
            </h2>
            <p className="text-text-secondary">
              Publique um alerta do seu pet: o Radar MEL compara com este animal na hora e avisa quem encontrou.
            </p>
            <ButtonLink href="/publicar/perdido">Publicar alerta do meu pet</ButtonLink>
          </section>
        )}

        {!f.isReporter && (
          <div className="flex justify-end">
            <ReportButton type="found_case" targetKey={f.code} />
          </div>
        )}

        {f.point && (
          <section aria-labelledby="mapa" className="flex flex-col gap-2">
            <h2 id="mapa" className="font-bold">
              Região aproximada
            </h2>
            <MapView
              center={f.point}
              zoom={14}
              pins={[{ id: f.code, kind: f.custody === "street" ? "sighting" : "found", position: f.point, label: "Região aproximada" }]}
              label="Mapa da região aproximada onde o animal foi encontrado"
            />
          </section>
        )}
      </div>
    </article>
  );
}
