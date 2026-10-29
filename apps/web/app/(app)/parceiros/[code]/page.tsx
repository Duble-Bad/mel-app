import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtSign, BadgeCheck, Clock, Globe, MapPin, MessageCircle, Phone, Store, Tag } from "lucide-react";
import { Suspense } from "react";
import { BUSINESS_CATEGORY_LABELS, type PublicBusiness } from "@mel/core";
import { getBusiness } from "@mel/data";
import { getCurrentProfile } from "@/lib/session";
import { createPublicClient } from "@/lib/supabase/public";
import { createSessionClient } from "@/lib/supabase/server";
import { MapView } from "@/components/location/MapView";
import { NewOfferForm, OfferActions } from "@/components/partners/PartnerClient";
import { Alert } from "@/components/ui/Alert";
import { LoadingState } from "@/components/ui/States";

const isCode = (c: string) => /^[a-z2-9]{6}$/i.test(c);

export async function generateMetadata({ params }: PageProps<"/parceiros/[code]">): Promise<Metadata> {
  const { code } = await params;
  const b = isCode(code) ? await getBusiness(createPublicClient(), code).catch(() => null) : null;
  if (!b) return { title: "Parceiro não encontrado", robots: { index: false } };
  return { title: b.name, description: b.description.slice(0, 150) };
}

export default function PartnerPage({ params, searchParams }: PageProps<"/parceiros/[code]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <Suspense fallback={<LoadingState />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const phoneBr = (d: string) => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`);

async function Content({ params, searchParams }: PageProps<"/parceiros/[code]">) {
  const { code } = await params;
  const q = await searchParams;
  if (!isCode(code)) notFound();
  const [b, profile] = await Promise.all([getBusiness(await createSessionClient(), code), getCurrentProfile()]);
  if (!b) notFound();
  const isMod = profile?.role === "moderator" || profile?.role === "admin";
  const approved = b.status === "APPROVED";

  return (
    <article className="flex flex-col gap-6">
      {b.isOwner && <OwnerStatus b={b} justPublished={Boolean(q.novo)} />}
      <header className="flex items-start gap-4">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft text-primary-soft-foreground">
          {b.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo reduzido no envio
            <img src={b.logoUrl} alt={`Logo de ${b.name}`} className="size-full object-cover" />
          ) : (
            <Store aria-hidden="true" className="size-9" strokeWidth={1.75} />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-3xl font-bold">{b.name}</h1>
          <p className="text-text-secondary">{BUSINESS_CATEGORY_LABELS[b.category]}</p>
          {b.helpsLost && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-status-found">
              <BadgeCheck aria-hidden="true" className="size-4" strokeWidth={2} /> Ajuda com pets perdidos
            </p>
          )}
        </div>
      </header>

      <p className="whitespace-pre-line">{b.description}</p>

      <section aria-labelledby="contato" className="flex flex-col gap-3 rounded-card border border-border/70 bg-surface p-4 shadow-xs">
        <h2 id="contato" className="font-semibold">
          Onde e como falar
        </h2>
        <ul className="flex flex-col gap-2.5">
          <Row icon={MapPin}>{b.addressLabel}</Row>
          {b.hours && <Row icon={Clock}>{b.hours}</Row>}
          {b.phone && (
            <Row icon={Phone}>
              <a href={`tel:+55${b.phone}`} className="font-semibold text-link hover:underline">
                {phoneBr(b.phone)}
              </a>
            </Row>
          )}
          {b.whatsapp && (
            <Row icon={MessageCircle}>
              <a href={`https://wa.me/55${b.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-link hover:underline">
                WhatsApp {phoneBr(b.whatsapp)}
              </a>
            </Row>
          )}
          {b.website && (
            <Row icon={Globe}>
              <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold break-all text-link hover:underline">
                {b.website.replace(/^https:\/\//, "")}
              </a>
            </Row>
          )}
          {b.instagram && (
            <Row icon={AtSign}>
              <a href={`https://instagram.com/${b.instagram}`} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-link hover:underline">
                @{b.instagram}
              </a>
            </Row>
          )}
        </ul>
        <MapView center={b.position} zoom={15} label={`Localização de ${b.name}`} pins={[{ id: b.code, kind: "business", position: b.position, label: b.name }]} />
      </section>

      {(b.offers.length > 0 || (b.isOwner && approved)) && (
        <section aria-labelledby="ofertas" className="flex flex-col gap-3">
          <h2 id="ofertas" className="text-xl font-bold">
            Ofertas
          </h2>
          {b.offers.length === 0 ? (
            <p className="text-text-secondary">Nenhuma oferta publicada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {b.offers.map((o) => (
                <li key={o.id} data-testid="business-offer" className="flex flex-col gap-1.5 rounded-card border border-border/70 bg-surface p-4 shadow-xs">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <Tag aria-hidden="true" className="size-4 text-brand" strokeWidth={2} /> {o.title}
                    {o.isSponsored && <span className="rounded-full border border-border px-2 py-0.5 text-caption font-semibold text-text-secondary">Patrocinado</span>}
                  </p>
                  {o.description && <p className="text-sm text-text-secondary">{o.description}</p>}
                  {o.endsAt && <p className="text-sm text-text-secondary">Válida até {o.endsAt.split("-").reverse().join("/")}</p>}
                  {(b.isOwner || isMod) && approved && <OfferActions offer={o} canEdit={b.isOwner} canSponsor={isMod} />}
                </li>
              ))}
            </ul>
          )}
          {b.isOwner && approved && <NewOfferForm code={b.code} />}
        </section>
      )}
      <p className="text-sm text-text-secondary">Parceiro revisado pela equipe da MEL. Ofertas marcadas como “Patrocinado” são divulgação paga ou apoio à rede.</p>
    </article>
  );
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-secondary" strokeWidth={2} />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function OwnerStatus({ b, justPublished }: { b: PublicBusiness; justPublished: boolean }) {
  if (b.status === "PENDING_REVIEW")
    return (
      <Alert tone="info">
        {justPublished ? <strong>Cadastro enviado! </strong> : null}A equipe da MEL está revisando. Assim que for aprovado, sua empresa aparece no
        diretório e no mapa.
      </Alert>
    );
  if (b.status === "REJECTED") return <Alert tone="error">O cadastro não foi aprovado.{b.reviewNote ? ` Motivo: ${b.reviewNote}` : ""}</Alert>;
  if (b.status === "SUSPENDED") return <Alert tone="error">Este perfil está suspenso pela moderação.</Alert>;
  return <Alert tone="success">Sua empresa está publicada no diretório. Publique ofertas abaixo.</Alert>;
}
