import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPetByMelId } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { LoadingState } from "@/components/ui/States";
import { V2_FORMATS, type PosterV2Format } from "@/lib/poster/PosterV2";

// PRÉVIA INTERNA (MEL_DEV_ROUTES=1, nunca em produção) das propostas de cartaz com um
// pet REAL, sem alerta publicado. Variações de fotos lado a lado para avaliar o
// reconhecimento do animal. Não grava nada.
export const metadata: Metadata = { title: "Prévia interna de cartazes", robots: { index: false, follow: false } };

const ORDER: PosterV2Format[] = ["impressao", "square", "portrait", "story", "landscape"];

export default function PetPosterPreviewPage({ params, searchParams }: PageProps<"/dev/cartaz-pet/[mel]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Preparando as prévias…" />}>
        {Promise.all([params, searchParams]).then(([{ mel }, q]) => (
          <Preview mel={mel} fotos={typeof q.fotos === "string" ? q.fotos : null} />
        ))}
      </Suspense>
    </main>
  );
}

async function Preview({ mel, fotos }: { mel: string; fotos: string | null }) {
  // Conferido na requisição (como a rota das imagens), não no build: fora de DEV, não existe.
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  if (!/^MEL-[A-Z0-9]{6}$/.test(mel)) notFound();
  const pet = await getPetByMelId(createPublicClient(), mel);
  if (!pet) notFound();
  const n = pet.photos.length;
  // Combinações sugeridas: capa atual, principal horizontal, uma foto, duas fotos.
  const variants: [string, string][] = [
    ["Ordem do cadastro (capa atual primeiro)", "0,1,2"],
    ...(n > 2 ? ([["Principal horizontal (foto 3) + 2 complementares", "2,1,3"]] as [string, string][]) : []),
    ...(n > 1 ? ([["Uma foto só (foto 2)", "1"]] as [string, string][]) : []),
    ...(n > 3 ? ([["Duas fotos (3 e 4)", "2,3"]] as [string, string][]) : []),
  ];
  const active = fotos ?? "0,1,2";
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="inline-block rounded-md bg-[#f6b928] px-2 py-0.5 text-sm font-bold text-[#0a111d]">AMBIENTE DE TESTE — DEV · avaliação interna, não divulgar</p>
        <h1 className="mt-2 text-2xl font-bold">Propostas de cartaz: {pet.name}</h1>
        <p className="mt-1 text-text-secondary">
          Dados e fotos reais do cadastro {pet.melId}. Sem alerta publicado: o QR Code e o link ficam reservados, e região e data aparecem como ausentes.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Combinações de fotos">
          {variants.map(([label, v]) => (
            <a key={v} href={`?fotos=${v}`} aria-current={v === active ? "true" : undefined} className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${v === active ? "border-[#f6b928]" : "border-border"}`}>
              {label}
            </a>
          ))}
        </nav>
      </div>
      <ul className="grid gap-6 md:grid-cols-2">
        {ORDER.map((f) => {
          const meta = V2_FORMATS[f];
          return (
            <li key={f} className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
              <h2 className="font-bold">
                {meta.label} <span className="font-normal text-text-secondary">· {meta.width}×{meta.height}</span>
              </h2>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada sob demanda */}
              <img src={`/dev/cartaz-pet/${pet.melId}/${f}?fotos=${active}`} alt={`Prévia ${meta.label} de ${pet.name}`} width={meta.width} height={meta.height} className="w-full rounded-md border border-border" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
