import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicLostCase } from "@mel/data";
import { PosterEditorPrototype } from "@/components/lost/PosterEditorPrototype";
import { LoadingState } from "@/components/ui/States";
import { createPublicClient } from "@/lib/supabase/public";

// PROTÓTIPO INTERNO do editor de cartazes (avaliação do proprietário). Só existe com
// MEL_DEV_ROUTES=1 (conferido na requisição), não tem link no app e não é indexado.
// Lê só dados públicos do alerta e não grava nada no servidor.
export const metadata: Metadata = { title: "Editor de cartazes (protótipo)", robots: { index: false, follow: false } };

export default function PosterEditorPrototypePage({ params }: PageProps<"/alerta/[code]/cartaz/editor">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Preparando o editor…" />}>{params.then(({ code }) => <Editor code={code} />)}</Suspense>
    </main>
  );
}

async function Editor({ code }: { code: string }) {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const c = await getPublicLostCase(createPublicClient(), code);
  if (!c || c.status === "CLOSED") notFound();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="self-start rounded-md bg-[#f6b928] px-2 py-0.5 text-sm font-bold text-[#0a111d]">PROTÓTIPO — AMBIENTE DE TESTE · avaliação interna, não divulgar</p>
        <h1 className="text-2xl font-bold">Personalizar cartazes: {c.pet.name}</h1>
        <p className="text-text-secondary">
          Escolha as fotos e o enquadramento de cada formato. A foto original, a capa, a ordem das fotos e a descrição não mudam. Nada é gravado no servidor neste
          protótipo.
        </p>
        <Link href={`/alerta/${c.code}/cartaz/propostas`} className="text-sm font-semibold text-link underline-offset-4 hover:underline">
          Ver a comparação dos formatos
        </Link>
      </div>
      <PosterEditorPrototype code={c.code} photos={c.pet.photos.map((p) => ({ url: p.url }))} />
    </div>
  );
}
