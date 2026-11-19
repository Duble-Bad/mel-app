"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";
import { useReducedMotion } from "@/components/ui/motion/useReducedMotion";
import "./goo-backdrop.css";

const blob = (width: string, left: string, top: string, tx: string, ty: string, ts: number, seconds: number) =>
  ({ width, left, top, "--tx": tx, "--ty": ty, "--ts": ts, animationDuration: `${seconds}s` }) as CSSProperties;

const BLOBS: CSSProperties[] = [
  blob("22%", "-6%", "62%", "90%", "-30%", 1.25, 13),
  blob("16%", "12%", "78%", "140%", "-60%", 0.8, 17),
  blob("20%", "38%", "80%", "-70%", "-34%", 1.2, 15),
  blob("15%", "60%", "74%", "110%", "-50%", 1.3, 19),
  blob("24%", "80%", "58%", "-80%", "26%", 0.85, 14),
  blob("14%", "-4%", "-14%", "120%", "60%", 1.3, 21),
  blob("17%", "86%", "-18%", "-130%", "50%", 1.15, 18),
];

/**
 * Cartão com fundo "de mel": bolhas douradas que se fundem (filtro "gooey" em SVG) atrás do
 * conteúdo. Com mouse, as bolhas se movem enquanto o bloco está na tela e uma bolha extra segue o
 * ponteiro. No toque e com "reduzir movimento" as bolhas ficam paradas: o filtro é desenhado uma
 * vez só, sem custo por quadro no celular.
 */
export function GooBackdrop({ className = "", children }: { className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.05 });
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 60, damping: 16 });
  const y = useSpring(my, { stiffness: 60, damping: 16 });

  return (
    <div
      ref={ref}
      className={`mh-goo ${className}`}
      data-live={inView && !reduced}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - (r.left + r.width / 2));
        my.set(e.clientY - (r.top + r.height / 2));
      }}
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <filter id="mh-goo-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" />
          </filter>
        </defs>
      </svg>
      <div className="mh-goo-layer" aria-hidden="true">
        {BLOBS.map((style, i) => (
          <span key={i} className="mh-goo-blob" style={style} />
        ))}
        <motion.span className="mh-goo-blob mh-goo-ptr" style={{ x, y }} />
      </div>
      {children}
    </div>
  );
}
