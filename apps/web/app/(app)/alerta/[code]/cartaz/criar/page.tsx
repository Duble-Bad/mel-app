import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { alertPath } from "@mel/core";
import { getPosterDesigns, getPublicLostCase } from "@mel/data";
import { PosterStudio } from "@/components/lost/PosterStudio";
import { LoadingState } from "@/components/ui/States";
import { siteOrigin } from "@/lib/site";
import { createSessionClient } from "@/lib/supabase/server";

// "Criar cartaz" (liberado pelo proprietário em 2026-11-10): formato → quatro modelos →
// personalizar → usar. Usa só os dados públicos do alerta; qualquer pessoa pode gerar e baixar,
// só o tutor salva na conta (o banco confere). Sem indexação.
export const metadata: Metadata = { title: "Criar cartaz", robots: { index: false, follow: false } };

export default function CreatePosterPage({ params }: PageProps<"/alerta/[code]/cartaz/criar">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Preparando os cartazes…" />}>{params.then(({ code }) => <Studio code={code} />)}</Suspense>
    </main>
  );
}

async function Studio({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  // Cliente com a sessão: diz se quem abre é o tutor (para mostrar "Salvar na minha conta").
  const supabase = await createSessionClient();
  const c = await getPublicLostCase(supabase, code);
  if (!c || c.status === "CLOSED") notFound();
  const isOwner = c.isOwner && c.status === "ACTIVE";
  const [origin, saved] = await Promise.all([siteOrigin(), isOwner ? getPosterDesigns(supabase, c.code).catch(() => []) : Promise.resolve([])]);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href={alertPath(c.code)} className="text-sm font-semibold text-link underline-offset-4 hover:underline">
          ‹ Voltar ao alerta
        </Link>
        <h1 className="text-2xl font-bold">Criar cartaz de {c.pet.name}</h1>
        <p className="hidden text-text-secondary sm:block">Escolha o formato e o modelo. O cartaz já sai com as fotos e as informações públicas do alerta.</p>
      </div>
      <PosterStudio
        code={c.code}
        alertUrl={`${origin}${alertPath(c.code)}`}
        photos={c.pet.photos.map((p) => ({ id: p.id, url: p.url }))}
        isOwner={isOwner}
        savedDesigns={saved}
      />
      <p className="text-xs text-text-secondary">
        {isOwner
          ? "Enquanto você edita, os ajustes ficam no endereço desta página. Use “Salvar na minha conta” para encontrar o cartaz pronto em qualquer aparelho."
          : "Qualquer pessoa pode criar e baixar os cartazes deste alerta. Só o tutor pode salvar um cartaz na conta."}
      </p>
    </div>
  );
}
