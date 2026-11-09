import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { alertPath } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { PosterStudio } from "@/components/lost/PosterStudio";
import { LoadingState } from "@/components/ui/States";
import { siteOrigin } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

// "Criar cartaz" (DEMONSTRAÇÃO em DEV, aguarda liberação do proprietário): formato → três
// modelos → personalizar → usar. Só com MEL_DEV_ROUTES=1 (conferido na requisição) e sem
// indexação. Usa apenas os dados públicos do alerta; nada é gravado.
export const metadata: Metadata = { title: "Criar cartaz", robots: { index: false, follow: false } };

export default function CreatePosterPage({ params }: PageProps<"/alerta/[code]/cartaz/criar">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Preparando os cartazes…" />}>{params.then(({ code }) => <Studio code={code} />)}</Suspense>
    </main>
  );
}

async function Studio({ code }: { code: string }) {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const c = await getPublicLostCase(createPublicClient(), code);
  if (!c || c.status === "CLOSED") notFound();
  const alertUrl = `${await siteOrigin()}${alertPath(c.code)}`;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="self-start rounded-md bg-[#f6b928] px-2 py-0.5 text-sm font-bold text-[#0a111d]">DEMONSTRAÇÃO — AMBIENTE DE TESTE</p>
        <Link href={alertPath(c.code)} className="text-sm font-semibold text-link underline-offset-4 hover:underline">
          ‹ Voltar ao alerta
        </Link>
        <h1 className="text-2xl font-bold">Criar cartaz de {c.pet.name}</h1>
        <p className="text-text-secondary">Escolha o formato e o modelo. O cartaz já sai com as fotos e as informações públicas do alerta.</p>
      </div>
      <PosterStudio code={c.code} alertUrl={alertUrl} photos={c.pet.photos.map((p) => ({ url: p.url }))} />
      <p className="text-xs text-text-secondary">
        Demonstração: sua escolha fica no endereço desta página (recarregar mantém, outro aparelho não). Salvar a personalização na sua conta depende de uma mudança no
        banco ainda não aprovada.
      </p>
    </div>
  );
}
