"use client";

import { useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const VERSION = "v=7";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Yorkshire de verdade inclinando a cabeça, curiosa (vídeo enviado pelo proprietário), **sem recorte**:
 * aparece com o próprio fundo claro de estúdio, dentro da moldura em arco (not-found.css: .nf-arch).
 * Recortar o fundo deixava franjas nos pelos finos; com o fundo original não há borda de recorte.
 * Vídeo comum (WebM e MP4), então toca igual em todos os navegadores, inclusive no iPhone.
 * Com "reduzir movimento" (e no servidor), mostra a foto parada.
 */
export function YorkieVideo() {
  const still = useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED).matches, () => true);
  const cls = "size-full object-cover select-none";
  if (still) {
    // eslint-disable-next-line @next/next/no-img-element -- foto parada do vídeo, já no tamanho final
    return <img className={cls} src={`/404/yorkshire.jpg?${VERSION}`} alt="" draggable={false} data-testid="yorkshire-still" />;
  }
  return (
    <video
      className={cls}
      poster={`/404/yorkshire.jpg?${VERSION}`}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
      data-testid="yorkshire-video"
    >
      <source src={`/404/yorkshire.webm?${VERSION}`} type="video/webm" />
      <source src={`/404/yorkshire.mp4?${VERSION}`} type="video/mp4" />
    </video>
  );
}
