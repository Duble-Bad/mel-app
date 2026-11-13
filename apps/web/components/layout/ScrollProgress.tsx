"use client";

import { useEffect, useRef } from "react";

/**
 * Barra dourada de progresso de leitura no topo da tela, em todas as páginas (layout raiz).
 * Enche conforme a página rola e chega ao fim junto com ela. Onde há suporte, quem anima é o
 * próprio CSS (animação por rolagem, fora da thread principal); nos demais navegadores (ex.:
 * Firefox), um ouvinte de rolagem faz o mesmo. Página sem rolagem vertical: a barra não aparece.
 */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (CSS.supports("animation-timeline: scroll()")) return;
    const el = bar.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onChange = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={bar} aria-hidden="true" className="mel-scroll-progress" />;
}
