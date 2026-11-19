"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowRight, Eye, MapPin, ShieldCheck } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { Magnetic, useCmReduced } from "./shared";

const LINES = [
  [{ word: "Uma", i: 0 }, { word: "rede", i: 1 }, { word: "inteira", i: 2 }],
  [{ word: "procurando", i: 3 }],
];
const ACCENT = "com você.";

/** Camada com profundidade: desloca-se contra o ponteiro, proporcional a `depth` (px). */
function Depth({ sx, sy, depth, className, style, children }: { sx: MotionValue<number>; sy: MotionValue<number>; depth: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth);
  return (
    <motion.div className={className} style={{ ...style, x, y }}>
      {children}
    </motion.div>
  );
}

/**
 * 1. Topo cinematográfico: título revelado palavra a palavra por máscara, o vídeo da Mel dentro de
 * uma "lente" de radar com profundidade (inclina e desloca camadas com o ponteiro), holofote dourado
 * que segue o mouse e botão principal magnético. No toque, nada segue o dedo: só as animações de
 * entrada e o radar.
 */
export function Hero() {
  const reduced = useCmReduced();
  const video = useRef<HTMLVideoElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 70, damping: 18, mass: 0.8 });
  const sy = useSpring(py, { stiffness: 70, damping: 18, mass: 0.8 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-9, 9]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [7, -7]);
  const spotX = useTransform(sx, (v) => `${v * 100}%`);
  const spotY = useTransform(sy, (v) => `${v * 100}%`);

  // O vídeo só toca quando está na tela e sem "movimento reduzido".
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (reduced) {
      el.pause();
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) el.play().catch(() => {});
      else el.pause();
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  function onMove(e: ReactPointerEvent<HTMLElement>) {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <section aria-labelledby="cm-hero-title" className="cm-hero" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="cm-hero-bg" aria-hidden="true">
        <div className="cm-hero-grid" />
        <motion.div className="cm-spot-wrap" style={{ x: spotX, y: spotY }}>
          <div className="cm-spot" />
        </motion.div>
      </div>

      <div className="cm-hero-inner mel-container grid items-center gap-x-10 gap-y-12 py-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:py-16">
        <div className="relative z-10 flex flex-col items-start gap-6">
          <p className="cm-eyebrow cm-fade" style={{ "--d": "0ms" } as CSSProperties}>
            <span className="cm-live-dot" aria-hidden="true" />
            Conceito interno · movimento e interação
          </p>

          <h1 id="cm-hero-title" className="cm-h1">
            {LINES.map((line) => (
              <span key={line[0]?.i} className="block">
                {line.map(({ word, i }) => (
                  <span key={word} className="cm-mask">
                    <span className="cm-word" style={{ "--i": i } as CSSProperties}>
                      {word}
                    </span>{" "}
                  </span>
                ))}
              </span>
            ))}
            <span className="cm-accent relative block w-fit text-primary">
              <span className="cm-mask">
                {Array.from(ACCENT).map((ch, i) => (
                  <span key={i} className="cm-word cm-letter" style={{ "--i": 4 + i * 0.42 } as CSSProperties}>
                    {ch === " " ? " " : ch}
                  </span>
                ))}
              </span>
              <svg className="cm-underline" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 13 C 60 3, 120 3, 170 9 S 260 17, 296 6" pathLength={1} />
              </svg>
            </span>
          </h1>

          <p className="cm-fade max-w-xl text-body-lg text-pretty text-text-secondary" style={{ "--d": "780ms" } as CSSProperties}>
            Você publica em 2 minutos. A vizinhança recebe o alerta, os avistamentos chegam ao mapa e o chat seguro
            acompanha tudo até o reencontro.
          </p>

          <div className="cm-fade flex flex-wrap items-center gap-3" style={{ "--d": "900ms" } as CSSProperties}>
            <Magnetic>
              <a href="#rede" className="cm-btn cm-btn-gold">
                <span className="cm-btn-sheen" aria-hidden="true" />
                Ver a rede em ação
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </Magnetic>
            <a href="#laboratorio" className="cm-btn cm-btn-ghost">
              Abrir o laboratório
            </a>
          </div>

          <ul className="cm-fade flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary" style={{ "--d": "1020ms" } as CSSProperties}>
            <li className="inline-flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand" aria-hidden="true" />
              Chat seguro, endereço nunca exposto
            </li>
            <li className="inline-flex items-center gap-2">
              <Eye size={16} className="text-brand" aria-hidden="true" />
              Avistamento sem precisar de conta
            </li>
          </ul>
        </div>

        <div className="cm-stage-wrap">
          <motion.div className="cm-stage" style={{ rotateX, rotateY }}>
            <span className="cm-orbit cm-orbit-a" aria-hidden="true" />
            <span className="cm-orbit cm-orbit-b" aria-hidden="true" />
            {[0, 1, 2].map((i) => (
              <span key={i} className="cm-ring" style={{ "--i": i } as CSSProperties} aria-hidden="true" />
            ))}
            <span className="cm-sweep" aria-hidden="true" />

            <Depth sx={sx} sy={sy} depth={-14} className="cm-lens">
              <video
                ref={video}
                aria-label="Vídeo: a Mel, uma Yorkshire com laço amarelo, ao lado de um gatinho tigrado"
                poster="/videos/mel-e-gatinho-poster.webp"
                muted
                loop
                playsInline
                preload="metadata"
                className="cm-lens-video"
              >
                <source src="/videos/mel-e-gatinho.webm" type="video/webm" />
                <source src="/videos/mel-e-gatinho.mp4" type="video/mp4" />
              </video>
              <span className="cm-lens-glare" aria-hidden="true" />
            </Depth>

            <Depth sx={sx} sy={sy} depth={34} className="cm-chip-pos cm-chip-a">
              <span className="cm-chip" style={{ "--d": "1100ms", "--f": "0s" } as CSSProperties}>
                <span className="cm-chip-dot bg-status-sighting-solid text-white" aria-hidden="true">
                  <Eye size={13} />
                </span>
                <span>
                  <b>Avistada há 4 min</b>
                  <small>Rua Harmonia, Vila Madalena</small>
                </span>
              </span>
            </Depth>
            <Depth sx={sx} sy={sy} depth={56} className="cm-chip-pos cm-chip-b">
              <span className="cm-chip" style={{ "--d": "1300ms", "--f": "-1.6s" } as CSSProperties}>
                <span className="cm-chip-dot bg-primary text-primary-foreground" aria-hidden="true">
                  <ShieldCheck size={13} />
                </span>
                <span>
                  <b>312 Guardiões avisados</b>
                  <small>em um raio de 2 km</small>
                </span>
              </span>
            </Depth>
            <Depth sx={sx} sy={sy} depth={44} className="cm-chip-pos cm-chip-c">
              <span className="cm-chip" style={{ "--d": "1500ms", "--f": "-3.1s" } as CSSProperties}>
                <span className="cm-chip-dot bg-status-found-solid text-white" aria-hidden="true">
                  <MapPin size={13} />
                </span>
                <span>
                  <b>A 200 m de casa</b>
                  <small>última pista confirmada</small>
                </span>
              </span>
            </Depth>
          </motion.div>
        </div>
      </div>

      <a href="#rede" className="cm-scrollcue">
        <span>Role para ver a rede acordar</span>
        <ArrowDown size={16} aria-hidden="true" />
      </a>
    </section>
  );
}
