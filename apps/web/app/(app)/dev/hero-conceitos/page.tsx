import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConceptCinema, ConceptLight, ConceptNetwork } from "@/components/dev/hero-conceitos/HeroConcepts";
import { HelpActions } from "@/components/home/HelpActions";
import { HomeMotion } from "@/components/home/HomeMotion";
import { NetworkStats } from "@/components/home/NetworkStats";
import "../../../home.css";

// PROTÓTIPO INTERNO (MEL_DEV_ROUTES=1, nunca em produção): três conceitos para o topo do início, com o
// vídeo da Mel e o gatinho no lugar da foto e outra animação no lugar da fita amarela. A home real não muda.
export const metadata: Metadata = { title: "Topo do início: conceitos (protótipo)", robots: { index: false, follow: false } };

const CONCEPTS = {
  a: { name: "A · Rede viva", text: "Ondas de radar, pontos da rede e feixes de luz até o vídeo; avisos de exemplo aparecem no canto." },
  b: { name: "B · Moldura de luz", text: "Feixe dourado contornando a moldura, aura que respira, pegadas chegando e cartões de vidro com profundidade." },
  c: { name: "C · Cinemático", text: "O vídeo vira o palco do topo, até a borda da tela; pinos de avistamento pousam na cena." },
} as const;
type Key = keyof typeof CONCEPTS;

export default function HeroConceptsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <Gate searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Gate({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await connection();
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  const { c } = await searchParams;
  const key: Key = c === "b" || c === "c" ? c : "a";
  const below = (
    <section aria-labelledby="como-ajudar">
      <h2 id="como-ajudar" className="mb-3 text-sm font-bold tracking-[.06em] text-text-secondary uppercase lg:sr-only">
        Como podemos ajudar?
      </h2>
      <HelpActions />
      <Suspense fallback={null}>
        <NetworkStats />
      </Suspense>
    </section>
  );
  return (
    <>
      <HomeMotion />
      <div className="mel-container flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
        <p className="rounded-md bg-[#f6b928] px-2 py-0.5 text-sm font-bold text-[#0a111d]">PROTÓTIPO · topo do início</p>
        <nav aria-label="Conceitos" className="flex flex-wrap gap-2">
          {(Object.keys(CONCEPTS) as Key[]).map((k) => (
            <Link
              key={k}
              href={`?c=${k}`}
              aria-current={k === key ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${k === key ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-surface-muted"}`}
            >
              {CONCEPTS[k].name}
            </Link>
          ))}
        </nav>
        <p className="w-full text-sm text-text-secondary">{CONCEPTS[key].text}</p>
      </div>
      {key === "a" && <ConceptNetwork key="a" below={below} />}
      {key === "b" && <ConceptLight key="b" below={below} />}
      {key === "c" && <ConceptCinema key="c" below={below} />}
    </>
  );
}
