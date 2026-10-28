import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DOWNLOADABLE_FORMATS, POSTER_FORMATS } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Cartaz", robots: { index: false } };

export default function PosterPage({ params }: PageProps<"/alerta/[code]/cartaz">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-10">
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
  if (!c) notFound();
  const base = `/alerta/${c.code}/cartaz`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/alerta/${c.code}`} className="text-sm font-semibold text-brand-primary underline-offset-4 hover:underline">
          ‹ Voltar ao alerta
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Cartaz de {c.pet.name}</h1>
        <p className="mt-1 text-text-secondary">
          Baixe e poste nas redes, mande nos grupos ou imprima. O QR Code abre o alerta com as fotos e a linha do tempo.
        </p>
      </div>

      <section aria-labelledby="imprimir" className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
        <h2 id="imprimir" className="font-bold">
          Para imprimir (A4)
        </h2>
        <p className="text-sm text-text-secondary">Abre o cartaz em tamanho de folha. Use “Imprimir” ou “Salvar como PDF”.</p>
        <Link
          href={`${base}/a4`}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-brand-primary px-4 font-semibold text-brand-on-primary"
        >
          🖨️ Abrir versão para imprimir
        </Link>
      </section>

      <ul className="flex flex-col gap-6">
        {DOWNLOADABLE_FORMATS.map((f) => {
          const meta = POSTER_FORMATS[f];
          return (
            <li key={f} className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
              <div>
                <h2 className="font-bold">{meta.label}</h2>
                <p className="text-sm text-text-secondary">
                  {meta.hint} · {meta.width}×{meta.height}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada sob demanda */}
              <img
                src={`${base}/${f}`}
                alt={`Prévia do cartaz ${meta.label.toLowerCase()} de ${c.pet.name}`}
                loading="lazy"
                width={meta.width}
                height={meta.height}
                className={`w-full rounded-md border border-border ${f === "story" ? "mx-auto max-w-56" : ""}`}
              />
              <a
                href={`${base}/${f}?baixar=1`}
                download
                className="inline-flex min-h-12 items-center justify-center rounded-md border-2 border-border-strong bg-surface px-4 font-semibold hover:bg-surface-muted"
              >
                ⬇ Baixar {meta.label.toLowerCase()}
              </a>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-text-secondary">
        Telefone só aparece no cartaz se você autorizou no alerta. Para Stories do Instagram: baixe o formato
        “Stories” e publique pelo app do Instagram.
      </p>
    </div>
  );
}
