import Link from "next/link";
import { ArrowRight, Map as MapIcon, ShieldCheck, Store } from "lucide-react";
import { Suspense } from "react";
import { BrandStory } from "@/components/brand/BrandStory";
import { HelpActions } from "@/components/home/HelpActions";
import { SystemStatus } from "@/components/home/SystemStatus";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-8 pb-10">
      <h1 className="mb-10 text-3xl leading-tight font-bold text-balance">Uma rede inteira procurando com você.</h1>

      <section aria-labelledby="como-ajudar">
        <h2 id="como-ajudar" className="mb-4 text-xl font-semibold">
          Como podemos ajudar?
        </h2>
        <HelpActions />
        <Link
          href="/mapa"
          className="mt-4 flex min-h-14 items-center justify-between gap-3 rounded-card border border-border/70 bg-surface px-4 shadow-xs transition-colors hover:bg-surface-muted"
        >
          <span className="flex items-center gap-3 font-semibold">
            <MapIcon aria-hidden="true" className="size-5 text-brand" strokeWidth={2} />
            Ver o mapa da rede MEL
          </span>
          <ArrowRight aria-hidden="true" className="size-4 text-text-secondary" strokeWidth={2} />
        </Link>
        <Link
          href="/parceiros"
          className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-card border border-border/70 bg-surface px-4 shadow-xs transition-colors hover:bg-surface-muted"
        >
          <span className="flex items-center gap-3 font-semibold">
            <Store aria-hidden="true" className="size-5 text-brand" strokeWidth={2} />
            Clínicas e parceiros da rede
          </span>
          <ArrowRight aria-hidden="true" className="size-4 text-text-secondary" strokeWidth={2} />
        </Link>
      </section>

      <Link
        href="/guardiao"
        className="mt-10 flex items-start gap-4 rounded-card border border-border/70 bg-surface-warm p-5 shadow-sm transition-colors hover:bg-surface-muted"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={1.75} />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-lg font-bold">Seja um Guardião MEL</span>
          <span className="text-text-secondary">Receba um aviso quando um pet se perder perto de você. Leva 1 minuto.</span>
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-link">
            Ativar alertas próximos <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
          </span>
        </span>
      </Link>

      <div className="mt-12">
        <BrandStory />
      </div>

      <footer className="mt-auto pt-12 text-sm text-text-secondary">
        <Suspense fallback={<p>Verificando conexão…</p>}>
          <SystemStatus />
        </Suspense>
      </footer>
    </main>
  );
}
