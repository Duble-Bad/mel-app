"use client";

import { useEffect } from "react";

const MAX_DEG = 7;

/**
 * Inclinação 3D dos cartões do mural (conceito de movimento): com mouse, o cartão sob o ponteiro
 * inclina de leve na direção dele e um brilho acompanha a posição sobre a foto. Um só ouvinte no
 * documento escreve variáveis CSS no cartão (--rx, --ry, --gx, --gy); o resto é CSS (map.css:
 * .mel-pet:hover). Sem estado no React, sem nada no toque nem com "reduzir movimento".
 */
export function CardTilt() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const card = (last?.target as Element | null)?.closest<HTMLElement>(".mel-pet");
      if (!card || !last) return;
      const r = card.getBoundingClientRect();
      const nx = (last.clientX - r.left) / r.width;
      const ny = (last.clientY - r.top) / r.height;
      card.style.setProperty("--ry", `${((nx - 0.5) * 2 * MAX_DEG).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${((0.5 - ny) * 2 * MAX_DEG).toFixed(2)}deg`);
      card.style.setProperty("--gx", `${(nx * 100).toFixed(1)}%`);
      card.style.setProperty("--gy", `${(ny * 100).toFixed(1)}%`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      // No máximo uma medição por quadro, mesmo que o mouse dispare vários eventos.
      if (!frame) frame = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
