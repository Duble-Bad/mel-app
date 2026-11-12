"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Bell, Eye, MapPin, PawPrint, PlayCircle, ShieldCheck, UserPlus, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { HeroSlides, VIDEO_SLIDE, VIDEO_SLIDES } from "@/components/home/HeroSlides";
import "./hero-conceitos.css";

/*
 * PROTÓTIPO: três conceitos para o lugar da fita amarela do topo do início, todos já com o vídeo da
 * Mel com o gatinho. Nada aqui é usado pela home real. Movimento só em transform/opacity e tudo
 * desliga com "reduzir movimento".
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const sub = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useReduced = () => useSyncExternalStore(sub, () => window.matchMedia(REDUCED).matches, () => false);

const btnGold =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-primary transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[.97]";
const btnGhost =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-strong px-6 font-bold text-text-primary transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-surface-muted active:scale-[.97]";

/** Texto do topo, igual ao da home (o conceito C troca o destaque de "com você"). */
function HeroCopy({ shimmer = false }: { shimmer?: boolean }) {
  return (
    <div className="relative z-[5] flex flex-col items-start gap-4 lg:gap-6 lg:pt-6">
      <span className="inline-flex animate-enter items-center gap-2 rounded-full border border-primary/50 bg-primary-soft/60 px-3.5 py-1.5 text-sm font-semibold text-text-primary backdrop-blur-sm">
        <PawPrint aria-hidden="true" className="size-4 text-primary" />
        Rede de Encontro e Adoção de Pets
      </span>
      <h1 className="animate-enter text-[clamp(34px,9.5vw,64px)] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance" style={{ animationDelay: "80ms" }}>
        Uma rede inteira procurando{" "}
        <span className={`relative inline-block whitespace-nowrap text-primary ${shimmer ? "hc-shimmer" : ""}`}>
          com você.
          <svg aria-hidden="true" viewBox="0 0 300 30" preserveAspectRatio="none" className="mel-draw absolute -bottom-[0.14em] left-0 h-[0.3em] w-[92%] overflow-visible text-primary">
            <path d="M4 20 C 80 6, 200 4, 296 16" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" style={{ "--len": 320, "--delay": "0.7s" } as CSSProperties} />
          </svg>
        </span>
      </h1>
      <p className="max-w-[36ch] animate-enter text-base text-text-secondary sm:text-body-lg lg:text-xl" style={{ animationDelay: "160ms" }}>
        Encontre, divulgue e receba ajuda da comunidade para reencontrar seu pet, informar avistamentos e apoiar adoções responsáveis.
      </p>
      <div className="flex animate-enter flex-wrap gap-3" style={{ animationDelay: "220ms" }}>
        <Link href="/entrar?criar=1" className={btnGold}>
          <UserPlus aria-hidden="true" className="size-5" strokeWidth={2.25} />
          Criar conta gratuitamente
        </Link>
        <a href="#como-funciona" className={`${btnGhost} max-sm:hidden`}>
          <PlayCircle aria-hidden="true" className="size-5" strokeWidth={2} />
          Como funciona
        </a>
      </div>
    </div>
  );
}

/** Grade padrão da home: texto à esquerda, imagem à direita; embaixo, as ações. */
function HeroGrid({ visual, below }: { visual: ReactNode; below: ReactNode }) {
  return (
    <section aria-label="Topo (protótipo)" className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_75%_35%,color-mix(in_srgb,var(--color-status-found-accent)_14%,transparent),transparent_70%),radial-gradient(40%_50%_at_5%_95%,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent_70%)]"
      />
      <div className="mel-container flex flex-col gap-6 pt-7 pb-10 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-x-10 lg:gap-y-0 lg:pt-14 lg:pb-8">
        <HeroCopy />
        <div className="order-3 lg:order-none">{visual}</div>
        <div className="order-2 lg:order-none lg:col-span-2 lg:mt-10">{below}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------
 * A · REDE VIVA — o vídeo no centro de uma rede: ondas de radar saem da moldura, quatro pontos da
 * rede (alerta, guardião, avistamento, adoção) ficam em volta e "feixes" de luz correm até o quadro.
 * Avisos de exemplo aparecem e somem no canto, como a rede trabalhando.
 * --------------------------------------------------------------------------------------------- */

const NODES: { Icon: LucideIcon; label: string; x: number; y: number; tone: string }[] = [
  { Icon: Bell, label: "Alerta", x: -4, y: 14, tone: "var(--color-status-lost-accent)" },
  { Icon: ShieldCheck, label: "Guardião", x: 104, y: 22, tone: "var(--color-primary)" },
  { Icon: Eye, label: "Avistamento", x: 102, y: 88, tone: "var(--color-status-found-accent)" },
  { Icon: MapPin, label: "Bairro", x: -3, y: 80, tone: "var(--color-primary)" },
];

const TOASTS = [
  { title: "Avistamento a 300 m", text: "com foto, agora há pouco", dot: "bg-status-found-accent" },
  { title: "Guardiões avisados", text: "quem está perto já sabe", dot: "bg-primary" },
  { title: "Reencontro!", text: "mais um pet de volta para casa", dot: "bg-status-found-accent" },
];

function useCycle(n: number, ms: number, reduced: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % n), ms);
    return () => window.clearInterval(id);
  }, [n, ms, reduced]);
  return i;
}

export function ConceptNetwork({ below }: { below: ReactNode }) {
  const reduced = useReduced();
  const t = useCycle(TOASTS.length, 3800, reduced);
  const toast = TOASTS[t]!;
  return (
    <HeroGrid
      below={below}
      visual={
        <div className="hc-net relative mx-auto mb-6 w-full max-w-xl animate-enter lg:max-w-none" style={{ animationDelay: "120ms" }}>
          {/* Grade de pontos e ondas de radar atrás da moldura */}
          <div aria-hidden="true" className="hc-net-grid" />
          <div aria-hidden="true" className="hc-net-rings">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ animationDelay: `${i * 1.3}s` }} />
            ))}
          </div>
          {/* Feixes: dos pontos até o quadro (a parte de dentro fica escondida atrás do vídeo) */}
          <svg aria-hidden="true" className="hc-net-beams" viewBox="0 0 100 100" preserveAspectRatio="none">
            {NODES.map((n, i) => (
              <g key={n.label}>
                <line x1={n.x} y1={n.y} x2={50} y2={50} className="hc-beam-track" vectorEffect="non-scaling-stroke" />
                <line x1={n.x} y1={n.y} x2={50} y2={50} className="hc-beam" style={{ animationDelay: `${i * 0.7}s` }} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>
          <div className="relative z-[2]">
            <HeroSlides slides={VIDEO_SLIDES} />
          </div>
          {NODES.map(({ Icon, label, x, y, tone }, i) => (
            <span
              key={label}
              className="hc-node absolute z-[3] hidden sm:flex"
              style={{ left: `${x}%`, top: `${y}%`, "--tone": tone, "--i": i } as CSSProperties}
            >
              <span className="hc-node-dot">
                <Icon aria-hidden="true" className="size-4.5" strokeWidth={2.25} />
              </span>
              <span className="hc-node-label">{label}</span>
            </span>
          ))}
          {/* Avisos de exemplo (mesmo visual do selo de baixo) */}
          <div className="absolute -top-5 left-4 z-[4] hidden overflow-hidden sm:block rounded-lg border border-border-strong/70 bg-background/85 shadow-md backdrop-blur-md" aria-live="off">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={toast.title}
                className="flex items-center gap-3 py-2 pr-4 pl-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <span aria-hidden="true" className={`mel-live size-2.5 shrink-0 rounded-full ${toast.dot}`} />
                <span className="text-sm">
                  <strong className="font-bold">{toast.title}</strong> <span className="text-text-secondary">· {toast.text}</span>
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------------------------------------
 * B · MOLDURA DE LUZ — premium e contido: um feixe dourado contorna a moldura sem parar, uma aura
 * respira atrás do vídeo, pegadas entram pela esquerda até o quadro e dois cartões de vidro
 * flutuam em profundidade seguindo o mouse.
 * --------------------------------------------------------------------------------------------- */

const PAWS = [
  { x: 2, y: 96, r: 20 },
  { x: 9, y: 86, r: 34 },
  { x: 13, y: 74, r: 18 },
  { x: 21, y: 66, r: 36 },
];

export function ConceptLight({ below }: { below: ReactNode }) {
  const reduced = useReduced();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 80, damping: 20 });
  const sy = useSpring(py, { stiffness: 80, damping: 20 });
  const nearX = useTransform(sx, (v) => v * 22);
  const nearY = useTransform(sy, (v) => v * 16);
  const farX = useTransform(sx, (v) => v * -12);
  const farY = useTransform(sy, (v) => v * -9);
  return (
    <HeroGrid
      below={below}
      visual={
        <div
          className="hc-light relative mx-auto mb-6 w-full max-w-xl animate-enter lg:max-w-none"
          style={{ animationDelay: "120ms" }}
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse" || reduced) return;
            const r = e.currentTarget.getBoundingClientRect();
            px.set((e.clientX - r.left) / r.width - 0.5);
            py.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerLeave={() => {
            px.set(0);
            py.set(0);
          }}
        >
          <div aria-hidden="true" className="hc-aura" />
          <div className="relative z-[2]">
            <div aria-hidden="true" className="hc-beam-border" />
            <HeroSlides slides={VIDEO_SLIDES} />
          </div>
          {/* Pegadas que chegam até o quadro (no lugar da fita) */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[3] hidden sm:block">
            {PAWS.map((p, i) => (
              <svg key={i} viewBox="0 0 24 24" className="hc-paw" style={{ left: `${-14 + p.x}%`, top: `${p.y - 10}%`, "--r": `${p.r}deg`, "--i": i } as CSSProperties}>
                <ellipse cx="5.5" cy="10" rx="2.2" ry="2.8" />
                <ellipse cx="9.5" cy="5.6" rx="2.2" ry="2.9" />
                <ellipse cx="14.5" cy="5.6" rx="2.2" ry="2.9" />
                <ellipse cx="18.5" cy="10" rx="2.2" ry="2.8" />
                <path d="M12 11.2c-3.3 0-6.4 4.3-6.4 6.9 0 1.9 1.4 2.9 3.2 2.9 1.4 0 2.1-.7 3.2-.7s1.8.7 3.2.7c1.8 0 3.2-1 3.2-2.9 0-2.6-3.1-6.9-6.4-6.9z" />
              </svg>
            ))}
          </div>
          {/* Cartões de vidro em profundidade */}
          <motion.div style={{ x: farX, y: farY }} className="hc-glass absolute -top-6 -left-6 z-[4] hidden items-center gap-3 sm:flex">
            <span className="grid size-9 place-items-center rounded-full bg-primary/20 text-primary">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <span className="text-sm leading-tight">
              <strong className="block font-bold">Guardiões no bairro</strong>
              <span className="text-text-secondary">avisados em segundos</span>
            </span>
          </motion.div>
          <motion.div style={{ x: nearX, y: nearY }} className="hc-glass absolute top-[38%] -right-6 z-[4] hidden items-center gap-3 lg:flex">
            <span className="grid size-9 place-items-center rounded-full bg-status-found-accent/20 text-status-found-accent">
              <Eye aria-hidden="true" className="size-5" />
            </span>
            <span className="text-sm leading-tight">
              <strong className="block font-bold">Visto agora</strong>
              <span className="text-text-secondary">foto e local exatos</span>
            </span>
          </motion.div>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------------------------------------
 * C · CINEMÁTICO — o vídeo deixa de ser um cartão e vira o palco: ocupa a metade direita do topo
 * até a borda da tela, dissolvendo no fundo à esquerda. Pinos de avistamento "pousam" na cena com
 * uma onda, e o "com você" ganha um brilho que passa. Sem carrossel: o vídeo fala sozinho.
 * --------------------------------------------------------------------------------------------- */

const PINS = [
  { x: 30, y: 30, label: "Visto às 14h32", delay: 0.6 },
  { x: 74, y: 22, label: "Guardião a 200 m", delay: 2.2 },
  { x: 52, y: 56, label: "Rua das Flores", delay: 3.8 },
];

export function ConceptCinema({ below }: { below: ReactNode }) {
  const reduced = useReduced();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (reduced) video.current?.pause();
    else video.current?.play().catch(() => {});
  }, [reduced]);
  return (
    <section aria-label="Topo (protótipo)" className="hc-cine relative isolate overflow-hidden">
      {/* Palco: vídeo à direita, até a borda da tela (no celular, faixa no topo) */}
      <div className="hc-cine-stage" aria-hidden="false">
        <video
          aria-label={VIDEO_SLIDE.alt}
          poster={VIDEO_SLIDE.src}
          ref={video}
          muted
          loop
          playsInline
          preload="auto"
          className="size-full object-cover"
          style={{ objectPosition: "60% 40%" }}
        >
          <source src={VIDEO_SLIDE.video!.webm} type="video/webm" />
          <source src={VIDEO_SLIDE.video!.mp4} type="video/mp4" />
        </video>
        <div aria-hidden="true" className="hc-cine-fade" />
        {PINS.map((p) => (
          <span key={p.label} aria-hidden="true" className={`hc-pin ${p.x > 60 ? "hc-pin--left" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%`, "--d": `${p.delay}s` } as CSSProperties}>
            <span className="hc-pin-ring" />
            <span className="hc-pin-dot" />
            <span className="hc-pin-label">{p.label}</span>
          </span>
        ))}
      </div>
      <div className="mel-container relative flex flex-col gap-6 pt-7 pb-10 lg:grid lg:min-h-[600px] lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-x-10 lg:pt-14 lg:pb-8">
        <div className="hc-cine-copy">
          <HeroCopy shimmer />
        </div>
        <div className="hidden lg:block" />
        <div className="lg:col-span-2 lg:mt-6">{below}</div>
      </div>
    </section>
  );
}
