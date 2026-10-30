import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { alertPath, posterContent } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { qrDataUrl } from "@/lib/poster/assets";
import { siteOrigin } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";
import { PrintButton } from "@/components/lost/PrintButton";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Cartaz para imprimir", robots: { index: false } };

/** Cartaz A4 em HTML: imprime nítido (texto vetorial) e economiza tinta. */
export default function PrintPosterPage({ params }: PageProps<"/alerta/[code]/cartaz/a4">) {
  return (
    <Suspense fallback={<LoadingState />}>
      {params.then(({ code }) => (
        <PrintPoster code={code} />
      ))}
    </Suspense>
  );
}

async function PrintPoster({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const c = await getPublicLostCase(createPublicClient(), code);
  if (!c || c.status === "CLOSED") notFound();
  const p = posterContent(c);
  const url = `${await siteOrigin()}${alertPath(c.code)}`;
  const qr = await qrDataUrl(url, 600);
  const photo = c.pet.photos[0]?.url;
  const accent = p.found ? "border-status-found text-status-found" : "border-status-lost text-status-lost";

  return (
    <main className="mx-auto w-full max-w-[210mm] flex-1 bg-surface print:max-w-none">
      <style>{`@page { size: A4; margin: 10mm; } @media print { header, .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="no-print flex flex-col gap-2 p-4">
        <PrintButton />
        <p className="text-sm text-text-secondary">Dica: na janela de impressão, escolha “Salvar como PDF” para enviar por mensagem.</p>
      </div>
      <article className={`flex flex-col gap-4 border-[6mm] p-[8mm] ${accent}`}>
        <h1 className={`text-center text-[22mm] leading-none font-extrabold tracking-wide ${accent}`}>{p.headline}</h1>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto original para impressão
          <img src={photo} alt={`Foto de ${p.name}`} className="h-[95mm] w-full object-cover" />
        ) : (
          <div className="flex h-[60mm] items-center justify-center bg-surface-muted text-[30mm]" aria-hidden="true">
            🐾
          </div>
        )}
        <p className="text-center text-[16mm] leading-none font-extrabold text-text-primary">{p.name}</p>
        <p className="text-center text-[6mm] font-bold text-text-secondary">{p.details}</p>
        {p.lastSeen && <p className="text-center text-[6mm] text-text-primary">{p.lastSeen}</p>}
        {p.when && <p className="text-center text-[5mm] text-text-secondary">{p.when}</p>}
        {p.marks && <p className="text-center text-[5mm] text-text-primary">{p.marks}</p>}
        <div className="mt-2 flex items-center gap-[6mm]">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor */}
          <img src={qr} alt="QR Code do alerta" className="size-[45mm] shrink-0" />
          <div className="flex flex-col gap-[2mm]">
            <p className={`text-[7mm] font-extrabold ${accent}`}>{p.cta}</p>
            {p.contact && <p className="text-[6mm] font-bold text-text-primary">{p.contact}</p>}
            <p className="text-[4mm] break-all text-text-secondary">{url.replace(/^https?:\/\//, "")}</p>
            <p className="text-[5mm] font-extrabold text-link">MEL · Uma rede inteira procurando com você.</p>
          </div>
        </div>
      </article>
    </main>
  );
}
