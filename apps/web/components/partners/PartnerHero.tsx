import { BadgeCheck, HandHeart, House, MapPin, ScanLine, ShoppingBag, Stethoscope, type LucideIcon } from "lucide-react";
import "./partner-hero.css";

/** Pontos de apoio no mapa (posição em % do quadro), cada um aparece em sequência. */
const PARTNERS: { x: number; y: number; Icon: LucideIcon; label: string; tone: string; delay: string }[] = [
  { x: 27, y: 42, Icon: Stethoscope, label: "Clínica", tone: "var(--mel-status-sighting-accent)", delay: "0.2s" },
  { x: 74, y: 24, Icon: ShoppingBag, label: "Pet shop", tone: "var(--mel-primary)", delay: "0.5s" },
  { x: 78, y: 70, Icon: HandHeart, label: "ONG", tone: "var(--mel-status-adoption-accent)", delay: "0.8s" },
  { x: 27, y: 78, Icon: House, label: "Lar temporário", tone: "var(--mel-status-found-accent)", delay: "1.1s" },
];

/**
 * Ilustração do topo de "Seja um parceiro da MEL": o bairro com os pontos de apoio acendendo um a um,
 * um animal encontrado no centro ligado ao parceiro mais próximo e os cartões "leitor de microchip" e
 * "parceiro verificado". Decorativa (dados genéricos). Só transform e opacity animam; com "reduzir
 * movimento" fica tudo parado e visível.
 */
export function PartnerHero() {
  return (
    <div className="ph relative aspect-[5/4] w-full overflow-hidden rounded-[28px]" aria-hidden="true">
      <svg viewBox="0 0 500 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <g className="ph-blocks">
          {[
            [-10, -10, 150, 100],
            [170, -10, 150, 70],
            [350, -10, 160, 120],
            [-10, 130, 90, 130],
            [380, 150, 130, 110],
            [-10, 290, 170, 120],
            [190, 320, 150, 90],
            [370, 290, 140, 120],
          ].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx="16" />
          ))}
        </g>
        <path className="ph-street" d="M-20 112 C120 104 260 126 520 100" />
        <path className="ph-street" d="M-20 282 C140 270 300 300 520 268" />
        <path className="ph-street" d="M160 -20 C150 120 176 260 166 420" />
        <path className="ph-street" d="M352 -20 C360 140 340 260 356 420" />

        {/* Ligação do animal encontrado (centro) ao parceiro mais próximo e aos demais */}
        <path className="ph-link ph-link--main" d="M250 200 C215 188 175 172 135 168" />
        <path className="ph-link" d="M250 200 C300 160 340 120 370 96" />
        <path className="ph-link" d="M250 200 C300 230 350 260 390 280" />
        <path className="ph-link" d="M250 200 C210 240 170 290 135 312" />

        {[0, 1].map((i) => (
          <circle key={i} className="ph-ring" cx="250" cy="200" r="34" style={{ animationDelay: `${i * 1.6}s` }} />
        ))}
      </svg>

      {/* Animal encontrado no centro */}
      <span className="ph-center absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-status-found-solid text-white shadow-lg ring-4 ring-surface-elevated">
        <MapPin className="size-6" strokeWidth={2.25} />
      </span>

      {PARTNERS.map(({ x, y, Icon, label, tone, delay }) => (
        <span key={label} className="ph-pin absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5" style={{ left: `${x}%`, top: `${y}%`, animationDelay: delay }}>
          <span className="flex size-12 items-center justify-center rounded-2xl text-white shadow-lg ring-4 ring-surface-elevated/90" style={{ background: tone }}>
            <Icon className="size-6" strokeWidth={2.1} />
          </span>
          <span className="rounded-full bg-surface-elevated/95 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-text-primary shadow-sm">{label}</span>
        </span>
      ))}

      {/* Cartões flutuantes */}
      <div className="ph-card ph-card--a absolute top-4 left-4 hidden items-center sm:flex gap-2.5 rounded-2xl border border-border bg-surface-elevated/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:top-5 sm:left-5">
        <span className="flex size-8 items-center justify-center rounded-full bg-status-sighting-soft text-status-sighting">
          <ScanLine className="size-4" strokeWidth={2.25} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-text-primary">Leitor de microchip</span>
          <span className="text-xs text-text-secondary">Clínica a 400 m</span>
        </span>
      </div>
      <div className="ph-card ph-card--b absolute top-3 left-3 flex sm:top-auto sm:right-5 sm:bottom-5 sm:left-auto items-center gap-2 rounded-full border border-primary/40 bg-surface-elevated/95 py-1.5 pr-3.5 pl-2 shadow-lg backdrop-blur-sm">
        <BadgeCheck className="size-6 text-primary" strokeWidth={2.25} />
        <span className="text-sm font-bold text-text-primary">Parceiro verificado</span>
      </div>
    </div>
  );
}
