import { Bell } from "lucide-react";
import "./guardian-hero.css";

/** Pinos que aparecem dentro do raio, um de cada vez (perdido, encontrado, avistamento). */
const PINS = [
  { x: 392, y: 132, tone: "var(--mel-status-lost-accent)", delay: "0.6s" },
  { x: 176, y: 236, tone: "var(--mel-status-found-accent)", delay: "1.6s" },
  { x: 338, y: 262, tone: "var(--mel-status-sighting-accent)", delay: "2.6s" },
];

/**
 * Ilustração animada do topo do Guardião MEL: um mapa estilizado do bairro, o escudo do Guardião
 * no centro com ondas de radar, o raio escolhido tracejado, pinos aparecendo dentro do raio e o
 * aviso que o Guardião recebe ("Pet perdido a 350 m"). Decorativa (texto genérico, sem
 * dado real; a legenda mostra o raio escolhido no formulário). Só transform e opacity animam; com "reduzir movimento" fica parada, tudo visível.
 */
export function GuardianHero({ radiusLabel }: { radiusLabel: string }) {
  return (
    <div className="gh relative aspect-[16/10] w-full overflow-hidden rounded-xl" aria-hidden="true">
      <svg viewBox="0 0 560 350" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {/* Quarteirões e ruas */}
        <g className="gh-blocks">
          {[
            [-10, -10, 150, 110],
            [170, -10, 120, 90],
            [320, -10, 140, 70],
            [490, -10, 90, 150],
            [-10, 130, 110, 120],
            [420, 100, 160, 110],
            [-10, 280, 200, 90],
            [214, 300, 150, 70],
            [400, 240, 180, 130],
          ].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx="14" />
          ))}
        </g>
        <circle className="gh-park" cx="128" cy="196" r="34" />
        <path className="gh-street" d="M-20 118 C120 112 220 130 300 104 S470 80 600 96" />
        <path className="gh-street" d="M300 -20 C292 80 300 180 286 380" />
        <path className="gh-street gh-street--thin" d="M-20 266 C120 258 260 282 600 230" />
        <path className="gh-street gh-street--thin" d="M150 -20 C160 120 140 220 200 380" />

        {/* Raio escolhido */}
        <circle className="gh-radius" cx="280" cy="190" r="128" />

        {/* Ondas de radar saindo do escudo */}
        {[0, 1, 2].map((i) => (
          <circle key={i} className="gh-ring" cx="280" cy="190" r="42" style={{ animationDelay: `${i * 1.1}s` }} />
        ))}

        {/* Pinos dentro do raio */}
        {PINS.map((p) => (
          <g key={p.tone} transform={`translate(${p.x} ${p.y})`}>
            <g className="gh-pin" style={{ animationDelay: p.delay }}>
              <ellipse cx="0" cy="2" rx="9" ry="3.5" className="gh-pin-shadow" />
              <path d="M0 0 C-14 -16 -18 -24 -18 -32 A18 18 0 1 1 18 -32 C18 -24 14 -16 0 0 Z" style={{ fill: p.tone }} />
              <circle cx="0" cy="-32" r="7" fill="white" />
            </g>
          </g>
        ))}

        {/* Escudo do Guardião no centro */}
        <circle className="gh-core-glow" cx="280" cy="190" r="46" />
        <circle className="gh-core" cx="280" cy="190" r="32" />
        {/* Escudo com check (mesmo desenho do ícone ShieldCheck), centralizado no círculo */}
        <g transform="translate(280 190) scale(1.55) translate(-12 -12)" className="gh-shield">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="m9 12 2 2 4-4" />
        </g>
      </svg>

      {/* Aviso que o Guardião recebe */}
      <div className="gh-toast absolute top-3 left-3 flex max-w-[72%] items-center gap-2.5 rounded-xl border border-border bg-surface-elevated/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:top-4 sm:left-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-lost-soft text-status-lost">
          <Bell className="size-4" strokeWidth={2.25} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold text-text-primary">Pet perdido a 350 m</span>
          <span className="truncate text-xs text-text-secondary">Perto de você · agora</span>
        </span>
      </div>

      {/* Legenda do raio */}
      <span className="absolute bottom-3 left-3 rounded-full border border-border bg-surface/90 px-2.5 py-1 text-xs font-semibold text-text-secondary backdrop-blur-sm sm:bottom-4 sm:left-4">
        Seu raio · {radiusLabel}
      </span>
    </div>
  );
}
