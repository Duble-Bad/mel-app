import { Suspense } from "react";
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

      <section className="mt-12 rounded-lg bg-brand-secondary p-5 text-brand-on-secondary">
        <h2 className="text-lg font-bold">Começou por uma Mel. Agora é por todos eles.</h2>
        <p className="mt-2">
          Quando um animal desaparece, a informação se perde entre grupos, cartazes e redes sociais. A MEL
          reúne tudo em um só lugar e alcança quem está perto, rápido — para que nenhum animal precise ser
          procurado sozinho.
        </p>
      </section>

      <footer className="mt-auto pt-12 text-sm text-text-secondary">
        <Suspense fallback={<p>Verificando conexão…</p>}>
          <SystemStatus />
        </Suspense>
      </footer>
    </main>
  );
}
