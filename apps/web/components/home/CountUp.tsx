"use client";

import { useEffect, useRef } from "react";

const fmt = (n: number) => n.toLocaleString("pt-BR");

/**
 * Número que conta de 0 até o total quando aparece na tela. O servidor já
 * manda o valor final (sem JS ou com "reduzir movimento", fica parado).
 * Leitor de tela lê só o valor final.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let raf = 0;
    const run = () => {
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 1600);
        el.textContent = fmt(Math.round(value * (1 - Math.pow(1 - k, 4))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        run();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <>
      <span ref={ref} aria-hidden="true">
        {fmt(value)}
      </span>
      <span className="sr-only">{fmt(value)}</span>
    </>
  );
}
