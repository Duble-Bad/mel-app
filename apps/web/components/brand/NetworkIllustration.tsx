import { MelMark } from "./MelLogo";

// Pontos da rede (pessoas ajudando) ao redor do pino central, em coordenadas do SVG 240×180.
const NODES = [
  { x: 42, y: 58, r: 7, color: "var(--mel-brand)" },
  { x: 196, y: 44, r: 6, color: "var(--mel-text-primary)" },
  { x: 208, y: 130, r: 8, color: "var(--mel-coral-400)" },
  { x: 34, y: 136, r: 5.5, color: "var(--mel-honey-300)" },
  { x: 128, y: 20, r: 4.5, color: "var(--mel-teal-500)" },
] as const;

/**
 * Composição abstrata "uma rede inteira procurando com você": anéis de
 * alcance (localização) e pessoas conectadas ao pino da MEL. Decorativa.
 */
export function NetworkIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative mx-auto aspect-[4/3] w-[184px] sm:w-[240px] ${className ?? ""}`}>
      <svg viewBox="0 0 240 180" className="absolute inset-0 size-full">
        <circle cx="120" cy="90" r="84" fill="var(--mel-brand-soft)" />
        <circle cx="120" cy="90" r="60" fill="none" stroke="var(--mel-brand-ring)" strokeWidth="1.5" />
        <circle cx="120" cy="90" r="36" fill="var(--mel-primary-soft)" opacity=".8" />
        {NODES.map((n) => (
          <line
            key={`l${n.x}`}
            x1="120"
            y1="90"
            x2={n.x}
            y2={n.y}
            stroke="var(--mel-brand-ring)"
            strokeWidth="1.25"
            strokeDasharray="3 4"
          />
        ))}
        {NODES.map((n) => (
          <g key={`n${n.x}`}>
            <circle cx={n.x} cy={n.y} r={n.r + 4} fill="var(--mel-surface-warm)" />
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} />
          </g>
        ))}
      </svg>
      {/* Pulso de alcance (respeita prefers-reduced-motion via CSS global). */}
      <span className="absolute top-1/2 left-1/2 size-13 -translate-x-1/2 -translate-y-1/2 animate-ping sm:size-16 rounded-full bg-brand/20 [animation-duration:2.4s]" />
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[13px] shadow-primary sm:rounded-[16px]">
        <MelMark size={56} className="block size-11 sm:size-14" />
      </span>
    </div>
  );
}
