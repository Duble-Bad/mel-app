"use client";

import { useSyncExternalStore } from "react";

type Mode = "still" | "video" | "webp";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Como mostrar a yorkshire neste navegador:
 * - "video": WebM VP9 com transparência (Chrome, Edge, Firefox, Android). Leve e fluido.
 * - "webp": WebP animado com transparência para o WebKit (Safari e todo navegador do iPhone/iPad),
 *   que toca WebM mas ignora a transparência (o fundo sairia preto).
 * - "still": foto parada sem fundo; no servidor, no 1º desenho e com "reduzir movimento".
 */
function currentMode(): Mode {
  if (window.matchMedia(REDUCED).matches) return "still";
  const ua = navigator.userAgent;
  const webkitOnly = /iPhone|iPad|iPod/.test(ua) || (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua));
  return webkitOnly ? "webp" : "video";
}
function subscribe(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Yorkshire de verdade inclinando a cabeça, curiosa (vídeo enviado pelo proprietário, com o fundo
 * de estúdio recortado para ficar solta sobre a página nos dois temas). Decorativa.
 */
export function YorkieVideo() {
  const mode = useSyncExternalStore<Mode>(subscribe, currentMode, () => "still");
  const cls = "size-full object-contain object-bottom select-none";
  if (mode === "video") {
    return (
      <video
        className={cls}
        src="/404/yorkshire.webm?v=4"
        poster="/404/yorkshire.webp?v=4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        data-testid="yorkshire-video"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- animação/foto com transparência, já no tamanho final
  return <img className={cls} src={mode === "webp" ? "/404/yorkshire-animada.webp?v=4" : "/404/yorkshire.webp?v=4"} alt="" draggable={false} data-testid={`yorkshire-${mode}`} />;
}
