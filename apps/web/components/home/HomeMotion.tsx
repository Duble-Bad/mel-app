"use client";

import { useEffect } from "react";

/**
 * Efeitos da home: revelar seções ao rolar e o brilho que segue o ponteiro
 * nos cartões de ação. Nada acontece com "reduzir movimento" (o conteúdo já
 * vem visível do servidor; o JS só esconde o que ainda está fora da tela).
 */
export function HomeMotion() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Já visível ao carregar: não pisca (fica como está).
    for (const el of els) if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
    root.classList.add("mh-motion");

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    for (const el of els) if (!el.classList.contains("is-in")) io.observe(el);

    const onMove = (e: PointerEvent) => {
      const a = (e.target as Element | null)?.closest<HTMLElement>(".mel-action");
      if (!a) return;
      const r = a.getBoundingClientRect();
      a.style.setProperty("--mx", `${e.clientX - r.left}px`);
      a.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      io.disconnect();
      document.removeEventListener("pointermove", onMove);
      root.classList.remove("mh-motion");
    };
  }, []);
  return null;
}
