"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { motion, useAnimationFrame, useInView, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
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

/**
 * Trecho da linha do tempo do mapa (0 a 1) que cada passo percorre: do estado em que o passo
 * começa até o estado final dele. São sempre quatro passos.
 */
const SPANS = [
  [0, 0.24],
  [0.26, 0.6],
  [0.6, 0.86],
  [0.86, 1],
] as const;
/** Quanto tempo cada passo fica na tela (ms) e que fração dele o mapa leva para se mover. */
const STEP_MS = 5600;
const MOVE = 0.55;
const LAST = SPANS.length - 1;

export type StoryTone = "lost" | "brand" | "sighting" | "found";
export interface StoryStep {
  tone: StoryTone;
  tag: string;
  title: string;
  text: string;
}

const noSubscribe = () => () => {};
const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

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
 * "Como funciona" em quatro passos, como um tocador (tipo Stories): o mapa ilustrativo se move de
 * um passo para o outro sozinho enquanto a seção está na tela, com uma barra de quatro segmentos
 * que enche no tempo de cada passo. Nada depende da rolagem e a página tem altura normal.
 *
 * - Controles: pausar/continuar, anterior/próximo, tocar num segmento ou no título de um passo,
 *   deslizar para os lados no celular e setas do teclado com o foco dentro do bloco. Depois do
 *   4º passo ele para (não fica em loop) e o botão vira "Ver de novo".
 * - Pausar congela o segmento e o mapa onde estão. Ir para um passo toca a transição do mapa
 *   daquele passo, mesmo pausado (aí só a transição; o tempo não volta a correr).
 * - Um só valor (`p`, de 0 a 1) alimenta os valores de movimento do mapa, que mexem apenas em
 *   `transform` e `opacity` de poucas camadas (o fundo nunca é redesenhado); o relógio roda num
 *   quadro de animação sem re-renderizar o React, que só re-renderiza quando o passo muda.
 * - "Reduzir movimento": não toca sozinho; os passos mudam só pelos controles e o mapa mostra o
 *   estado final de cada passo, sem movimento.
 * - Sem JavaScript (e até a página ficar interativa): os quatro passos aparecem como lista.
 *
 * O mapa é uma ILUSTRAÇÃO (ruas, horários e pontos inventados); `guardians` mostra um contador só
 * na página de conceito, com número fictício. No site não há contador.
 */
export function NetworkStory({ steps, guardians, caption = "Ilustração" }: { steps: readonly StoryStep[]; guardians?: number; caption?: string }) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.35 });
  // Falso no servidor e na hidratação; verdadeiro assim que a página fica interativa.
  const ready = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const stepRef = useRef(0);
  /** Pausado, mas tocando só a transição do mapa do passo recém-escolhido. */
  const transitionOnly = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  /** Progresso do passo atual (0 a 1): é o enchimento do segmento. */
  const t = useMotionValue(0);
  /** Onde o mapa deve estar na linha do tempo; `p` segue esse alvo com mola (ou direto, sem movimento). */
  const target = useMotionValue(0);
  const smooth = useSpring(target, { stiffness: 120, damping: 26, restDelta: 0.0005 });
  const p = useMotionValue(0);

  useEffect(() => {
    if (reduced) {
      // Sem movimento: cada passo já aparece no estado final.
      t.set(1);
      target.set(SPANS[stepRef.current]?.[1] ?? 1);
      p.set(target.get());
      return target.on("change", (v) => p.set(v));
    }
    p.set(smooth.get());
    return smooth.on("change", (v) => p.set(v));
  }, [reduced, smooth, target, t, p]);

  const place = (s: number, progress: number) => {
    const [from, to] = SPANS[s] ?? SPANS[0];
    target.set(from + (to - from) * ease(Math.min(progress / MOVE, 1)));
  };

  /** Vai para um passo. `manual`: veio de um controle (pausado, toca só a transição do mapa). */
  const go = (to: number, manual = true) => {
    const s = Math.min(Math.max(to, 0), LAST);
    stepRef.current = s;
    setStep(s);
    setEnded(false);
    if (reduced) {
      t.set(1);
      target.set(SPANS[s]?.[1] ?? 1);
      return;
    }
    t.set(0);
    place(s, 0);
    transitionOnly.current = manual && !playing;
  };

  useAnimationFrame((_, delta) => {
    if (reduced || !inView) return;
    const running = playing && !ended;
    if (!running && !transitionOnly.current) return;
    let next = t.get() + Math.min(delta, 64) / STEP_MS;
    if (!running && next >= MOVE) {
      next = MOVE;
      transitionOnly.current = false;
    }
    if (next >= 1) {
      if (stepRef.current < LAST) {
        go(stepRef.current + 1, false);
        return;
      }
      next = 1;
      setEnded(true);
    }
    t.set(next);
    place(stepRef.current, next);
  });

  const toggle = () => {
    if (ended) {
      setPlaying(true);
      go(0, false);
      return;
    }
    transitionOnly.current = false;
    setPlaying((on) => !on);
  };

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "ArrowRight") go(stepRef.current + 1);
    else if (e.key === "ArrowLeft") go(stepRef.current - 1);
    else return;
    e.preventDefault();
  }
  function onPointerDown(e: ReactPointerEvent) {
    swipe.current = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: ReactPointerEvent) {
    const from = swipe.current;
    swipe.current = null;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    // Deslize horizontal claro (não a rolagem da página): esquerda avança, direita volta.
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.5) go(stepRef.current + (dx < 0 ? 1 : -1));
  }

  const running = playing && !ended && !reduced;
  const PlayIcon = ended ? RotateCcw : running ? Pause : Play;
  const playLabel = ended ? "Ver de novo" : running ? "Pausar" : "Continuar";

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
    <div
      ref={root}
      className="ns-story mel-container"
      data-ready={ready}
      data-still={reduced}
      role="group"
      aria-roledescription="carrossel"
      aria-label="Como funciona, passo a passo"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
    >
        <div className="ns-grid">
          <div className="ns-side">
            {/* Segmentos: um por passo. O atual enche no tempo do passo; tocar num deles pula para lá. */}
            <div className="ns-segs" role="group" aria-label="Passos">
              {steps.slice(0, 4).map((s, i) => (
                <button key={s.tag} type="button" className="ns-seg" aria-current={i === step ? "step" : undefined} aria-label={`Passo ${i + 1} de 4: ${s.title}`} onClick={() => go(i)}>
                  <span className="ns-seg-track">
                    {i === step ? <motion.span key="now" className="ns-seg-fill" style={{ scaleX: t }} /> : <span key="idle" className="ns-seg-fill" data-done={i < step} />}
                  </span>
                </button>
              ))}
            </div>

            <ol className="ns-steps" aria-live={running ? "off" : "polite"}>
              {steps.slice(0, 4).map((s, i) => (
                <li key={s.tag} className="ns-step" data-tone={s.tone} data-active={i === step}>
                  <button type="button" className="ns-step-head" tabIndex={ready ? 0 : -1} aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
                    <span className="ns-step-tag">
                      <span className="ns-step-n">{i + 1}</span>
                      {s.tag}
                    </span>
                    <span className="ns-step-title">{s.title}</span>
                  </button>
                  <p className="ns-step-text">{s.text}</p>
                </li>
              ))}
            </ol>

            <div className="ns-controls">
              <button type="button" className="ns-ctl" aria-label="Passo anterior" disabled={step === 0} onClick={() => go(step - 1)}>
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              {!reduced && (
                <button type="button" className="ns-ctl ns-ctl-main" aria-label={playLabel} onClick={toggle}>
                  <PlayIcon size={18} aria-hidden="true" fill={ended ? "none" : "currentColor"} />
                  <span>{playLabel}</span>
                </button>
              )}
              <button type="button" className="ns-ctl" aria-label="Próximo passo" disabled={step === LAST} onClick={() => go(step + 1)}>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
              <span className="ns-count tabular-nums" aria-hidden="true">
                {step + 1} de 4
              </span>
            </div>
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
  );
}
