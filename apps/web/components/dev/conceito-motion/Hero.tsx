"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ArrowDown, ArrowRight, Eye, ShieldCheck } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { HeroCinema } from "@/components/home/HeroCinema";
import { Magnetic, useCmReduced } from "./shared";

const LINES = [
  [{ word: "Uma", i: 0 }, { word: "rede", i: 1 }, { word: "inteira", i: 2 }],
  [{ word: "procurando", i: 3 }],
];
const ACCENT = "com você.";

/**
 * 1. Topo cinematográfico: título revelado palavra a palavra por máscara, o vídeo da Mel inteiro e
 * centralizado dentro do radar (inclina e desloca os cartões com o ponteiro), cartões com dados reais
 * (`chips`, vindos do servidor), holofote dourado que segue o mouse e botão principal magnético. No toque, nada segue o dedo: só as animações de
 * entrada e o radar.
 */
export function Hero({ chips }: { chips?: ReactNode }) {
  const reduced = useCmReduced();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 70, damping: 18, mass: 0.8 });
  const sy = useSpring(py, { stiffness: 70, damping: 18, mass: 0.8 });
  const spotX = useTransform(sx, (v) => `${v * 100}%`);
  const spotY = useTransform(sy, (v) => `${v * 100}%`);

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

        {/* O mesmo radar do site (telas menores que lg): vídeo inteiro e centralizado, cartões com
            dados reais. Aqui o mouse ainda inclina o palco e desloca os cartões (--px/--py). */}
        <motion.div className="cm-stage-wrap" style={{ "--px": sx, "--py": sy } as unknown as CSSProperties}>
          <HeroCinema variant="radar">{chips}</HeroCinema>
        </motion.div>
      </div>

      <a href="#rede" className="cm-scrollcue">
        <span>Role para ver a rede acordar</span>
        <ArrowDown size={16} aria-hidden="true" />
      </a>
    </section>
  );
}
