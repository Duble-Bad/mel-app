import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { HelpActions } from "@/components/home/HelpActions";
import { HeroCinema } from "@/components/home/HeroCinema";
import { HeroLiveChips } from "@/components/home/HeroLiveChips";
import "../../../home.css";

export const metadata: Metadata = { title: "Topo no celular: duas ordens (interno)", robots: { index: false, follow: false } };

/** Altura útil da primeira tela de um celular de 390×844 (sem o cabeçalho de 64 px). */
const FOLD = 780;

/**
 * Página INTERNA (MEL_DEV_ROUTES=1, nunca em produção): compara, lado a lado, as duas ordens
 * possíveis do topo no celular. Usa os componentes reais (radar com o vídeo e os cartões de dados
 * reais, e os quatro botões de ajuda); o texto do topo é uma cópia com os tamanhos do celular,
 * porque dentro da moldura a largura da tela do computador não vale.
 */
export default function DevHeroPhonePage() {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  return (
    <main className="mel-container flex flex-1 flex-col gap-8 py-10">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-[13px] font-extrabold tracking-[.12em] text-primary uppercase">Interno · comparação</p>
        <h1 className="text-[clamp(28px,4vw,40px)] leading-[1.1] font-extrabold tracking-[-0.02em]">Topo no celular: onde ficam os botões de ajuda?</h1>
        <p className="text-lg text-text-secondary">
          As duas molduras têm 390 px de largura, como um celular. A linha tracejada marca o fim da primeira tela (o que aparece sem rolar). Hoje o site usa a Opção A.
        </p>
      </header>

      <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-12">
        <Option
          name="Opção A (atual)"
          order="Título → radar → botões de ajuda"
          tradeoff="O radar com o vídeo aparece logo, mas os botões de ajuda ficam fora da primeira tela: é preciso rolar para chegar em “Perdi meu pet”."
        >
          <Copy />
          <Radar />
          <Help />
        </Option>
        <Option
          name="Opção B"
          order="Título → botões de ajuda → radar"
          tradeoff="Quem perdeu um pet acha os botões sem rolar; o radar com o vídeo passa para baixo deles e só aparece inteiro ao rolar."
        >
          <Copy />
          <Help />
          <Radar />
        </Option>
      </div>
    </main>
  );
}

function Option({ name, order, tradeoff, children }: { name: string; order: string; tradeoff: string; children: ReactNode }) {
  return (
    <section aria-label={name} className="flex w-[390px] max-w-full flex-col gap-3">
      <div>
        <h2 className="text-2xl font-extrabold tracking-[-0.02em]">{name}</h2>
        <p className="font-bold text-primary">{order}</p>
        <p className="mt-1 text-sm text-text-secondary">{tradeoff}</p>
      </div>
      {/* Moldura do celular: mostra a página inteira do topo, sem rolagem própria. */}
      <div className="relative isolate overflow-hidden rounded-[36px] border-[6px] border-border-strong bg-background shadow-lg">
        <div className="flex h-16 items-center justify-between border-b border-border px-4 text-sm font-bold text-text-secondary" aria-hidden="true">
          <span>MEL</span>
          <span>cabeçalho</span>
        </div>
        <div className="flex flex-col gap-6 px-4 pt-7 pb-10">{children}</div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-2" style={{ top: 64 + FOLD }}>
          <span className="h-0 flex-1 border-t-2 border-dashed border-status-lost" />
          <span className="rounded-full bg-status-lost-solid px-2.5 py-0.5 text-[11px] font-extrabold text-white">fim da primeira tela</span>
          <span className="h-0 w-3 border-t-2 border-dashed border-status-lost" />
        </div>
      </div>
    </section>
  );
}

/** O texto do topo, com as medidas que ele tem num celular de 390 px. */
function Copy() {
  return (
    <div className="flex flex-col items-start gap-4">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary-soft/60 px-3.5 py-1.5 text-sm font-semibold text-text-primary">Rede de Encontro e Adoção de Pets</span>
      <p role="heading" aria-level={3} className="text-[37px] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance">
        Uma rede inteira procurando <span className="whitespace-nowrap text-primary">com você.</span>
      </p>
      <p className="max-w-[36ch] text-base text-text-secondary">
        Encontre, divulgue e receba ajuda da comunidade para reencontrar seu pet, informar avistamentos e apoiar adoções responsáveis.
      </p>
      <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-primary">
        <UserPlus aria-hidden="true" className="size-5" strokeWidth={2.25} />
        Criar conta gratuitamente
      </span>
    </div>
  );
}

function Radar() {
  return (
    <div className="mh-radar-phone">
      <HeroCinema variant="radar">
        <Suspense fallback={null}>
          <HeroLiveChips />
        </Suspense>
      </HeroCinema>
    </div>
  );
}

function Help() {
  return (
    <div>
      <p className="mb-3 text-sm font-bold tracking-[.06em] text-text-secondary uppercase">Como podemos ajudar?</p>
      <HelpActions phone />
    </div>
  );
}
