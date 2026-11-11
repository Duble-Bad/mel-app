"use client";

import { Minus, Plus, RotateCcw, RotateCw, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Aspect = "free" | "original" | "1:1" | "3:4" | "4:3";
const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "free", label: "Livre" },
  { id: "original", label: "Original" },
  { id: "1:1", label: "Quadrada" },
  { id: "3:4", label: "Vertical" },
  { id: "4:3", label: "Horizontal" },
];
const ZOOM_MAX = 4;
const PAD = 16; // folga entre a moldura e a borda da área de recorte (px)
const MIN_BOX = 64; // menor moldura no recorte livre (px)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rad = (deg: number) => (deg * Math.PI) / 180;

type Box = { x: number; y: number; w: number; h: number };
/** Posição da foto na área de recorte: centro (px), escala (px da tela por px da foto) e ângulo (graus). */
type Place = { cx: number; cy: number; s: number };
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Menor escala em que a foto (girada) cobre a moldura inteira. */
function minScale(box: Box, w: number, h: number, deg: number) {
  const c = Math.abs(Math.cos(rad(deg)));
  const s = Math.abs(Math.sin(rad(deg)));
  return Math.max((box.w * c + box.h * s) / w, (box.w * s + box.h * c) / h);
}

/**
 * Empurra a foto o mínimo necessário para que os 4 cantos da moldura fiquem dentro dela
 * (contas no sistema da própria foto, que pode estar girada).
 */
function clampPlace(p: Place, box: Box, w: number, h: number, deg: number): Place {
  const t = rad(deg);
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const s = Math.max(p.s, minScale(box, w, h, deg));
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ].map(([x, y]) => {
    const dx = x! - p.cx;
    const dy = y! - p.cy;
    return [(dx * cos + dy * sin) / s, (-dx * sin + dy * cos) / s];
  });
  const xs = corners.map((c) => c[0]!);
  const ys = corners.map((c) => c[1]!);
  let mx = 0;
  let my = 0;
  if (Math.max(...xs) > w / 2) mx = Math.max(...xs) - w / 2;
  if (Math.min(...xs) < -w / 2) mx = Math.min(...xs) + w / 2;
  if (Math.max(...ys) > h / 2) my = Math.max(...ys) - h / 2;
  if (Math.min(...ys) < -h / 2) my = Math.min(...ys) + h / 2;
  // Deslocar a foto por (mx, my) no sistema dela = mover o centro na tela por R(θ)·(mx, my)·s.
  return { s, cx: p.cx + (mx * cos - my * sin) * s, cy: p.cy + (mx * sin + my * cos) * s };
}

/**
 * Recorte e ajuste da foto antes de enviar. Formatos fixos ou **livre** (moldura com alças nos
 * cantos e lados); dentro da moldura a foto se arrasta (mouse, toque, setas), aproxima (controle,
 * pinça, roda do mouse) e **gira** (90° de cada vez e "Endireitar" de −45° a 45°), sempre
 * cobrindo a moldura. A roda e o arraste não rolam a página ao fundo. Tudo no aparelho: a foto
 * recortada substitui a escolhida; "Usar sem recortar" mantém a original. Nada é enviado aqui.
 */
export function PhotoCropDialog({ file, onApply: apply_, onCancel: cancel_ }: { file: File; onApply: (file: File) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Endereço da foto: criado uma vez e revogado só ao sair (usar, cancelar, Esc). Antes era revogado
  // na limpeza do efeito; no StrictMode o efeito roda 2× e a imagem ficava quebrada.
  const [url] = useState(() => URL.createObjectURL(file));
  const onApply = (f: File) => {
    URL.revokeObjectURL(url);
    apply_(f);
  };
  const onCancel = () => {
    URL.revokeObjectURL(url);
    cancel_();
  };
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<Aspect>("free");
  const [turns, setTurns] = useState(0); // 90° por vez
  const [fine, setFine] = useState(0); // −45° a 45°
  const [box, setBox] = useState<Box | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; s: number } | null>(null);
  const resize = useRef<{ handle: Handle; start: Box; x: number; y: number } | null>(null);
  const deg = turns * 90 + fine;

  // Abre como modal e trava a rolagem da página enquanto estiver aberto.
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // Tamanho da área de recorte (acompanha a janela).
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Moldura inicial do formato: a maior que cabe na área (no livre e no original, a foto inteira). */
  const layout = useCallback(
    (a: Aspect, d: number, keepZoom = 1) => {
      if (!img || !stage) return;
      const c = Math.abs(Math.cos(rad(d)));
      const s = Math.abs(Math.sin(rad(d)));
      const rotW = img.w * c + img.h * s;
      const rotH = img.w * s + img.h * c;
      const ratio = a === "1:1" ? 1 : a === "3:4" ? 3 / 4 : a === "4:3" ? 4 / 3 : rotW / rotH;
      const aw = stage.w - PAD * 2;
      const ah = stage.h - PAD * 2;
      const bw = Math.min(aw, ah * ratio);
      const bh = bw / ratio;
      const b = { x: (stage.w - bw) / 2, y: (stage.h - bh) / 2, w: bw, h: bh };
      setBox(b);
      setPlace(clampPlace({ cx: stage.w / 2, cy: stage.h / 2, s: minScale(b, img.w, img.h, d) * keepZoom }, b, img.w, img.h, d));
    },
    [img, stage],
  );

  // Primeira montagem e mudança de tamanho da área: refaz a moldura.
  const [laidFor, setLaidFor] = useState("");
  const key = img && stage ? `${img.w}x${img.h}@${stage.w}x${stage.h}` : "";
  if (key && key !== laidFor) {
    setLaidFor(key);
    layout(aspect, deg);
  }

  const zoom = box && place && img ? place.s / minScale(box, img.w, img.h, deg) : 1;
  const update = (p: Place, b = box) => {
    if (!b || !img) return;
    setPlace(clampPlace(p, b, img.w, img.h, deg));
  };
  /** Aproxima mantendo o centro da moldura parado. */
  const zoomTo = (z: number) => {
    if (!box || !place || !img) return;
    const base = minScale(box, img.w, img.h, deg);
    // Acima de 4× só se já estiver (moldura livre diminuída): não salta para trás ao mexer.
    const s = clamp(z, 1, Math.max(ZOOM_MAX, place.s / base)) * base;
    const bx = box.x + box.w / 2;
    const by = box.y + box.h / 2;
    const k = s / place.s;
    update({ s, cx: bx + (place.cx - bx) * k, cy: by + (place.cy - by) * k });
  };
  const rotate = (nextTurns: number, nextFine: number) => {
    setTurns(nextTurns);
    setFine(nextFine);
    // Formatos fixos mantêm a moldura; livre e original se refazem para a foto girada.
    if (aspect === "free" || aspect === "original") layout(aspect, nextTurns * 90 + nextFine, zoom);
    else if (box && place && img) {
      const d = nextTurns * 90 + nextFine;
      setPlace(clampPlace({ ...place, s: minScale(box, img.w, img.h, d) * zoom }, box, img.w, img.h, d));
    }
  };

  // Roda do mouse: aproxima e NÃO rola a página (o onWheel do React é passivo e não pode impedir).
  const zoomRef = useRef(zoomTo);
  const zoomNow = useRef(zoom);
  useLayoutEffect(() => {
    zoomRef.current = zoomTo;
    zoomNow.current = zoom;
  });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current(zoomNow.current * Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && place) {
      const [p, q] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(p!.x - q!.x, p!.y - q!.y), s: zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !place) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [p, q] = [...pointers.current.values()];
      zoomTo(pinch.current.s * (Math.hypot(p!.x - q!.x, p!.y - q!.y) / pinch.current.dist));
      return;
    }
    update({ ...place, cx: place.cx + e.clientX - prev.x, cy: place.cy + e.clientY - prev.y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Alças da moldura (só no livre): redimensiona dentro da área; a foto aumenta se precisar cobrir.
  const onHandleDown = (handle: Handle) => (e: React.PointerEvent) => {
    if (!box) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resize.current = { handle, start: box, x: e.clientX, y: e.clientY };
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r || !stage || !place || !img) return;
    e.stopPropagation();
    const dx = e.clientX - r.x;
    const dy = e.clientY - r.y;
    let { x, y, w, h } = r.start;
    if (r.handle.includes("w")) {
      const nx = clamp(x + dx, PAD, x + w - MIN_BOX);
      w += x - nx;
      x = nx;
    }
    if (r.handle.includes("e")) w = clamp(w + dx, MIN_BOX, stage.w - PAD - x);
    if (r.handle.includes("n")) {
      const ny = clamp(y + dy, PAD, y + h - MIN_BOX);
      h += y - ny;
      y = ny;
    }
    if (r.handle.includes("s")) h = clamp(h + dy, MIN_BOX, stage.h - PAD - y);
    const b = { x, y, w, h };
    setBox(b);
    setPlace(clampPlace(place, b, img.w, img.h, deg));
  };
  const onHandleUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    resize.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!place) return;
    const d = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
    if (d) update({ ...place, cx: place.cx - d[0]!, cy: place.cy - d[1]! });
    else if (e.key === "+" || e.key === "=") zoomTo(zoom + 0.1);
    else if (e.key === "-") zoomTo(zoom - 0.1);
    else return;
    e.preventDefault();
  };

  async function apply() {
    if (!img || !box || !place) return;
    setBusy(true);
    try {
      const el = new Image();
      el.src = url;
      await el.decode();
      // Moldura em pixels da foto original (sem perder resolução; lado maior até 2400 px).
      const k = Math.min(1 / place.s, 2400 / Math.max(box.w, box.h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(box.w * k));
      canvas.height = Math.max(1, Math.round(box.h * k));
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.scale(k, k);
      ctx.translate(-box.x + place.cx, -box.y + place.cy);
      ctx.rotate(rad(deg));
      ctx.scale(place.s, place.s);
      ctx.drawImage(el, -img.w / 2, -img.h / 2);
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

  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold transition-[background-color,transform] duration-200 ease-mel active:scale-[.985] disabled:opacity-40";
  const tool = `${btn} border border-border-strong bg-surface px-3 hover:bg-surface-muted`;
  const ready = Boolean(img && box && place);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-labelledby="recorte-titulo"
      className="m-auto max-h-[calc(100dvh-1rem)] w-[min(100vw-1rem,46rem)] max-w-none overflow-hidden rounded-xl border border-border bg-surface-elevated p-0 text-text-primary backdrop:bg-black/70"
      data-testid="recorte-foto"
    >
      <div className="flex max-h-[calc(100dvh-1rem)] flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:gap-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="recorte-titulo" className="text-lg font-bold">
              Ajustar a foto
            </h2>
            <p className="text-sm text-text-secondary">Arraste a foto, aproxime e gire. No formato Livre, puxe os cantos da moldura. Você pode pular e usar a foto inteira.</p>
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
                layout(a.id, deg);
              }}
              className={`${btn} min-h-10 border-2 px-3 text-sm ${aspect === a.id ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border-strong bg-surface"}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Área de recorte: a foto fora da moldura aparece escurecida. */}
        <div
          ref={stageRef}
          role="group"
          tabIndex={0}
          aria-label="Recorte da foto: arraste ou use as setas para mover; + e − aproximam"
          className="relative h-[clamp(12rem,calc(100dvh-27rem),30rem)] w-full shrink-0 touch-none overflow-hidden overscroll-contain rounded-md bg-black select-none focus-visible:outline-3 focus-visible:outline-focus"
          style={{ cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          data-testid="recorte-moldura"
        >
          {
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Foto escolhida no recorte"
              draggable={false}
              onLoad={(e) => setImg({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="pointer-events-none absolute top-0 left-0 max-w-none origin-center"
              style={
                img && place
                  ? {
                      width: img.w,
                      height: img.h,
                      transform: `translate(${place.cx - img.w / 2}px, ${place.cy - img.h / 2}px) rotate(${deg}deg) scale(${place.s})`,
                    }
                  : { opacity: 0 }
              }
              data-testid="recorte-imagem"
            />
          }
          {box && (
            <div
              className="pointer-events-none absolute rounded-[2px] outline-2 outline-white/90"
              // Escurece tudo fora da moldura.
              style={{ left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.68)" }}
              data-testid="recorte-caixa"
            >
              {/* Linhas de terço: ajudam a centralizar o rosto. */}
              <span aria-hidden="true" className="absolute inset-0 [background:linear-gradient(to_right,transparent_33.2%,rgb(255_255_255/.4)_33.3%,transparent_33.4%,transparent_66.5%,rgb(255_255_255/.4)_66.6%,transparent_66.7%),linear-gradient(to_bottom,transparent_33.2%,rgb(255_255_255/.4)_33.3%,transparent_33.4%,transparent_66.5%,rgb(255_255_255/.4)_66.6%,transparent_66.7%)]" />
              {aspect === "free" &&
                HANDLES.map((h) => (
                  <span
                    key={h}
                    aria-hidden="true"
                    onPointerDown={onHandleDown(h)}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                    data-handle={h}
                    className="pointer-events-auto absolute flex size-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center"
                    style={{
                      left: h.includes("w") ? 0 : h.includes("e") ? "100%" : "50%",
                      top: h.includes("n") ? 0 : h.includes("s") ? "100%" : "50%",
                      cursor: `${h}-resize`,
                    }}
                  >
                    <span className={`block rounded-full border-2 border-black/40 bg-white shadow ${h.length === 2 ? "size-4" : "h-3 w-6"} ${h === "e" || h === "w" ? "rotate-90" : ""}`} />
                  </span>
                ))}
            </div>
          )}
          {!ready && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Carregando a foto…</p>}
        </div>

        {/* Aproximar e girar. */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={tool} aria-label="Afastar" onClick={() => zoomTo(zoom - 0.25)} disabled={!ready || zoom <= 1.001}>
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <label className="flex min-w-40 flex-1 items-center gap-2 text-sm font-semibold">
            <span className="sr-only">Aproximar</span>
            <input type="range" min={1} max={Math.max(ZOOM_MAX, zoom)} step={0.01} value={zoom} disabled={!ready} onChange={(e) => zoomTo(Number(e.target.value))} className="min-w-0 flex-1 accent-primary" />
            <span className="w-11 text-right tabular-nums">{zoom.toFixed(1)}×</span>
          </label>
          <button type="button" className={tool} aria-label="Aproximar mais" onClick={() => zoomTo(zoom + 0.25)} disabled={!ready || zoom >= Math.max(ZOOM_MAX, zoom) - 0.001}>
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={tool} aria-label="Girar 90° para a esquerda" onClick={() => rotate((turns + 3) % 4, fine)} disabled={!ready}>
            <RotateCcw aria-hidden="true" className="size-4" />
          </button>
          <button type="button" className={tool} aria-label="Girar 90° para a direita" onClick={() => rotate((turns + 1) % 4, fine)} disabled={!ready}>
            <RotateCw aria-hidden="true" className="size-4" />
          </button>
          <label className="flex min-w-40 flex-1 items-center gap-2 text-sm font-semibold">
            <span className="shrink-0">Endireitar</span>
            <input
              type="range"
              min={-45}
              max={45}
              step={0.5}
              value={fine}
              disabled={!ready}
              onChange={(e) => {
                const v = Number(e.target.value);
                rotate(turns, Math.abs(v) < 1 ? 0 : v); // perto de zero, encaixa no zero
              }}
              className="min-w-0 flex-1 accent-primary"
              aria-valuetext={`${fine} graus`}
            />
            <span className="w-11 text-right tabular-nums">{fine.toFixed(0)}°</span>
          </label>
          <button
            type="button"
            className={tool}
            aria-label="Desfazer os ajustes"
            onClick={() => {
              setTurns(0);
              setFine(0);
              layout(aspect, 0);
            }}
            disabled={!ready}
          >
            <Undo2 aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" className={`${btn} border border-border-strong bg-surface px-3`} onClick={() => onApply(file)} disabled={busy}>
            Usar sem recortar
          </button>
          <button type="button" className={`${btn} bg-primary px-3 text-primary-foreground shadow-primary hover:bg-primary-hover`} onClick={apply} disabled={busy || !ready} aria-busy={busy || undefined}>
            {busy ? "Aplicando…" : "Usar esta foto"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
