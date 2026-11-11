import { ArrowLeft, Map } from "lucide-react";
import Link from "next/link";
import { Big404 } from "./Big404";
import { LostYorkie } from "./LostYorkie";
import "./not-found.css";

/**
 * Página "não encontrado" (com ou sem cabeçalho, conforme quem usa). Tela cheia abaixo do
 * cabeçalho: "404" gigante ao fundo, esmaecendo para baixo; no centro, uma yorkshire (como a Mel)
 * farejando, curiosa, com um "?" no ar; embaixo, a mensagem e o caminho de volta. Inspirada num
 * modelo de 404 com raposa em vídeo, refeita com desenho próprio e as cores da MEL.
 */
export function NotFoundContent() {
  return (
    <main className="nf-page relative flex min-h-[calc(100dvh-65px)] w-full flex-1 flex-col overflow-hidden">
      <Big404 />

      {/* Yorkshire no fluxo da página: ocupa o espaço que sobra acima do texto, sem nunca cobri-lo. */}
      <div aria-hidden="true" className="pointer-events-none relative z-10 flex min-h-[150px] flex-1 items-center justify-center px-4 pt-4">
        <div className="aspect-[400/420] h-[clamp(150px,44dvh,440px)] max-w-full">
          <LostYorkie />
        </div>
      </div>

      <div className="relative z-30 flex flex-col items-center px-4 pt-2 pb-10 text-center sm:pb-16">
        <p className="text-[13px] font-extrabold tracking-[.12em] text-primary uppercase">Erro 404</p>
        <h1 className="mt-1.5 text-[clamp(22px,3.4vw,32px)] leading-tight font-extrabold tracking-[-0.02em] text-balance">Ops, esta página se perdeu!</h1>
        <p className="mt-2 max-w-[46ch] text-text-secondary sm:text-lg">
          Farejamos por toda parte e ela se perdeu. O link pode estar incompleto, ou o conteúdo foi removido ou deixou de ser público.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-primary transition-[transform,box-shadow,background-color] duration-200 ease-mel hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-primary-hover active:scale-[.98] sm:min-h-14 sm:px-8 sm:text-lg"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
            Voltar para o início
          </Link>
          <Link
            href="/mapa"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong bg-surface/70 px-6 font-semibold backdrop-blur-sm transition-colors duration-200 ease-mel hover:border-primary sm:min-h-14"
          >
            <Map aria-hidden="true" className="size-5" strokeWidth={2} />
            Abrir o mapa da rede
          </Link>
        </div>
      </div>
    </main>
  );
}
