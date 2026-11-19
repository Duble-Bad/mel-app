import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HeroLiveChips } from "@/components/home/HeroLiveChips";
import { ConceptMotion } from "@/components/dev/conceito-motion/ConceptMotion";

export const metadata: Metadata = { title: "Conceito de movimento (interno)", robots: { index: false } };

/**
 * Página INTERNA de conceito: a experiência da MEL reimaginada com animação e interação de alto
 * nível, para comparar com o site atual. Dados fictícios, menos os cartões do radar do topo (reais). Só existe com MEL_DEV_ROUTES=1 — nunca
 * em produção.
 */
export default function DevMotionConceptPage() {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  return (
    <main className="flex flex-1 flex-col">
      <ConceptMotion
        heroChips={
          <Suspense fallback={null}>
            <HeroLiveChips />
          </Suspense>
        }
      />
    </main>
  );
}
