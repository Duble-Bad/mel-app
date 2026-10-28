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
      </section>

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
