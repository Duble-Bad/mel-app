"use client";

import { motion } from "motion/react";
import { useId, useMemo } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Selo de sucesso "Check Draw" (ui-motion-prompts, Done 1), nas cores da MEL:
 * o anel se desenha no sentido horário a partir das 12 h, o círculo se
 * preenche com o degradê do tom, o check se traça e o selo dá um "pop".
 * `confetti`: uma explosão única de confete (reencontro).
 * Com "reduzir movimento", aparece já pronto, sem confete.
 */
type Tone = "found" | "brand" | "sighting";

const GRADIENT: Record<Tone, [string, string]> = {
  found: ["var(--color-status-found-solid)", "var(--color-status-found)"],
  brand: ["var(--color-primary)", "var(--color-brand)"],
  sighting: ["var(--color-status-sighting-solid)", "var(--color-status-sighting)"],
};

const CONFETTI_COLORS = [
  "var(--color-brand)",
  "var(--color-primary)",
  "var(--color-status-found)",
  "var(--color-status-sighting-solid)",
  "var(--color-status-adoption-solid)",
];

// Tempos (s) na proporção da referência (anel 0,4–2,0 s), acelerados para uma tela real.
const T = { arc: [0.1, 0.85], fill: 0.85, check: [0.95, 1.2], pop: 0.9 } as const;

export function SuccessCheck({ tone = "found", size = 48, confetti = false }: { tone?: Tone; size?: number; confetti?: boolean }) {
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const [from, to] = GRADIENT[tone];
  const still = reduced;

  return (
    <span aria-hidden="true" className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <motion.svg
        key={String(still)}
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="overflow-visible"
        initial={still ? false : { scale: 1 }}
        animate={still ? undefined : { scale: [1, 1.12, 1] }}
        transition={{ delay: T.pop, duration: 0.45, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        {/* Trilho do anel */}
        <circle cx="100" cy="100" r="77" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="11" />
        {/* Anel que se desenha a partir das 12 h */}
        <motion.circle
          cx="100"
          cy="100"
          r="77"
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth="11"
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          // Opacidade junto: com ponta arredondada, comprimento 0 ainda desenharia um ponto.
          initial={still ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: T.arc[0], duration: T.arc[1] - T.arc[0], ease: "easeInOut", opacity: { delay: T.arc[0], duration: 0.05 } }}
        />
        {/* Círculo preenchido com o degradê do tom */}
        <motion.circle
          cx="100"
          cy="100"
          r="82"
          fill={`url(#g${id})`}
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: T.fill, duration: 0.2 }}
        />
        {/* Check branco que se traça */}
        <motion.path
          d="M65 102 L90 127 L137 77"
          fill="none"
          stroke="white"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={still ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: T.check[0], duration: T.check[1] - T.check[0], ease: "easeOut", opacity: { delay: T.check[0], duration: 0.04 } }}
        />
      </motion.svg>
      {confetti && !reduced && <ConfettiBurst size={size} />}
    </span>
  );
}

/** Explosão única de confete a partir do selo (posições determinísticas: sem diferença entre servidor e cliente). */
function ConfettiBurst({ size }: { size: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const angle = (i / 36) * Math.PI * 2 + ((i * 37) % 10) / 20;
        const dist = size * (1.4 + ((i * 53) % 100) / 70);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.75 - size * 0.35,
          fall: size * (0.9 + ((i * 29) % 10) / 10),
          rotate: ((i * 97) % 360) - 180,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
          w: 5 + (i % 3) * 2,
          round: i % 4 === 0,
          delay: T.pop + ((i * 13) % 10) / 100,
        };
      }),
    [size],
  );
  return (
    <span className="pointer-events-none absolute inset-0" style={{ overflow: "visible" }}>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2"
          style={{ width: p.w, height: p.round ? p.w : p.w * 1.6, marginLeft: -p.w / 2, marginTop: -p.w / 2, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.6 }}
          animate={{ x: [0, p.x, p.x * 1.08], y: [0, p.y, p.y + p.fall], opacity: [0, 1, 1, 0], rotate: [0, p.rotate, p.rotate * 2], scale: 1 }}
          transition={{ delay: p.delay, duration: 1.8, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] }}
        />
      ))}
    </span>
  );
}
