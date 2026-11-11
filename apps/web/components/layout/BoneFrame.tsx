import type { ReactNode } from "react";

/**
 * Contorno de um osso de cachorro em pé, no quadro 300×400 (mesma proporção 3:4 do vídeo): duas
 * "bolinhas" em cima (onde ficam as orelhas), duas embaixo (patas e rabo) e a haste no meio (corpo).
 */
export const BONE_PATH =
  "M150 30 C136 30 128 8 98 8 C46 6 6 40 8 86 C10 124 36 146 50 158 L50 248 " +
  "C34 260 8 280 8 320 C8 364 48 396 98 392 C128 390 136 366 150 366 " +
  "C164 366 172 390 202 392 C252 396 292 364 292 320 C292 280 266 260 250 248 " +
  "L250 158 C264 146 290 124 292 86 C294 40 254 6 202 8 C172 8 164 30 150 30 Z";

/**
 * Moldura em forma de osso: o conteúdo (vídeo da yorkshire) é recortado no formato do osso, com
 * borda na cor da marca, halo suave e sombra que acompanha o contorno (not-found.css: .nf-bone).
 */
export function BoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="nf-bone absolute inset-0">
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="nf-bone-clip" clipPathUnits="objectBoundingBox">
            <path d={BONE_PATH} transform="scale(0.0033333 0.0025)" />
          </clipPath>
        </defs>
      </svg>
      <div className="nf-bone-fill absolute inset-0" style={{ clipPath: "url(#nf-bone-clip)" }}>
        {children}
      </div>
      <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true" focusable="false">
        <path d={BONE_PATH} fill="none" stroke="var(--mel-primary)" strokeOpacity="0.28" strokeWidth="12" strokeLinejoin="round" />
        <path d={BONE_PATH} fill="none" stroke="var(--mel-primary)" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
