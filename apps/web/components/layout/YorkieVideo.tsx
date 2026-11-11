"use client";

import { useSyncExternalStore } from "react";

type Format = "still" | "video" | "webp";
type Theme = "light" | "dark";

const REDUCED = "(prefers-reduced-motion: reduce)";
const DARK = "(prefers-color-scheme: dark)";
const VERSION = "v=6";

/**
 * Formato da yorkshire neste navegador:
 * - "video": WebM VP9 com transparência (Chrome, Edge, Firefox, Android). Leve e fluido.
 * - "webp": WebP animado com transparência para o WebKit (Safari e todo navegador do iPhone/iPad),
 *   que toca WebM mas ignora a transparência (o fundo sairia preto).
 * - "still": foto parada sem fundo; no servidor, no 1º desenho e com "reduzir movimento".
 */
function currentFormat(): Format {
  if (window.matchMedia(REDUCED).matches) return "still";
  const ua = navigator.userAgent;
  const webkitOnly = /iPhone|iPad|iPod/.test(ua) || (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua));
  return webkitOnly ? "webp" : "video";
}
/** Tema da página: <html data-theme>, ou a preferência do aparelho quando não houver. */
function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia(DARK).matches ? "dark" : "light";
}
const snapshot = () => `${currentFormat()}|${currentTheme()}`;
function subscribe(cb: () => void) {
  const mqs = [window.matchMedia(REDUCED), window.matchMedia(DARK)];
  mqs.forEach((mq) => mq.addEventListener("change", cb));
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mqs.forEach((mq) => mq.removeEventListener("change", cb));
    mo.disconnect();
  };
}

/**
 * Yorkshire de verdade inclinando a cabeça, curiosa (vídeo enviado pelo proprietário, com o fundo
 * de estúdio recortado). Há duas versões do recorte: a clara e a do tema escuro, com a borda mais
 * fina e os fios da beirada escurecidos, para a franja clara dos pelos não marcar no fundo escuro
 * (scripts/recorte-video-404.py). Decorativa.
 */
export function YorkieVideo() {
  const [format, theme] = useSyncExternalStore(subscribe, snapshot, () => "still|light").split("|") as [Format, Theme];
  const base = theme === "dark" ? "/404/yorkshire-escuro" : "/404/yorkshire";
  const cls = "size-full object-contain object-bottom select-none";
  if (format === "video") {
    return (
      <video
        key={base}
        className={cls}
        src={`${base}.webm?${VERSION}`}
        poster={`${base}.webp?${VERSION}`}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        data-testid="yorkshire-video"
        data-theme-variant={theme}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- animação/foto com transparência, já no tamanho final
    <img
      className={cls}
      src={format === "webp" ? `${base}-animada.webp?${VERSION}` : `${base}.webp?${VERSION}`}
      alt=""
      draggable={false}
      data-testid={`yorkshire-${format}`}
      data-theme-variant={theme}
    />
  );
}
