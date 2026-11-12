"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import "./light-frame.css";

const REDUCED = "(prefers-reduced-motion: reduce)";
const sub = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Pegadas que chegam até o quadro pela esquerda, de baixo para cima. */
const PAWS = [
  { x: -13, y: 88, r: 20 },
  { x: -7, y: 77, r: 34 },
  { x: -2, y: 64, r: 18 },
];

/**
 * Moldura de luz (conceito B de /dev/hero-conceitos): um feixe dourado contorna o quadro sem parar,
 * uma aura respira atrás, pegadas chegam até ele e os cartões (`near` e `far`) flutuam em
 * profundidade seguindo o mouse. "Reduzir movimento": tudo parado, sem perder nada de conteúdo.
 */
export function LightFrame({
  children,
  near,
  far,
  className = "",
  nearClassName = "-right-6 bottom-[14%]",
  farClassName = "-top-6 -left-6",
}: {
  children: ReactNode;
  /** Cartão mais "perto" (mexe mais com o mouse) e o mais "longe" (mexe ao contrário). */
  near?: ReactNode;
  far?: ReactNode;
  className?: string;
  /** Posição dos cartões (classes absolutas). */
  nearClassName?: string;
  farClassName?: string;
}) {
  const reduced = useSyncExternalStore(sub, () => window.matchMedia(REDUCED).matches, () => false);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 80, damping: 20 });
  const sy = useSpring(py, { stiffness: 80, damping: 20 });
  const nearX = useTransform(sx, (v) => v * 22);
  const nearY = useTransform(sy, (v) => v * 16);
  const farX = useTransform(sx, (v) => v * -12);
  const farY = useTransform(sy, (v) => v * -9);
  return (
    <div
      className={`lf relative ${className}`}
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
      <div aria-hidden="true" className="lf-aura" />
      <div className="relative z-[2]">
        <div aria-hidden="true" className="lf-beam" />
        <div className="relative overflow-hidden rounded-hero bg-surface-muted shadow-lg">{children}</div>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[3] hidden sm:block">
        {PAWS.map((p, i) => (
          <svg key={i} viewBox="0 0 24 24" className="lf-paw" style={{ left: `${p.x}%`, top: `${p.y}%`, "--r": `${p.r}deg`, "--i": i } as CSSProperties}>
            <ellipse cx="5.5" cy="10" rx="2.2" ry="2.8" />
            <ellipse cx="9.5" cy="5.6" rx="2.2" ry="2.9" />
            <ellipse cx="14.5" cy="5.6" rx="2.2" ry="2.9" />
            <ellipse cx="18.5" cy="10" rx="2.2" ry="2.8" />
            <path d="M12 11.2c-3.3 0-6.4 4.3-6.4 6.9 0 1.9 1.4 2.9 3.2 2.9 1.4 0 2.1-.7 3.2-.7s1.8.7 3.2.7c1.8 0 3.2-1 3.2-2.9 0-2.6-3.1-6.9-6.4-6.9z" />
          </svg>
        ))}
      </div>
      {far && (
        <motion.div style={{ x: farX, y: farY }} className={`absolute z-[4] ${farClassName}`}>
          {far}
        </motion.div>
      )}
      {near && (
        <motion.div style={{ x: nearX, y: nearY }} className={`absolute z-[4] ${nearClassName}`}>
          {near}
        </motion.div>
      )}
    </div>
  );
}

/** Cartão de vidro para usar dentro da LightFrame. */
export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`lf-glass ${className}`}>{children}</div>;
}
