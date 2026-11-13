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

/** Tipos de parceiro em volta do vídeo (posição em % do palco; ficam um pouco para fora da moldura). */
const NODES: { Icon: LucideIcon; label: string; x: number; y: number; tone: string }[] = [
  { Icon: Stethoscope, label: "Clínica", x: 2, y: 16, tone: "var(--mel-status-sighting-accent)" },
  { Icon: ShoppingBag, label: "Pet shop", x: 98, y: 22, tone: "var(--mel-primary)" },
  { Icon: HandHeart, label: "ONG", x: 98, y: 82, tone: "var(--mel-status-adoption-accent)" },
  { Icon: House, label: "Lar temporário", x: 3, y: 78, tone: "var(--mel-status-found-accent)" },
];

/** Avisos de exemplo (genéricos) que se revezam no canto, como a rede de parceiros trabalhando. */
const TOASTS = [
  { title: "Leitor de microchip", text: "clínica parceira a 400 m", dot: "bg-status-sighting-accent" },
  { title: "Ponto de apoio", text: "pet encontrado recebido agora", dot: "bg-status-found-accent" },
  { title: "Lar temporário", text: "gatinho seguro até a família chegar", dot: "bg-status-adoption-accent" },
  { title: "Novo parceiro", text: "selo liberado pela moderação", dot: "bg-primary" },
];

/**
 * Topo de "Seja um parceiro da MEL" (a partir do conceito A · Rede viva de /dev/hero-conceitos):
 * o vídeo dos pets no centro de uma rede — grade de pontos e ondas de radar atrás, os tipos de
 * parceiro em volta com feixes de luz correndo até o quadro e avisos de exemplo se revezando.
 * Decorativo. Só transform/opacity animam; com "reduzir movimento" o vídeo fica no primeiro quadro,
 * os avisos param e as ondas ficam paradas.
 */
export function PartnerHero() {
  const reduced = useSyncExternalStore(sub, () => window.matchMedia(REDUCED).matches, () => false);
  const video = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);

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

  const toast = TOASTS[t]!;
  return (
    <div className="ph relative mx-auto w-full max-w-xl pt-7 pb-4 sm:px-10 sm:pt-9 lg:max-w-none" aria-hidden="true">
      {/* Fundo (grade + ondas) recortado no próprio palco: nunca cria rolagem lateral na página. */}
      <div className="ph-bg">
        <div className="ph-grid" />
        <div className="ph-rings">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 1.3}s` }} />
          ))}
        </div>
      </div>
      {/* Feixes: dos parceiros até o centro (a parte de dentro fica escondida atrás do vídeo). */}
      <svg className="ph-beams" viewBox="0 0 100 100" preserveAspectRatio="none">
        {NODES.map((n, i) => (
          <g key={n.label}>
            <line x1={n.x} y1={n.y} x2={50} y2={50} className="ph-beam-track" vectorEffect="non-scaling-stroke" />
            <line x1={n.x} y1={n.y} x2={50} y2={50} className="ph-beam" style={{ animationDelay: `${i * 0.7}s` }} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>

      <div className="ph-frame relative z-[2] aspect-[4/3] overflow-hidden rounded-[28px] bg-surface-muted">
        <video ref={video} poster="/videos/mel-e-gatinho-poster.webp" muted loop playsInline preload="metadata" tabIndex={-1} className="size-full object-cover">
          <source src="/videos/mel-e-gatinho.webm" type="video/webm" />
          <source src="/videos/mel-e-gatinho.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full border border-primary/50 bg-background/80 py-1.5 pr-3.5 pl-2 shadow-lg backdrop-blur-md">
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
