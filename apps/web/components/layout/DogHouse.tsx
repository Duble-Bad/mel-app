import type { ReactNode } from "react";

/**
 * Casinha de cachorro (desenho vetorial nas cores da MEL): telhado dourado arredondado, paredes
 * creme, patinha em relevo no alto e base dourada. A porta tem a proporção 3:4 do vídeo e mostra o
 * conteúdo (a yorkshire, com o fundo claro original do vídeo, sem recorte) com cantos arredondados
 * e um leve rebaixo, como uma abertura de verdade. Quadro 500×560.
 */
const W = 500;
const H = 560;
const DOOR = { x: 130, y: 196, w: 240, h: 320, r: 20 };
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function DogHouse({ children }: { children: ReactNode }) {
  return (
    <div className="nf-house relative size-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="nf-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in srgb, white 28%, var(--mel-primary))" }} />
            <stop offset="1" style={{ stopColor: "var(--mel-primary-hover)" }} />
          </linearGradient>
          <linearGradient id="nf-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in srgb, color-mix(in srgb, white 88%, var(--mel-primary)) 92%, var(--mel-text-secondary))" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in srgb, color-mix(in srgb, white 76%, var(--mel-primary)) 90%, var(--mel-text-secondary))" }} />
          </linearGradient>
        </defs>

        {/* Paredes (pentágono sob o telhado) */}
        <path d="M74 222 L250 82 L426 222 L426 528 Q426 540 414 540 L86 540 Q74 540 74 528 Z" fill="url(#nf-wall)" />
        {/* Base dourada */}
        <rect x="62" y="526" width="376" height="22" rx="11" fill="url(#nf-gold)" />
        {/* Patinha em relevo no alto da parede */}
        <g transform="translate(250 150)" style={{ fill: "color-mix(in srgb, var(--mel-primary) 34%, white)" }}>
          <ellipse cx="0" cy="8" rx="15" ry="12" />
          <circle cx="-15" cy="-8" r="6" />
          <circle cx="-5" cy="-15" r="6" />
          <circle cx="5" cy="-15" r="6" />
          <circle cx="15" cy="-8" r="6" />
        </g>
        {/* Moldura da porta (rebaixo) */}
        <rect
          x={DOOR.x - 10}
          y={DOOR.y - 10}
          width={DOOR.w + 20}
          height={DOOR.h + 10}
          rx={DOOR.r + 8}
          style={{ fill: "color-mix(in srgb, var(--mel-primary) 22%, white)" }}
        />
        {/* Telhado: faixa grossa e arredondada, por cima das paredes */}
        <path d="M40 232 L250 62 L460 232" fill="none" stroke="url(#nf-gold)" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M58 214 L250 58 L442 214" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Porta: o vídeo, com cantos arredondados e um leve rebaixo por dentro. */}
      <div
        className="nf-door absolute overflow-hidden"
        style={{ left: pct(DOOR.x, W), top: pct(DOOR.y, H), width: pct(DOOR.w, W), height: pct(DOOR.h, H), borderRadius: `${pct(DOOR.r, DOOR.w)} / ${pct(DOOR.r, DOOR.h)}` }}
      >
        {children}
      </div>
    </div>
  );
}
