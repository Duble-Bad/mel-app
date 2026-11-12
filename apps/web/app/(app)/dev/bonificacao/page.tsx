import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RewardPrototype } from "@/components/lost/RewardPrototype";
import { LoadingState } from "@/components/ui/States";

// PROTÓTIPO INTERNO da bonificação (MEL_DEV_ROUTES=1, nunca em produção). Caso fictício:
// nenhum pet, foto ou alerta real é usado; nada é gravado.
export const metadata: Metadata = { title: "Bonificação (protótipo)", robots: { index: false, follow: false } };

export default function RewardPrototypePage() {
  return (
    <main className="mel-container flex-1 pt-6 pb-10">
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
        <p className="self-start rounded-md bg-[#f6b928] px-2 py-0.5 text-sm font-bold text-[#0a111d]">PROTÓTIPO — AMBIENTE DE TESTE · caso fictício</p>
        <h1 className="text-2xl font-bold">Bonificação para quem encontrar o pet</h1>
        <p className="text-text-secondary">Simulação do formulário, da página do alerta e dos cartazes. Exemplo ilustrativo; não se refere a nenhum pet real.</p>
      </div>
      <RewardPrototype />
    </div>
  );
}
