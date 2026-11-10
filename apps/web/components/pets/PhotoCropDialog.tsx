"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Aspect = "original" | "1:1" | "3:4" | "4:3";
const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "1:1", label: "Quadrada" },
  { id: "3:4", label: "Vertical" },
  { id: "4:3", label: "Horizontal" },
];
const ZOOM_MAX = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Recorte e ajuste da foto escolhida, antes de enviar: proporção, arrastar (mouse, toque,
 * setas) e aproximar (controle, pinça, roda). Tudo no aparelho: a foto recortada substitui a
 * escolhida; "Usar sem recortar" mantém a original. Nada é enviado aqui.
 */
export function PhotoCropDialog({ file, onApply, onCancel }: { file: File; onApply: (file: File) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [url] = useState(() => URL.createObjectURL(file));
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<Aspect>("original");
  const [view, setView] = useState({ x: 50, y: 50, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const ratio = !size ? 4 / 3 : aspect === "original" ? size.w / size.h : aspect === "1:1" ? 1 : aspect === "3:4" ? 3 / 4 : 4 / 3;
  // Geometria em unidades do quadro (largura 1000): a foto sempre cobre o quadro.
  const fw = 1000;
  const fh = 1000 / ratio;
  const scale = size ? Math.max(fw / size.w, fh / size.h) * view.zoom : 1;
  const rw = size ? size.w * scale : fw;
  const rh = size ? size.h * scale : fh;
  const left = -clamp((view.x / 100) * rw - fw / 2, 0, rw - fw);
  const top = -clamp((view.y / 100) * rh - fh / 2, 0, rh - fh);
  const set = (v: { x: number; y: number; zoom: number }) => setView({ x: clamp(v.x, 0, 100), y: clamp(v.y, 0, 100), zoom: clamp(v.zoom, 1, ZOOM_MAX) });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(p!.x - q!.x, p!.y - q!.y), zoom: view.zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !frameRef.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [p, q] = [...pointers.current.values()];
      set({ ...view, zoom: pinch.current.zoom * (Math.hypot(p!.x - q!.x, p!.y - q!.y) / pinch.current.dist) });
      return;
    }
    const k = frameRef.current.clientWidth / fw;
    set({ ...view, x: view.x - ((e.clientX - prev.x) / (rw * k)) * 100, y: view.y - ((e.clientY - prev.y) / (rh * k)) * 100 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }[e.key];
    if (d) set({ ...view, x: view.x + d[0]!, y: view.y + d[1]! });
    else if (e.key === "+" || e.key === "=") set({ ...view, zoom: view.zoom + 0.1 });
    else if (e.key === "-") set({ ...view, zoom: view.zoom - 0.1 });
    else return;
    e.preventDefault();
  };

  async function apply() {
    if (!size) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      // Trecho da foto original que aparece no quadro (sem perder resolução; lado maior até 2400 px).
      const sw = fw / scale;
      const sh = fh / scale;
      const sx = clamp((view.x / 100) * size.w - sw / 2, 0, size.w - sw);
      const sy = clamp((view.y / 100) * size.h - sh / 2, 0, size.h - sh);
      const k = Math.min(1, 2400 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * k);
      canvas.height = Math.round(sh * k);
      canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("recorte vazio");
      onApply(new File([blob], file.name.replace(/\.[^.]+$/, "") + "-recortada.jpg", { type: "image/jpeg" }));
    } catch (err) {
      console.error("[PhotoCropDialog] recorte falhou", err);
      onApply(file);
    } finally {
      setBusy(false);
    }
  }

  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold transition-[background-color,transform] duration-200 ease-mel active:scale-[.985]";
  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-labelledby="recorte-titulo"
      className="m-auto w-[min(100vw-1.5rem,44rem)] max-w-none rounded-xl border border-border bg-surface-elevated p-0 text-text-primary backdrop:bg-black/70"
      data-testid="recorte-foto"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="recorte-titulo" className="text-lg font-bold">
              Ajustar a foto
            </h2>
            <p className="text-sm text-text-secondary">Arraste para posicionar e aproxime para destacar o seu pet. Você pode pular e usar a foto inteira.</p>
          </div>
          <button type="button" className={`${btn} px-3`} onClick={onCancel} aria-label="Fechar sem alterar a foto">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div role="radiogroup" aria-label="Formato do recorte" className="flex flex-wrap gap-2">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={aspect === a.id}
              onClick={() => {
                setAspect(a.id);
                set({ x: 50, y: 50, zoom: 1 });
              }}
              className={`${btn} border-2 px-3 text-sm ${aspect === a.id ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border-strong bg-surface"}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div
          ref={frameRef}
          role="group"
          tabIndex={0}
          aria-label="Recorte da foto: setas movem, + e − aproximam"
          className="relative mx-auto w-full touch-none overflow-hidden rounded-md bg-black select-none"
          style={{ aspectRatio: `${fw} / ${fh}`, maxHeight: "55vh", maxWidth: `calc(55vh * ${ratio})`, cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => set({ ...view, zoom: view.zoom - e.deltaY * 0.002 })}
          onKeyDown={onKeyDown}
          data-testid="recorte-moldura"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Foto escolhida no recorte"
            draggable={false}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{ position: "absolute", maxWidth: "none", width: `${(rw / fw) * 100}%`, height: `${(rh / fh) * 100}%`, left: `${(left / fw) * 100}%`, top: `${(top / fh) * 100}%` }}
          />
          {/* Linhas de terço: ajudam a centralizar o rosto. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 [background:linear-gradient(to_right,transparent_33.2%,rgb(255_255_255/.35)_33.3%,transparent_33.4%,transparent_66.5%,rgb(255_255_255/.35)_66.6%,transparent_66.7%),linear-gradient(to_bottom,transparent_33.2%,rgb(255_255_255/.35)_33.3%,transparent_33.4%,transparent_66.5%,rgb(255_255_255/.35)_66.6%,transparent_66.7%)]" />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={`${btn} border border-border-strong bg-surface px-3`} aria-label="Afastar" onClick={() => set({ ...view, zoom: view.zoom - 0.25 })} disabled={view.zoom <= 1}>
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <label className="flex flex-1 items-center gap-2 text-sm font-semibold">
            <span className="sr-only">Aproximar</span>
            <input type="range" min={1} max={ZOOM_MAX} step={0.01} value={view.zoom} onChange={(e) => set({ ...view, zoom: Number(e.target.value) })} className="min-w-0 flex-1 accent-primary" />
            <span className="w-12 text-right tabular-nums">{view.zoom.toFixed(1)}×</span>
          </label>
          <button type="button" className={`${btn} border border-border-strong bg-surface px-3`} aria-label="Aproximar mais" onClick={() => set({ ...view, zoom: view.zoom + 0.25 })} disabled={view.zoom >= ZOOM_MAX}>
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={`${btn} border border-border-strong bg-surface`} onClick={() => onApply(file)} disabled={busy}>
            Usar sem recortar
          </button>
          <button type="button" className={`${btn} bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover`} onClick={apply} disabled={busy || !size} aria-busy={busy || undefined}>
            {busy ? "Aplicando…" : "Usar esta foto"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
