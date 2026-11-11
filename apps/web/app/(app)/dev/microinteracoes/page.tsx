import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MicroInteractionsLab } from "@/components/dev/microinteracoes/MicroInteractionsLab";
import { LoadingState } from "@/components/ui/States";

// PROTÓTIPO INTERNO das microinterações (MEL_DEV_ROUTES=1, nunca em produção): duas propostas
// de movimento para "Criar cartaz" e "Perdi meu pet", com dados fictícios. Nada é gravado e
// os fluxos reais não mudam.
export const metadata: Metadata = { title: "Microinterações (protótipo)", robots: { index: false, follow: false } };

export default function MicroInteractionsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Preparando o protótipo…" />}>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  // Conferido na requisição, não no build.
  await connection();
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="self-start rounded-md bg-[#f6b928] px-2 py-0.5 text-sm font-bold text-[#0a111d]">PROTÓTIPO — AMBIENTE DE TESTE · dados fictícios</p>
        <h1 className="text-2xl font-bold">Microinterações: Criar cartaz e Perdi meu pet</h1>
        <p className="text-text-secondary">
          Duas propostas de movimento sobre as mesmas etapas reais. Nada é salvo, nenhum alerta é criado e os fluxos reais continuam como estão.
        </p>
      </div>
      <MicroInteractionsLab />
    </div>
  );
}
