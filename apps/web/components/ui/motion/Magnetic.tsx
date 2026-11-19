"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Botão/âncora "magnético": com mouse, o conteúdo é puxado na direção do ponteiro e volta com mola.
 * No toque e com "reduzir movimento" não faz nada (o filho fica parado no lugar).
 */
export function Magnetic({ children, strength = 0.32, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 220, damping: 16, mass: 0.6 });
  const y = useSpring(my, { stiffness: 220, damping: 16, mass: 0.6 });

  function onMove(e: ReactPointerEvent<HTMLSpanElement>) {
    if (reduced || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - (r.left + r.width / 2)) * strength);
    my.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function reset() {
    mx.set(0);
    my.set(0);
  }
  return (
    // A margem negativa com o mesmo preenchimento amplia a área que "sente" o ponteiro sem mexer no layout.
    <span ref={ref} className={`-m-2.5 inline-flex p-2.5 ${className ?? ""}`} onPointerMove={onMove} onPointerLeave={reset}>
      <motion.span className="inline-flex" style={{ x, y }}>
        {children}
      </motion.span>
    </span>
  );
}
