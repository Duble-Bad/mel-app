import { ArrowLeft, Map } from "lucide-react";
import Link from "next/link";
import { Big404 } from "./Big404";
import { YorkieVideo } from "./YorkieVideo";
import "./not-found.css";

/**
 * Página "não encontrado" (com ou sem cabeçalho, conforme quem usa). Tela cheia abaixo do
 * cabeçalho: "404" gigante ao fundo, esmaecendo para baixo; no miolo do "0", uma yorkshire de
 * verdade (vídeo com o fundo de estúdio original) numa moldura em arco, inclinando a cabeça,
 * curiosa; embaixo, a mensagem e o caminho de volta.
 * Inspirada num modelo de 404 com raposa em vídeo, nas cores da MEL.
 */
export function NotFoundContent() {
  return (
    <main className="nf-page relative flex min-h-[calc(100dvh-65px)] w-full flex-1 flex-col overflow-hidden">
      {/* Yorkshire no fluxo da página: ocupa o espaço que sobra acima do texto, sem nunca cobri-lo. */}
      <div aria-hidden="true" className="pointer-events-none relative z-10 flex min-h-[150px] flex-1 items-center justify-center overflow-hidden px-4 pt-4 pb-3">
        <Big404 />
        <div className="nf-dog aspect-[3/4] h-[clamp(170px,44dvh,440px)] max-w-full">
          <div className="nf-arch">
            <YorkieVideo />
          </div>
          <DogExtras />
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

// Fora da moldura: no chão, dos dois lados (coordenadas do quadro 300×400 da moldura).
const PAWS: [number, number, number][] = [
  [-62, 396, -18],
  [-26, 380, -10],
  [326, 396, 14],
  [362, 378, 22],
];

/** "?" no ar ao lado da moldura e patinhas no chão, fora dela (cor da marca). */
function DogExtras() {
  return (
    <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
      {PAWS.map(([x, y, r], i) => (
        <g key={i} className="nf-paw" style={{ animationDelay: `${i * 0.45}s` }} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse cx="0" cy="4" rx="8" ry="7" fill="var(--mel-primary)" />
          <circle cx="-8" cy="-6" r="3.2" fill="var(--mel-primary)" />
          <circle cx="-2.8" cy="-10" r="3.2" fill="var(--mel-primary)" />
          <circle cx="2.8" cy="-10" r="3.2" fill="var(--mel-primary)" />
          <circle cx="8" cy="-6" r="3.2" fill="var(--mel-primary)" />
        </g>
      ))}
      <g className="nf-q">
        <text x="304" y="66" fontSize="64" fontWeight="900" fill="var(--mel-primary)" stroke="var(--mel-primary-hover)" strokeWidth="1.5" fontFamily="inherit">
          ?
        </text>
      </g>
    </svg>
  );
}
