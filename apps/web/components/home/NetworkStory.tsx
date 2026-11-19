"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useReducedMotion } from "@/components/ui/motion/useReducedMotion";
import "./network-story.css";

/* ---------- Mapa ilustrativo (prancha de 800×600), gerado de forma determinística ---------- */

const W = 800;
const H = 600;
const CX = 400;
const CY = 310;
const WAVE_R = 500;

/** Gerador pseudoaleatório com semente fixa: mesmo desenho no servidor e no navegador. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const pct = (n: number, of: number) => `${r3((n / of) * 100)}%`;

const BLOCKS = (() => {
  const rnd = seeded(7);
  const out: { x: number; y: number; w: number; h: number; park: boolean }[] = [];
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 13; col++) {
      const skip = rnd() < 0.07;
      const park = (col === 8 || col === 9) && row === 3;
      if (skip && !park) continue;
      if (park && col === 9) continue; // a praça ocupa duas quadras
      out.push({ x: -190 + col * 96, y: -210 + row * 82, w: park ? 176 : 80, h: 66, park });
    }
  }
  return out;
})();

const GUARDIANS = (() => {
  const rnd = seeded(41);
  const out: { x: number; y: number; near: boolean }[] = [];
  while (out.length < 58) {
    const x = 30 + rnd() * 740;
    const y = 30 + rnd() * 540;
    const d = Math.hypot(x - CX, y - CY);
    if (d < 46) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 34)) continue;
    out.push({ x: r3(x), y: r3(y), near: d < 170 });
  }
  return out;
})();

const TRAIL = "M400 310 C 432 268, 452 240, 486 232 S 566 236, 594 262 S 648 322, 634 384";
const SIGHTINGS = [
  { x: 486, y: 232, on: 0.62, label: "14h32" },
  { x: 594, y: 262, on: 0.7, label: "15h10" },
  { x: 634, y: 384, on: 0.78, label: "15h48" },
];
const PIN = "M0 0 C -4 -10 -14 -17 -14 -28 A 14 14 0 1 1 14 -28 C 14 -17 4 -10 0 0 Z";

/** Faixa da rolagem (0 a 1) em que cada etapa fica em destaque. São sempre quatro etapas. */
const RANGES = [
  [0, 0.26],
  [0.26, 0.6],
  [0.6, 0.86],
  [0.86, 1.2],
] as const;

export type StoryTone = "lost" | "brand" | "sighting" | "found";
export interface StoryStep {
  tone: StoryTone;
  tag: string;
  title: string;
  text: string;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

function Step({ step, index, p }: { step: StoryStep; index: number; p: MotionValue<number> }) {
  const [s, e] = RANGES[index] ?? RANGES[0];
  const act = useTransform(p, (v) => r3(Math.min(clamp01((v - s) * 28 + 1), clamp01((e - v) * 28))));
  return (
    <motion.li className="ns-step" data-tone={step.tone} style={{ "--act": act } as unknown as CSSProperties}>
      <span className="ns-step-tag">
        <span className="ns-step-n">{index + 1}</span>
        {step.tag}
      </span>
      <h3 className="ns-step-title">{step.title}</h3>
      <p className="ns-step-text">{step.text}</p>
    </motion.li>
  );
}

function SightingPin({ s, last, p, r }: { s: (typeof SIGHTINGS)[number]; last: boolean; p: MotionValue<number>; r: MotionValue<number> }) {
  const a = useTransform(p, [s.on, s.on + 1 / 16], [0, 1]);
  const opacity = useTransform([a, r] as MotionValue<number>[], ([av = 0, rv = 0]: number[]) => (last ? av * (1 - rv) : av));
  const y = useTransform(a, (v) => `${(1 - v) * -90}%`);
  return (
    <span className="ns-pin" style={{ left: pct(s.x, W), top: pct(s.y, H) }}>
      <motion.span className="ns-box ns-box-sm" style={{ opacity, y }}>
        <svg viewBox="-40 -64 80 72" aria-hidden="true">
          <circle r="7" className="ns-sight-base" />
          <path d={PIN} className="ns-sight-fill" />
          <circle cy="-28" r="5.5" className="ns-pin-eye" />
          <text y="-50" textAnchor="middle" className="ns-pin-label">
            {s.label}
          </text>
        </svg>
      </motion.span>
    </span>
  );
}

/**
 * "A rede se ativando": seção fixada (sticky) em que a rolagem conduz a história do alerta ao
 * reencontro. Um só valor (a rolagem, suavizada por mola) alimenta valores de movimento que mexem
 * apenas em `transform` e `opacity` de poucas camadas (o mapa de fundo nunca é redesenhado; os
 * Guardiões acesos são revelados por um recorte circular que cresce com a onda). O React não
 * re-renderiza durante a rolagem. A única exceção é a trilha, um traço que se desenha (camada própria).
 *
 * Com "reduzir movimento" (`data-static`): nada fica fixado, o mapa aparece no estado final e as
 * quatro etapas viram uma lista comum.
 *
 * O mapa é uma ILUSTRAÇÃO (ruas, horários e pontos inventados); `guardians` mostra um contador só
 * na página de conceito, com número fictício. No site não há contador.
 */
export function NetworkStory({ steps, guardians, caption = "Ilustração" }: { steps: readonly StoryStep[]; guardians?: number; caption?: string }) {
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.0005 });
  // `p` é a única fonte de todos os valores abaixo: segue a rolagem ou fica em 1 (estado final).
  const p = useMotionValue(0);
  useEffect(() => {
    if (reduced) {
      p.set(1);
      return;
    }
    p.set(smooth.get());
    return smooth.on("change", (v) => p.set(v));
  }, [reduced, smooth, p]);

  const wave = useTransform(p, [0.26, 0.6], [0, 1]);
  const sight = useTransform(p, [0.6, 0.86], [0, 1]);
  const r = useTransform(p, [0.88, 0.9633], [0, 1]);

  // Câmera: começa perto do pino, abre com a onda, acompanha a trilha e fecha no reencontro.
  const camScale = useTransform([wave, r] as MotionValue<number>[], ([w = 0, rv = 0]: number[]) => 1.34 - w * 0.34 + rv * 0.12);
  const camX = useTransform([sight, r] as MotionValue<number>[], ([s = 0, rv = 0]: number[]) => `${r3(s * -5.75 - rv * 3.75)}%`);
  const camY = useTransform(r, (v) => `${r3(v * -3)}%`);

  const waveOpacity = useTransform(wave, (w) => Math.min((1 - w) * w * 3.6, 1));
  // Recorte circular que cresce com a onda; o conteúdo recebe a escala inversa e fica parado no lugar.
  const revealScale = useTransform(wave, (w) => Math.max(w, 0.001));
  const revealInverse = useTransform(revealScale, (s) => 1 / s);
  const revealOpacity = useTransform(wave, [0, 0.02], [0, 1]);

  const lostOpacity = useTransform(p, [0.03, 0.1, 0.88, 0.9633], [0, 1, 1, 0.3]);
  const lostY = useTransform(p, [0.03, 0.1], ["-70%", "0%"]);

  const trailLength = useTransform(p, [0.6, 0.8], [0, 1]);
  const trailOpacity = useTransform([p, r] as MotionValue<number>[], ([v = 0, rv = 0]: number[]) => clamp01((v - 0.6) * 60) * (1 - rv));

  const foundScale = useTransform(r, [0, 1], [0.4, 1]);
  const count = useTransform(wave, (w) => Math.round((guardians ?? 0) * w));

  return (
    <div ref={track} className="ns-story" data-static={reduced}>
      <div className="ns-pinned">
        <div className="mel-container ns-grid">
          <div className="ns-steps-wrap">
            <ol className="ns-steps">
              {steps.slice(0, 4).map((step, i) => (
                <Step key={step.tag} step={step} index={i} p={p} />
              ))}
            </ol>
            <span className="ns-rail" aria-hidden="true">
              <motion.span style={{ "--p": p } as unknown as CSSProperties} />
            </span>
          </div>

          <div
            className="ns-scene"
            role="img"
            aria-label="Mapa ilustrativo de um bairro: o pino do pet perdido emite ondas, os Guardiões acendem e os avistamentos formam uma trilha até o reencontro"
          >
            <div className="ns-board">
              <motion.div className="ns-cam" style={{ scale: camScale, x: camX, y: camY }}>
                {/* 1. Fundo: quadras, avenida e Guardiões apagados. Nunca muda (não é redesenhado). */}
                <svg viewBox={`0 0 ${W} ${H}`} className="ns-layer" aria-hidden="true">
                  <g transform={`rotate(-13 ${CX} ${CY})`}>
                    {BLOCKS.map((b) => (
                      <rect key={`${b.x}-${b.y}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="9" className={b.park ? "ns-park" : "ns-block"} />
                    ))}
                  </g>
                  <path d="M-40 500 C 180 470, 300 380, 420 330 S 680 220, 850 150" className="ns-avenue" />
                  <path d="M-40 500 C 180 470, 300 380, 420 330 S 680 220, 850 150" className="ns-avenue-mark" />
                  {GUARDIANS.map((g) => (
                    <circle key={`o${g.x}`} cx={g.x} cy={g.y} r="3" className="ns-g-off" />
                  ))}
                </svg>

                {/* 2. Onda do alerta */}
                <motion.span className="ns-wave" style={{ scale: wave, opacity: waveOpacity }} />

                {/* 3. Guardiões acesos, revelados de dentro para fora pela onda */}
                <motion.span className="ns-reveal" style={{ scale: revealScale, opacity: revealOpacity }}>
                  <motion.span className="ns-reveal-in" style={{ scale: revealInverse }}>
                    <svg viewBox={`${CX - WAVE_R} ${CY - WAVE_R} ${WAVE_R * 2} ${WAVE_R * 2}`} aria-hidden="true">
                      {GUARDIANS.filter((g) => g.near).map((g) => (
                        <line key={`l${g.x}`} x1={CX} y1={CY} x2={g.x} y2={g.y} className="ns-g-link" />
                      ))}
                      {GUARDIANS.map((g) => (
                        <g key={`g${g.x}`}>
                          <circle cx={g.x} cy={g.y} r="11" className="ns-g-halo" />
                          <circle cx={g.x} cy={g.y} r="3.6" className="ns-g-on" />
                        </g>
                      ))}
                    </svg>
                  </motion.span>
                </motion.span>

                {/* 4. Trilha de avistamentos (o único traço que se desenha; camada própria) */}
                <svg viewBox={`0 0 ${W} ${H}`} className="ns-layer ns-trails" aria-hidden="true">
                  <motion.path d={TRAIL} className="ns-trail" style={{ pathLength: trailLength, opacity: trailOpacity }} />
                  <motion.path d={TRAIL} className="ns-trail ns-trail-found" style={{ opacity: r }} />
                </svg>

                {/* 5. Pinos */}
                {SIGHTINGS.map((s, i) => (
                  <SightingPin key={s.label} s={s} last={i === SIGHTINGS.length - 1} p={p} r={r} />
                ))}

                <span className="ns-pin" style={{ left: pct(CX, W), top: pct(CY, H) }}>
                  <motion.span className="ns-fx" style={{ opacity: lostOpacity }}>
                    <span className="ns-lost-ring" />
                    <span className="ns-lost-ring ns-lost-ring-2" />
                    <motion.span className="ns-box ns-box-lg" style={{ y: lostY }}>
                      <svg viewBox="-70 -88 140 96" aria-hidden="true">
                        <path d={PIN} transform="scale(1.35)" className="ns-lost-fill" />
                        <circle cy="-38" r="7.5" className="ns-pin-eye" />
                        <text y="-66" textAnchor="middle" className="ns-pin-label ns-pin-label-lg">
                          Mel sumiu aqui
                        </text>
                      </svg>
                    </motion.span>
                  </motion.span>
                </span>

                <span className="ns-pin" style={{ left: pct(634, W), top: pct(384, H) }}>
                  <motion.span className="ns-fx" style={{ opacity: r }}>
                    <motion.span className="ns-found-halo" style={{ scale: r }} />
                    <motion.span className="ns-box ns-box-lg" style={{ scale: foundScale }}>
                      <svg viewBox="-70 -88 140 96" aria-hidden="true">
                        <path d={PIN} transform="scale(1.5)" className="ns-found-fill" />
                        <path d="M0 -36.5 c -2.6 -4.6 -9.2 -2.6 -8.6 2.6 c 0.5 4 5.2 6.6 8.6 9.6 c 3.4 -3 8.1 -5.6 8.6 -9.6 c 0.6 -5.2 -6 -7.2 -8.6 -2.6 Z" className="ns-pin-eye" />
                        <text y="-74" textAnchor="middle" className="ns-pin-label ns-pin-label-lg">
                          Reencontro
                        </text>
                      </svg>
                    </motion.span>
                  </motion.span>
                </span>
              </motion.div>
            </div>

            {guardians ? (
              <div className="ns-hud ns-hud-tl">
                <span className="ns-hud-k">Guardiões avisados</span>
                <span className="ns-hud-v tabular-nums">{reduced ? guardians : <motion.span>{count}</motion.span>}</span>
              </div>
            ) : null}
            <span className="ns-hud ns-hud-br ns-hud-k" aria-hidden="true">
              {caption}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
