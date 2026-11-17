"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/Surface";
import { SharedPhoto } from "./SharedPhoto";
import { takeTappedPhoto } from "./photoMemory";

/**
 * Lugar da foto no esqueleto da página de detalhe. Veio de um toque num cartão
 * com foto (mural, mapa, início)? Mostra essa foto já no lugar, ligada ao voo:
 * a miniatura cresce até aqui e, quando a página chega, vira a foto grande.
 * Sem toque recente (abriu o link direto, recarregou): o bloco cinza de sempre.
 * No servidor e na hidratação não há toque guardado: o HTML é sempre o cinza.
 */
export function SkeletonPhoto({ className }: { className: string }) {
  // Lido uma vez: o esqueleto não muda de foto enquanto carrega.
  const [tapped] = useState(takeTappedPhoto);
  if (!tapped) return <Skeleton className={className} />;
  return (
    <SharedPhoto name={tapped.name}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a mesma miniatura já carregada no cartão */}
      <img src={tapped.src} alt="" aria-hidden="true" className={`${className} bg-surface-muted object-cover`} />
    </SharedPhoto>
  );
}
