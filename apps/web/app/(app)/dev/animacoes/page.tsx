import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnimationsDemo } from "@/components/dev/animacoes/AnimationsDemo";

export const metadata: Metadata = { title: "Animações (interno)", robots: { index: false } };

/**
 * Página INTERNA para ver e repetir as microanimações (ui-motion-prompts) sem
 * precisar passar pelos fluxos. Só existe com MEL_DEV_ROUTES=1 — nunca em produção.
 */
export default function DevAnimationsPage() {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  return (
    <main className="mel-container flex-1 py-8">
      <AnimationsDemo />
    </main>
  );
}
