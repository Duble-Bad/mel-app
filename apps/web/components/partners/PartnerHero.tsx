"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, HandHeart, House, ShoppingBag, Stethoscope, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import "./partner-hero.css";

const REDUCED = "(prefers-reduced-motion: reduce)";
const sub = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Tempo em cada cena (ms): o vídeo dos pets e o mapa da rede que está por trás dele. */
const SCENE_MS = { video: 6500, map: 5200 } as const;
type Scene = keyof typeof SCENE_MS;

/** Tipos de parceiro em volta do vídeo (posição em % do palco; ficam um pouco para fora da moldura). */
const NODES: { Icon: LucideIcon; label: string; x: number; y: number; tone: string }[] = [
  { Icon: Stethoscope, label: "Clínica", x: 2, y: 16, tone: "var(--mel-status-sighting-accent)" },
  { Icon: ShoppingBag, label: "Pet shop", x: 98, y: 22, tone: "var(--mel-primary)" },
  { Icon: HandHeart, label: "ONG", x: 98, y: 82, tone: "var(--mel-status-adoption-accent)" },
  { Icon: House, label: "Lar temporário", x: 3, y: 78, tone: "var(--mel-status-found-accent)" },
];

/**
 * Parceiros no mapa do bairro (cena "mapa"). x/y em % da moldura 4:3; px/py no SVG 500×400
 * (cortado em 4:3, por isso y = 12,5 + y% × 3,75) para as ligações saírem do centro até o pino.
 */
const PINS: { Icon: LucideIcon; label: string; dist: string; x: number; y: number; tone: string }[] = [
  { Icon: Stethoscope, label: "Clínica", dist: "400 m", x: 25, y: 40, tone: "var(--mel-status-sighting-accent)" },
  { Icon: ShoppingBag, label: "Pet shop", dist: "1,2 km", x: 75, y: 24, tone: "var(--mel-primary)" },
  { Icon: HandHeart, label: "ONG", dist: "2 km", x: 77, y: 72, tone: "var(--mel-status-adoption-accent)" },
  { Icon: House, label: "Lar temporário", dist: "900 m", x: 26, y: 78, tone: "var(--mel-status-found-accent)" },
];
const svgX = (x: number) => x * 5;
const svgY = (y: number) => 12.5 + y * 3.75;

const BLOCKS = [
  [-10, -10, 150, 100],
  [170, -10, 150, 70],
  [350, -10, 160, 85],
  [-10, 130, 90, 120],
  [400, 140, 110, 110],
  [-10, 330, 100, 80],
  [190, 320, 150, 90],
  [400, 330, 110, 80],
] as const;

/** Avisos de exemplo (genéricos) que se revezam no canto, como a rede de parceiros trabalhando. */
const TOASTS = [
  { title: "Leitor de microchip", text: "clínica parceira a 400 m", dot: "bg-status-sighting-accent" },
  { title: "Ponto de apoio", text: "pet encontrado recebido agora", dot: "bg-status-found-accent" },
  { title: "Lar temporário", text: "gatinho seguro até a família chegar", dot: "bg-status-adoption-accent" },
  { title: "Novo parceiro", text: "selo liberado pela moderação", dot: "bg-primary" },
];

/**
 * Topo de "Seja um parceiro da MEL" (a partir do conceito A · Rede viva de /dev/hero-conceitos).
 * O quadro alterna duas cenas: o vídeo dos pets e o mapa da rede por trás dele. Na troca, o vídeo
 * encolhe num círculo até virar o pino do centro do mapa (com os pets dentro) enquanto o mapa sai do
 * desfoque com um leve zoom, os parceiros acendem um a um e as ligações se desenham; depois o pino
 * se abre de volta no vídeo. Decorativo. Com "reduzir movimento" fica só o vídeo parado no 1º quadro.
 */
export function PartnerHero() {
  const reduced = useSyncExternalStore(sub, () => window.matchMedia(REDUCED).matches, () => false);
  const video = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [scene, setScene] = useState<Scene>("video");
  const shown: Scene = reduced ? "video" : scene;

  useEffect(() => {
    // Sem autoPlay no atributo: tocaria antes de sabermos da preferência de movimento.
    if (reduced) video.current?.pause();
    else video.current?.play().catch(() => {});
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setT((v) => (v + 1) % TOASTS.length), 3800);
    return () => window.clearInterval(id);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => setScene((s) => (s === "video" ? "map" : "video")), SCENE_MS[scene]);
    return () => window.clearTimeout(id);
  }, [scene, reduced]);

  const toast = TOASTS[t]!;
  return (
    <div className="ph relative mx-auto w-full max-w-xl pt-7 pb-4 sm:px-10 sm:pt-9 lg:max-w-none" data-scene={shown} aria-hidden="true">
      {/* Fundo (grade + ondas) recortado no próprio palco: nunca cria rolagem lateral na página. */}
      <div className="ph-bg">
        <div className="ph-grid" />
        <div className="ph-rings">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 1.3}s` }} />
          ))}
        </div>
      </div>
      {/* Feixes: dos parceiros até o centro (a parte de dentro fica escondida atrás do quadro). */}
      <svg className="ph-beams" viewBox="0 0 100 100" preserveAspectRatio="none">
        {NODES.map((n, i) => (
          <g key={n.label}>
            <line x1={n.x} y1={n.y} x2={50} y2={50} className="ph-beam-track" vectorEffect="non-scaling-stroke" />
            <line x1={n.x} y1={n.y} x2={50} y2={50} className="ph-beam" style={{ animationDelay: `${i * 0.7}s` }} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>

      <div className="ph-frame relative z-[2] aspect-[4/3] overflow-hidden rounded-[28px]">
        {/* Cena 2: o mapa da rede, por trás do vídeo */}
        <div className="ph-map">
          <svg viewBox="0 0 500 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
            <g className="ph-blocks">
              {BLOCKS.map(([x, y, w, h], i) => (
                <rect key={i} x={x} y={y} width={w} height={h} rx="16" />
              ))}
            </g>
            <path className="ph-street" d="M-20 112 C120 104 260 126 520 100" />
            <path className="ph-street" d="M-20 300 C140 288 300 318 520 290" />
            <path className="ph-street" d="M160 -20 C150 120 176 260 166 420" />
            <path className="ph-street" d="M362 -20 C370 140 350 260 366 420" />
            {PINS.map((p, i) => (
              <path
                key={p.label}
                className={i === 0 ? "ph-link ph-link--main" : "ph-link"}
                d={`M250 200 Q${(250 + svgX(p.x)) / 2 + (i % 2 ? 20 : -20)} ${(200 + svgY(p.y)) / 2} ${svgX(p.x)} ${svgY(p.y)}`}
                pathLength={1}
                style={{ "--i": i } as CSSProperties}
              />
            ))}
          </svg>
          {PINS.map(({ Icon, label, dist, x, y, tone }, i) => (
            <span key={label} className="ph-pin" style={{ left: `${x}%`, top: `${y}%`, "--i": i } as CSSProperties}>
              <span className="flex size-10 items-center justify-center rounded-2xl text-white shadow-lg ring-4 ring-surface-elevated/90 sm:size-11" style={{ background: tone }}>
                <Icon className="size-5" strokeWidth={2.1} />
              </span>
              <span className="rounded-full bg-surface-elevated/95 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-text-primary shadow-sm sm:text-xs">
                {label}
                <span className="hidden sm:inline"> · {dist}</span>
              </span>
            </span>
          ))}
          {/* Ondas do pino central (o vídeo encolhido) */}
          <span className="ph-me-pulse" />
          <span className="ph-me-pulse" style={{ animationDelay: "1.2s" }} />
        </div>

        {/* Cena 1: o vídeo, que encolhe até virar o pino do centro do mapa */}
        <div className="ph-video">
          <video ref={video} poster="/videos/mel-e-gatinho-poster.webp" muted loop playsInline preload="metadata" tabIndex={-1} className="size-full object-cover">
            <source src="/videos/mel-e-gatinho.webm" type="video/webm" />
            <source src="/videos/mel-e-gatinho.mp4" type="video/mp4" />
          </video>
          <div className="ph-shade pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
        </div>
        <span className="ph-me-ring" />

        <div className="ph-badge absolute right-4 bottom-4 z-[3] flex items-center gap-2 rounded-full border border-primary/50 bg-background/80 py-1.5 pr-3.5 pl-2 shadow-lg backdrop-blur-md">
          <BadgeCheck className="size-6 text-primary" strokeWidth={2.25} />
          <span className="text-sm font-bold text-text-primary">Parceiro verificado</span>
        </div>
      </div>

      {NODES.map(({ Icon, label, x, y, tone }, i) => (
        <span key={label} className="ph-node absolute z-[3] hidden sm:flex" style={{ left: `${x}%`, top: `${y}%`, "--tone": tone, "--i": i } as CSSProperties}>
          <span className="ph-node-dot">
            <Icon className="size-5" strokeWidth={2.25} />
          </span>
          <span className="ph-node-label">{label}</span>
        </span>
      ))}

      {/* Avisos de exemplo (mesmo visual do aviso do topo do início). */}
      <div className="absolute top-2 left-4 z-[4] overflow-hidden rounded-lg border border-border-strong/70 bg-background/85 shadow-md backdrop-blur-md sm:top-3 sm:left-14">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={toast.title}
            className="flex items-center gap-3 py-2 pr-4 pl-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className={`mel-live size-2.5 shrink-0 rounded-full ${toast.dot}`} />
            <span className="text-sm">
              <strong className="font-bold">{toast.title}</strong> <span className="text-text-secondary">· {toast.text}</span>
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
