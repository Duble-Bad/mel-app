"use client";

import { useEffect } from "react";

/**
 * Revela ao rolar os elementos com `data-or` (variações em origem.css): liga a classe `or-motion`
 * no <html> e marca `is-in` quando o elemento entra na tela. Sem JS ou com "reduzir movimento",
 * nada é escondido: o conteúdo já vem visível do servidor.
 */
export function RevealMotion() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-or]"));
    root.classList.add("or-motion");
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    for (const el of els) io.observe(el);
    // Rede de segurança: numa rolagem muito rápida (um "peteleco" no celular) o observador pode pular
    // um bloco; qualquer bloco que já passou da borda de baixo da tela aparece.
    let raf = 0;
    const sweep = () => {
      raf = 0;
      for (const el of els) {
        if (!el.classList.contains("is-in") && el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add("is-in");
          io.unobserve(el);
        }
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sweep);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      io.disconnect();
      root.classList.remove("or-motion");
    };
  }, []);
  return null;
}
