"use client";

import { useState } from "react";

/** Mostra o cartaz e abre a impressão do navegador assim que a imagem carrega (botão para repetir). */
export function PrintOnLoad({ src }: { src: string }) {
  const [ready, setReady] = useState(false);
  return (
    <>
      <p className="no-print text-sm text-text-secondary">{ready ? "Cartaz pronto para imprimir." : "Gerando o cartaz…"}</p>
      <button type="button" disabled={!ready} onClick={() => window.print()} className="no-print min-h-12 rounded-md bg-[#e5484d] px-6 font-semibold text-white disabled:opacity-50">
        Imprimir
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Cartaz para imprimir"
        className="w-full max-w-2xl border border-border"
        data-testid="cartaz-imprimir"
        onLoad={() => {
          setReady(true);
          window.print();
        }}
      />
    </>
  );
}
