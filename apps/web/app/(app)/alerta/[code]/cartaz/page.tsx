import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Download, Printer } from "lucide-react";
import { DOWNLOADABLE_FORMATS, POSTER_FORMATS } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { InfoTip } from "@/components/ui/InfoTip";
import { LoadingState } from "@/components/ui/States";
import { PosterPhotoEditor } from "@/components/lost/PosterPhotoEditor";

export const metadata: Metadata = { title: "Cartaz", robots: { index: false } };

export default function PosterPage({ params }: PageProps<"/alerta/[code]/cartaz">) {
  return (
    <main className="mel-container max-w-[1184px] flex-1 pt-6 pb-12">
      <Suspense fallback={<LoadingState label="Preparando o cartaz…" />}>
        {params.then(({ code }) => (
          <PosterContent code={code} />
        ))}
      </Suspense>
    </main>
  );
}

async function PosterContent({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const c = await getPublicLostCase(createPublicClient(), code);
  if (!c || c.status === "CLOSED") notFound();
  const base = `/alerta/${c.code}/cartaz`;
  // Versão das fotos (capa e enquadramento): muda o endereço da imagem quando o tutor ajusta.
  const v = c.pet.photos.map((p) => `${p.isPrimary ? 1 : 0}${p.focus ? `${p.focus.x}.${p.focus.y}` : "a"}`).join("-").slice(0, 60) || "0";

  return (
    // Desktop: foto do cartaz e A4 à esquerda (fixos); os formatos para baixar em grade à direita.
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/alerta/${c.code}`} className="text-sm font-semibold text-link underline-offset-4 hover:underline">
          ‹ Voltar ao alerta
        </Link>
        <div className="mt-2 flex items-center gap-1">
          <h1 className="text-2xl font-bold lg:text-3xl">Cartaz de {c.pet.name}</h1>
          <InfoTip label="Sobre os cartazes">
            <p>O QR Code abre o alerta com as fotos e a linha do tempo.</p>
            <p className="mt-2 text-text-secondary">
              Telefone só aparece no cartaz se você autorizou no alerta. Para Stories do Instagram: baixe o formato “Stories” e
              publique pelo app do Instagram.
            </p>
          </InfoTip>
        </div>
        <p className="mt-1 text-text-secondary">Baixe e poste nas redes, mande nos grupos ou imprima.</p>
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <PosterPhotoEditor code={c.code} />

          <section aria-labelledby="imprimir" className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
            <h2 id="imprimir" className="font-bold">
              Para imprimir (A4)
            </h2>
            <p className="text-sm text-text-secondary">Abre em tamanho de folha. Use “Imprimir” ou “Salvar como PDF”.</p>
            <Link
              href={`${base}/a4`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground"
            >
              <Printer aria-hidden="true" className="size-5" strokeWidth={2} />
              Abrir versão para imprimir
            </Link>
          </section>
        </div>

        <ul className="grid gap-6 lg:grid-cols-2">
          {DOWNLOADABLE_FORMATS.map((f) => {
            const meta = POSTER_FORMATS[f];
            const wide = meta.width > meta.height;
            return (
              <li key={f} className={`flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card ${wide ? "lg:col-span-2" : ""}`}>
                <div>
                  <h2 className="font-bold">{meta.label}</h2>
                  <p className="text-sm text-text-secondary">
                    {meta.hint} · {meta.width}×{meta.height}
                  </p>
                </div>
                <div className="flex flex-1 items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada sob demanda */}
                  <img
                    src={`${base}/${f}?v=${v}`}
                    alt={`Prévia do cartaz ${meta.label.toLowerCase()} de ${c.pet.name}`}
                    loading="lazy"
                    width={meta.width}
                    height={meta.height}
                    className={`w-full rounded-md border border-border ${f === "story" ? "mx-auto max-w-56" : ""}`}
                  />
                </div>
                <a
                  href={`${base}/${f}?baixar=1&v=${v}`}
                  download
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-border-strong bg-surface px-4 font-semibold hover:bg-surface-muted"
                >
                  <Download aria-hidden="true" className="size-4.5" strokeWidth={2.25} />
                  Baixar {meta.label.toLowerCase()}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
