import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicLostCase } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { LoadingState } from "@/components/ui/States";
import { V2_FORMATS, type PosterV2Format } from "@/lib/poster/PosterV2";

// PROPOSTAS de novos cartazes, para aprovação do proprietário. Não substituem os
// modelos atuais (a página de cartazes e os downloads seguem iguais) e não têm link no app.
export const metadata: Metadata = { title: "Propostas de cartaz", robots: { index: false, follow: false } };

const ORDER: PosterV2Format[] = ["impressao", "square", "portrait", "story", "landscape"];

export default function PosterProposalsPage({ params }: PageProps<"/alerta/[code]/cartaz/propostas">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Preparando as propostas…" />}>{params.then(({ code }) => <Proposals code={code} />)}</Suspense>
    </main>
  );
}

async function Proposals({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const c = await getPublicLostCase(createPublicClient(), code);
  if (!c || c.status === "CLOSED") notFound();
  const base = `/alerta/${c.code}/cartaz`;
  const v = c.pet.photos.map((p) => `${p.isPrimary ? 1 : 0}${p.focus ? `${p.focus.x}.${p.focus.y}` : "a"}`).join("-").slice(0, 60) || "0";
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={base} className="text-sm font-semibold text-link underline-offset-4 hover:underline">
          ‹ Cartazes atuais
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Propostas de cartaz: {c.pet.name}</h1>
        <p className="mt-1 text-text-secondary">
          Em avaliação. Foto grande em primeiro lugar; com várias fotos, uma principal e até duas menores. Os cartazes atuais continuam valendo até a aprovação.
        </p>
      </div>
      <ul className="flex flex-col gap-6">
        {ORDER.map((f) => {
          const meta = V2_FORMATS[f];
          const src = `${base}/${f}?modelo=proposta&v=${v}`;
          return (
            <li key={f} className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card" data-testid={`proposta-${f}`}>
              <div>
                <h2 className="font-bold">{meta.label}</h2>
                <p className="text-sm text-text-secondary">
                  {meta.hint} · {meta.width}×{meta.height}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada sob demanda */}
              <img
                src={src}
                alt={`Proposta de cartaz ${meta.label.toLowerCase()} de ${c.pet.name}`}
                loading="lazy"
                width={meta.width}
                height={meta.height}
                className={`w-full rounded-md border border-border ${f === "story" ? "mx-auto max-w-72" : f === "impressao" || f === "portrait" ? "mx-auto max-w-md" : ""}`}
              />
              <a href={`${src}&baixar=1`} download className="inline-flex min-h-12 items-center justify-center rounded-md border-2 border-border-strong bg-surface px-4 font-semibold hover:bg-surface-muted">
                ⬇ Baixar proposta {meta.label.toLowerCase()}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
