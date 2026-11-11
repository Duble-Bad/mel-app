"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * "404" gigante ao fundo: esticado na horizontal (1,15×) e, na vertical, o bastante para
 * ocupar a altura da tela (medido no navegador). Um oval da mesma cor cobre o miolo do "0".
 * Tudo esmaece para baixo (máscara) e não recebe cliques.
 */
export function Big404() {
  const text = useRef<HTMLSpanElement>(null);
  const [scaleY, setScaleY] = useState(1);

  useLayoutEffect(() => {
    const measure = () => {
      const h = text.current?.offsetHeight;
      if (h) setScaleY((window.innerHeight / h) * 1.4);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div aria-hidden="true" className="nf-bg pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        ref={text}
        className="nf-404 leading-none font-black tracking-tighter whitespace-nowrap select-none"
        style={{ fontSize: "clamp(200px, 48vw, 800px)", transform: `scale(1.15, ${scaleY * 1.4})` }}
      >
        404
      </span>
      <span
        // Maior que no modelo: cobre todo o miolo do "0", para a cachorra ficar inteira sobre o claro.
        // No celular o "0" é mais estreito que a cachorra: o oval fica mais largo que ele.
        className="nf-404-oval absolute h-[30vh] w-[min(84vw,360px)] rounded-full sm:h-[36vh] md:h-[58vh] md:w-[clamp(150px,23vw,440px)]"
        style={{ transform: `scaleY(${scaleY})`, transformOrigin: "center" }}
      />
    </div>
  );
}
