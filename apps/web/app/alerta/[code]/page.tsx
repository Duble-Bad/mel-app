import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  alertPath,
  breedLabel,
  colorLabel,
  describeAge,
  formatBrPhone,
  formatDateTimeBr,
  petSummary,
  SEX_LABELS,
  SIZE_LABELS,
  timeAgo,
  WEARING_LABELS,
  whatsappChatUrl,
  type PublicLostCase,
} from "@mel/core";
import { getPublicLostCase, getTimeline } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { siteOrigin } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";
import { createSessionClient } from "@/lib/supabase/server";
import { MapView } from "@/components/location/MapView";
import { ShareAlert } from "@/components/lost/ShareAlert";
import { LiveSightings } from "@/components/sighting/LiveSightings";
import { Timeline } from "@/components/sighting/Timeline";
import { Alert } from "@/components/ui/Alert";
import { LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";

const isCode = (code: string) => /^[a-z2-9]{6}$/i.test(code);

export async function generateMetadata({ params }: PageProps<"/alerta/[code]">): Promise<Metadata> {
  const { code } = await params;
  const c = isCode(code) ? await getPublicLostCase(createPublicClient(), code).catch(() => null) : null;
  if (!c) return { title: "Alerta não encontrado", robots: { index: false } };
  const title = c.status === "FOUND" ? `ENCONTRADO: ${c.pet.name}` : `PERDIDO: ${c.pet.name}`;
  const description = [
    petSummary(c.pet),
    c.areaLabel && `visto por último perto de ${c.areaLabel}`,
    c.lostAt && formatDateTimeBr(c.lostAt),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title,
    description,
    // Indexação só quando o tutor autorizar (padrão: não).
    robots: { index: c.indexable, follow: c.indexable },
    openGraph: {
      title: `${title} — ajude a encontrar`,
      description,
      type: "article",
      // Prévia do link = cartaz (foto + PROCURA-SE + QR), gerado na hora.
      images: [{ url: `${await siteOrigin()}/alerta/${c.code}/cartaz/og`, width: 1200, height: 630, alt: `${title} — cartaz MEL` }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default function AlertPage({ params, searchParams }: PageProps<"/alerta/[code]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 pb-10">
      <Suspense fallback={<div className="px-4 pt-6"><LoadingState label="Carregando alerta…" /></div>}>
        <AlertContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AlertContent({ params, searchParams }: PageProps<"/alerta/[code]">) {
  const { code } = await params;
  const query = await searchParams;
  if (!isCode(code)) notFound();
  // Sessão: o tutor vê a própria visão (is_owner) — os dados continuam os públicos.
  const supabase = await createSessionClient();
  const c = await getPublicLostCase(supabase, code);
  if (!c) notFound();
  const photo = c.pet.photos[0];
  const [timeline, user] = await Promise.all([
    getTimeline(supabase, c.code).catch((err) => {
      console.error("[alerta] linha do tempo indisponível", err);
      return [];
    }),
    getSessionUser(),
  ]);
  const visibleSightings = timeline.filter((s) => !s.hidden);

  return (
    <article className="flex flex-col gap-6">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto já otimizada (1280px) no upload
        <img src={photo.url} alt={`Foto de ${c.pet.name}`} className="aspect-square w-full bg-surface-muted object-cover sm:rounded-b-lg" />
      ) : (
        <div className="flex aspect-[3/1] items-center justify-center bg-surface-muted text-5xl" aria-hidden="true">
          {c.pet.species === "cat" ? "🐱" : c.pet.species === "dog" ? "🐶" : "🐾"}
        </div>
      )}

      <div className="flex flex-col gap-6 px-4">
        {c.isOwner && query.novo && (
          <Alert tone="success">
            <strong>Alerta MEL ativado.</strong> Agora outras pessoas poderão ajudar na busca. Compartilhe para alcançar
            ainda mais pessoas.
          </Alert>
        )}

        <header className="flex flex-col gap-2">
          <div>
            {c.status === "FOUND" ? <StatusBadge status="found">Encontrado</StatusBadge> : <StatusBadge status="lost">Perdido</StatusBadge>}
          </div>
          <h1 className="text-3xl font-bold">{c.pet.name}</h1>
          <p className="text-lg text-text-secondary">{petSummary(c.pet)}</p>
          {c.lostAt && (
            <p className="font-semibold">
              Desapareceu {timeAgo(c.lostAt)}
              <span className="font-normal text-text-secondary">
                {" "}
                · {formatDateTimeBr(c.lostAt)}
                {c.lostAtUncertain && " (horário aproximado)"}
              </span>
            </p>
          )}
          {c.areaLabel && <p>Visto por último perto de <strong>{c.areaLabel}</strong></p>}
        </header>

        {!c.isOwner && c.status === "ACTIVE" && (
          <Link
            href={`/avistamento/${c.code}`}
            className="inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-lg bg-status-sighting px-5 text-xl font-extrabold tracking-wide text-text-inverse uppercase shadow-card"
          >
            <span aria-hidden="true">👁</span> Eu vi este pet
          </Link>
        )}

        <section aria-labelledby="compartilhar" className="flex flex-col gap-2">
          <h2 id="compartilhar" className="font-bold">
            {c.isOwner ? "Compartilhe para alcançar mais pessoas" : "Ajude compartilhando"}
          </h2>
          <ShareAlert lostCase={c} path={alertPath(c.code)} />
        </section>

        <Contact c={c} />

        <Facts c={c} />

        {c.point && (
          <section aria-labelledby="mapa" className="flex flex-col gap-2">
            <h2 id="mapa" className="font-bold">
              {visibleSightings.length ? "Mapa da busca" : "Último local conhecido"}
            </h2>
            <MapView
              // Remonta quando chegam avistamentos novos (o mapa é estático).
              key={visibleSightings.length}
              center={c.point}
              zoom={15}
              pins={[
                { id: c.code, kind: "lost", position: c.point, label: `${c.pet.name}, último local conhecido` },
                ...visibleSightings.map((s, i) => ({
                  id: s.id,
                  kind: "sighting" as const,
                  position: s.position,
                  label: `avistamento ${i + 1}, ${formatDateTimeBr(s.seenAt)}`,
                })),
              ]}
              path={[c.point, ...visibleSightings.map((s) => s.position)]}
              label={`Mapa: ${c.pet.name} visto por último perto de ${c.areaLabel ?? "este ponto"}${
                visibleSightings.length ? ` e ${visibleSightings.length} avistamento(s)` : ""
              }`}
            />
            <p className="text-sm text-text-secondary">
              {`Ponto vermelho (!): último local conhecido${c.pointIsExact ? "" : ", aproximado (cerca de 250 m)"}. `}
              {visibleSightings.length > 0 && "Pontos com olho (👁): avistamentos, ligados por linha tracejada em ordem de horário."}
            </p>
          </section>
        )}

        <section aria-labelledby="linha-do-tempo-titulo" id="linha-do-tempo" className="flex scroll-mt-4 flex-col gap-2">
          <h2 id="linha-do-tempo-titulo" className="font-bold">
            Linha do tempo
          </h2>
          <Timeline
            petName={c.pet.name}
            lastSeen={c.lostAt ? { at: c.lostAt, areaLabel: c.areaLabel } : null}
            sightings={timeline}
            isOwner={c.isOwner}
          />
        </section>

        {c.isOwner && user && <LiveSightings userId={user.id} code={c.code} />}

        <p className="text-sm text-text-secondary">
          MEL ID {c.pet.melId} · Alerta {c.code}
        </p>
      </div>
    </article>
  );
}

function Contact({ c }: { c: PublicLostCase }) {
  if (c.isOwner || (!c.contactWhatsapp && !c.contactPhone)) return null;
  return (
    <section aria-labelledby="contato" className="flex flex-col gap-2">
      <h2 id="contato" className="font-bold">
        Viu {c.pet.name}? Fale com o tutor
      </h2>
      {c.contactWhatsapp && (
        <a
          href={whatsappChatUrl(c.contactWhatsapp, `Olá! Vi o alerta da MEL sobre ${c.pet.name}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-brand-primary px-4 text-lg font-bold text-brand-on-primary"
        >
          WhatsApp do tutor
        </a>
      )}
      {c.contactPhone && (
        <a
          href={`tel:+55${c.contactPhone}`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-border-strong bg-surface px-4 font-semibold"
        >
          Ligar: {formatBrPhone(c.contactPhone)}
        </a>
      )}
      <p className="text-sm text-text-secondary">
        Nunca pague nada antes de ver o animal pessoalmente. A MEL nunca pede pagamento.
      </p>
    </section>
  );
}

function Facts({ c }: { c: PublicLostCase }) {
  const p = c.pet;
  const colors = [p.colorPrimary, ...p.colorsSecondary].filter(Boolean).map(colorLabel).join(", ");
  const rows: [string, string | null][] = [
    ["Raça", p.breed ? breedLabel(p.breed) : null],
    ["Sexo", p.sex !== "unknown" ? SEX_LABELS[p.sex] : null],
    ["Porte", p.size ? `${SIZE_LABELS[p.size].label} (${SIZE_LABELS[p.size].hint})` : null],
    ["Idade", describeAge(p)],
    ["Cores", colors || null],
    ["Usando", c.wearing.length ? c.wearing.map((w) => WEARING_LABELS[w]).join(", ") : null],
  ];
  const visible = rows.filter(([, v]) => v);
  // Pet cadastrado só com o essencial: nada de título sem conteúdo.
  if (!visible.length && !p.uniqueMarks && !c.notes) return null;
  return (
    <section aria-labelledby="como-reconhecer" className="flex flex-col gap-3">
      <h2 id="como-reconhecer" className="font-bold">
        Como reconhecer
      </h2>
      {visible.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-surface p-4 shadow-card">
          {visible.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-text-secondary">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.uniqueMarks && <p className="whitespace-pre-line">{p.uniqueMarks}</p>}
      {c.notes && (
        <Alert tone="info">
          <span className="whitespace-pre-line">{c.notes}</span>
        </Alert>
      )}
    </section>
  );
}
