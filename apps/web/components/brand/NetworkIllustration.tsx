import type { CSSProperties } from "react";
import { MelMark } from "./MelLogo";

const CX = 120;
const CY = 90;
const RADAR_MAX = 92; // raio final do pulso (viewBox 240×180)
const PERIOD_S = 3.4;

// Pessoas da rede ao redor da Mel: Honey, Ink/Ivory (texto do tema) e um Teal discreto.
const NODES = [
  { x: 40, y: 56, r: 6.5, fill: "var(--mel-brand)" },
  { x: 198, y: 44, r: 5.5, fill: "var(--mel-text-primary)" },
  { x: 210, y: 126, r: 7, fill: "var(--mel-honey-300)" },
  { x: 32, y: 134, r: 5, fill: "var(--mel-text-primary)" },
  { x: 126, y: 16, r: 4, fill: "var(--mel-teal-500)" },
  { x: 152, y: 166, r: 4.5, fill: "var(--mel-brand)" },
] as const;

/**
 * "Uma rede inteira procurando com você": o Mel Beacon no centro e as pessoas
 * conectadas. A cada ~3,4 s um pulso suave sai da MEL e, quando passa por um
 * nó, ele responde de leve (um alerta alcançando a comunidade). Decorativa;
 * com prefers-reduced-motion não há movimento.
 */
export function NetworkIllustration({ className }: { className?: string }) {
  const period = { "--mel-radar-period": `${PERIOD_S}s` } as CSSProperties;
  return (
    <div aria-hidden="true" className={`relative mx-auto aspect-[4/3] w-[184px] sm:w-[240px] ${className ?? ""}`}>
      <svg viewBox="0 0 240 180" className="absolute inset-0 size-full overflow-visible">
        <circle cx={CX} cy={CY} r="84" fill="var(--mel-brand-soft)" />
        <circle cx={CX} cy={CY} r="60" fill="none" stroke="var(--mel-brand-ring)" strokeWidth="1" opacity=".8" />
        <circle cx={CX} cy={CY} r={RADAR_MAX} fill="none" stroke="var(--mel-brand)" strokeWidth="1.5" className="mel-radar" style={period} />
        {NODES.map((n) => (
          <line key={`l${n.x}`} x1={CX} y1={CY} x2={n.x} y2={n.y} stroke="var(--mel-brand-ring)" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        {NODES.map((n) => {
          // O nó reage quando o pulso, crescendo do centro, chega até ele.
          const delay = (Math.hypot(n.x - CX, n.y - CY) / RADAR_MAX) * PERIOD_S * 0.55;
          return (
            <g key={`n${n.x}`} className="mel-node" style={{ ...period, animationDelay: `${delay.toFixed(2)}s` }}>
              <circle cx={n.x} cy={n.y} r={n.r + 3.5} fill="var(--mel-surface-warm)" />
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.fill} />
            </g>
          );
        })}
      </svg>
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[23%] shadow-primary">
        <MelMark size={64} className="block size-13 sm:size-16" />
      </span>
    </div>
  );
}
