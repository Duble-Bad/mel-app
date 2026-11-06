"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { ImageOff, PawPrint } from "lucide-react";

/**
 * Foto de um caso (já reduzida no upload). Sem foto: patinha. Foto que não
 * carrega (arquivo removido, rede): aviso discreto no lugar da imagem quebrada.
 * Nunca inventa uma foto para um caso real.
 */
export function PetPhoto({
  src,
  iconClassName = "size-10",
  fallbackClassName = "flex size-full items-center justify-center",
  ...img
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null; iconClassName?: string; fallbackClassName?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Imagem que já falhou antes da hidratação (HTML do servidor) não dispara onError no React.
  useEffect(() => {
    const el = ref.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (!src || failed) {
    return (
      <span className={`${fallbackClassName} flex-col gap-1 bg-surface-muted text-text-muted`} role={failed ? "img" : undefined} aria-label={failed ? "Foto indisponível" : undefined}>
        {failed ? <ImageOff aria-hidden="true" className={iconClassName} strokeWidth={1.5} /> : <PawPrint aria-hidden="true" className={iconClassName} strokeWidth={1.5} />}
        {failed && <span className="text-xs font-semibold">Foto indisponível</span>}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- miniatura já otimizada no upload; alt vem nas props
  return <img ref={ref} src={src} {...img} onError={() => setFailed(true)} />;
}
