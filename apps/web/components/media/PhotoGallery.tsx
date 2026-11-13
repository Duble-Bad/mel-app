"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X } from "lucide-react";

export interface GalleryPhoto {
  url: string;
  /** Miniatura (menor); sem ela, usa a própria foto. */
  thumbUrl?: string;
}

/**
 * Fotos de um animal (alerta, encontrado, adoção): a principal no topo, miniaturas
 * quando há mais de uma, e ampliação em tela cheia (setas, deslizar, Esc ou ✕ fecham).
 * Foto que não carrega vira um aviso claro, nunca um ícone quebrado.
 */
export function PhotoGallery({
  photos,
  name,
  mainClassName,
  thumbsClassName = "",
}: {
  photos: GalleryPhoto[];
  /** Nome usado nos textos alternativos ("Foto 2 de 3 de Thor"). */
  name: string;
  mainClassName: string;
  thumbsClassName?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const mainImg = useRef<HTMLImageElement>(null);
  const mainTouchX = useRef<number | null>(null);
  // Deslizar na foto não deve também abrir a tela cheia (o toque termina num clique).
  const swiped = useRef(false);
  const total = photos.length;
  const photo = photos[current];

  const fail = (url: string) => setFailed((s) => new Set(s).add(url));
  const go = (delta: number) => setCurrent((i) => (i + delta + total) % total);
  const alt = (i: number) => (total > 1 ? `Foto ${i + 1} de ${total} de ${name}` : `Foto de ${name}`);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Erro antes da hidratação (foto que falhou enquanto a página carregava) não chama o onError.
  useEffect(() => {
    const img = mainImg.current;
    const first = photos[0]?.url;
    if (first && img?.complete && img.naturalWidth === 0) setFailed((s) => new Set(s).add(first));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a carga inicial
  }, []);

  if (!photo) return null;

  function onKeyDown(e: KeyboardEvent) {
    if (total < 2) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="photo-gallery" data-photos={total}>
      {/* Foto grande: com mais de uma, setas nas laterais, deslizar com o dedo e ←/→ trocam no lugar. */}
      <div
        className="relative overflow-hidden"
        onKeyDown={onKeyDown}
        onTouchStart={(e) => (mainTouchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = mainTouchX.current;
          const end = e.changedTouches[0]?.clientX;
          mainTouchX.current = null;
          if (start == null || end == null || total < 2 || Math.abs(end - start) < 40) return;
          swiped.current = true;
          window.setTimeout(() => (swiped.current = false), 400);
          go(end < start ? 1 : -1);
        }}
      >
        {failed.has(photo.url) ? (
          <Unavailable className={mainClassName} />
        ) : (
          <button
            type="button"
            onClick={() => !swiped.current && setOpen(true)}
            className="group relative block w-full"
            aria-label={`Ampliar ${alt(current).replace(/^F/, "f")}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- foto já reduzida no envio */}
            <img key={photo.url} ref={mainImg} src={photo.url} alt={alt(current)} onError={() => fail(photo.url)} className={`mel-photo-in ${mainClassName}`} />
            <span aria-hidden="true" className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white">
              <Maximize2 className="size-3.5" strokeWidth={2.25} />
              {total > 1 ? `${current + 1}/${total}` : "Ampliar"}
            </span>
          </button>
        )}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima foto"
              className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ChevronRight aria-hidden="true" className="size-6" />
            </button>
            <span className="sr-only" aria-live="polite">
              {alt(current)}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <ul className={`flex gap-2 overflow-x-auto pb-1 ${thumbsClassName}`} aria-label={`Fotos de ${name}`}>
          {photos.map((p, i) => (
            <li key={p.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={`Mostrar ${alt(i).replace(/^F/, "f")}`}
                aria-current={i === current ? "true" : undefined}
                className={`block size-16 overflow-hidden rounded-md border-2 transition-colors sm:size-20 ${
                  i === current ? "border-[#f6b928]" : "border-transparent opacity-80 hover:opacity-100"
                }`}
              >
                {failed.has(p.thumbUrl ?? p.url) ? (
                  <span className="flex size-full items-center justify-center bg-surface-muted text-text-muted">
                    <ImageOff aria-hidden="true" className="size-5" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura gerada no envio
                  <img src={p.thumbUrl ?? p.url} alt="" loading="lazy" onError={() => fail(p.thumbUrl ?? p.url)} className="size-full bg-surface-muted object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        aria-label={`Fotos de ${name}`}
        onClose={() => setOpen(false)}
        onKeyDown={onKeyDown}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null || total < 2 || Math.abs(end - start) < 50) return;
          go(end < start ? 1 : -1);
        }}
        className="m-0 size-full max-h-none max-w-none bg-black/95 p-0 text-white backdrop:bg-black/80"
      >
        {open && (
          <div className="flex size-full flex-col" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-sm font-semibold" aria-live="polite">
                {total > 1 ? `${current + 1} de ${total}` : name}
              </p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar fotos" autoFocus className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25">
                <X aria-hidden="true" className="size-6" />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
              {failed.has(photo.url) ? (
                <Unavailable className="h-64 w-full max-w-md rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- foto já reduzida no envio
                <img src={photo.url} alt={alt(current)} onError={() => fail(photo.url)} className="max-h-full max-w-full object-contain" />
              )}
              {total > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 hover:bg-black/80">
                    <ChevronLeft aria-hidden="true" className="size-6" />
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 hover:bg-black/80">
                    <ChevronRight aria-hidden="true" className="size-6" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function Unavailable({ className }: { className: string }) {
  return (
    <div role="img" aria-label="Foto indisponível" className={`flex flex-col items-center justify-center gap-2 bg-surface-muted text-text-secondary ${className}`}>
      <ImageOff aria-hidden="true" className="size-8" />
      <span className="text-sm">Foto indisponível no momento</span>
    </div>
  );
}
