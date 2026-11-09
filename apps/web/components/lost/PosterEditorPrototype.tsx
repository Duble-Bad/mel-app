"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { photoLayout, V2_FORMATS, type PosterV2Format } from "@/lib/poster/PosterV2";

/**
 * PROTÓTIPO (DEV, avaliação do proprietário) do editor de cartazes: escolher a foto principal e
 * as complementares, reordenar, arrastar e aproximar a principal com enquadramento próprio
 * em cada formato. A prévia final é o próprio gerador dos cartazes (mesmo PNG do download).
 * Nada é gravado no servidor: "Salvar" guarda só neste navegador. Não altera a foto original,
 * a capa, a ordem das fotos, a descrição nem os outros formatos.
 */

const FORMATS: PosterV2Format[] = ["impressao", "square", "portrait", "story", "landscape"];
const LABEL: Record<PosterV2Format, string> = { impressao: "A4", square: "Quadrado", portrait: "4:5", story: "Stories", landscape: "Horizontal" };

type Framing = { x: number; y: number; zoom: number };
type Saved = { order: number[]; framing: Partial<Record<PosterV2Format, Framing>> };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function PosterEditorPrototype({ code, photos }: { code: string; photos: { url: string }[] }) {
  const storageKey = `mel-editor-prototipo-${code}`;
  const initialOrder = photos.slice(0, 3).map((_, i) => i);
  const [order, setOrder] = useState<number[]>(initialOrder);
  const [framing, setFraming] = useState<Partial<Record<PosterV2Format, Framing>>>({});
  const [format, setFormat] = useState<PosterV2Format>("square");
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // Proporções reais das fotos (o layout do cartaz depende delas).
  useEffect(() => {
    photos.forEach((p, i) => {
      const img = new Image();
      img.onload = () => setAspects((a) => ({ ...a, [i]: img.naturalWidth / img.naturalHeight }));
      img.src = p.url;
    });
  }, [photos]);

  const main = order[0]!;
  const current: Framing = framing[format] ?? { x: 50, y: 50, zoom: 1 };
  const box = useMemo(() => {
    const known = order.map((i) => aspects[i]);
    if (known.some((a) => a === undefined)) return null;
    return photoLayout(format, known as number[]).main;
  }, [order, aspects, format]);

  // URL da imagem final: só leva enquadramento se o tutor mexeu NESTE formato.
  const finalUrl = (fmt: PosterV2Format, download = false) => {
    const q = new URLSearchParams({ modelo: "proposta", fotos: order.join(",") });
    const f = framing[fmt];
    if (f) {
      q.set("foco", `${Math.round(f.x)},${Math.round(f.y)}`);
      q.set("zoom", f.zoom.toFixed(2));
    }
    if (download) q.set("baixar", "1");
    return `/alerta/${code}/cartaz/${fmt}?${q.toString()}`;
  };
  const [preview, setPreview] = useState(finalUrl(format));
  useEffect(() => {
    const t = setTimeout(() => setPreview(finalUrl(format)), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, framing, format]);

  const setCurrent = (f: Framing) => setFraming((all) => ({ ...all, [format]: { x: clamp(f.x, 0, 100), y: clamp(f.y, 0, 100), zoom: clamp(f.zoom, 1, 3) } }));

  // ----- arrastar (mouse e toque) e aproximar (pinça, roda, controle) -----
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  // Tamanho da foto ampliada, em px do espaço do cartaz (mesma conta do cropToDataUrl).
  const geometry = () => {
    const a = aspects[main];
    if (!box || !a) return null;
    const iw = a >= 1 ? 1000 : 1000 * a;
    const ih = a >= 1 ? 1000 / a : 1000;
    const scale = Math.max(box.width / iw, box.height / ih) * current.zoom;
    return { rw: iw * scale, rh: ih * scale };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(p!.x - q!.x, p!.y - q!.y), zoom: current.zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [p, q] = [...pointers.current.values()];
      setCurrent({ ...current, zoom: pinch.current.zoom * (Math.hypot(p!.x - q!.x, p!.y - q!.y) / pinch.current.dist) });
      return;
    }
    const g = geometry();
    if (!g || !box || !frameRef.current) return;
    const k = frameRef.current.clientWidth / box.width;
    // Arrastar a foto para a direita mostra mais da esquerda: o ponto central anda ao contrário.
    setCurrent({ ...current, x: current.x - ((e.clientX - prev.x) / (g.rw * k)) * 100, y: current.y - ((e.clientY - prev.y) / (g.rh * k)) * 100 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Recorte desenhado com a mesma conta do gerador (cropToDataUrl): prévia instantânea.
  const g = geometry();
  const imgStyle: React.CSSProperties | undefined =
    g && box
      ? {
          // Em % da moldura (que tem a proporção do espaço do cartaz): vale em qualquer largura de tela.
          position: "absolute",
          width: `${(g.rw / box.width) * 100}%`,
          height: `${(g.rh / box.height) * 100}%`,
          maxWidth: "none",
          left: `${(-clamp((current.x / 100) * g.rw - box.width / 2, 0, g.rw - box.width) / box.width) * 100}%`,
          top: `${(-clamp((current.y / 100) * g.rh - box.height / 2, 0, g.rh - box.height) / box.height) * 100}%`,
        }
      : undefined;

  // ----- seleção de fotos -----
  const toggle = (i: number) =>
    setOrder((o) => (o.includes(i) ? (o.length > 1 ? o.filter((x) => x !== i) : o) : o.length < 3 ? [...o, i] : o));
  const makeMain = (i: number) => {
    setOrder((o) => [i, ...o.filter((x) => x !== i)].slice(0, 3));
    setFraming({}); // outra principal: enquadramentos antigos não valem para ela
  };
  const move = (pos: number, dir: -1 | 1) =>
    setOrder((o) => {
      const n = [...o];
      const j = pos + dir;
      if (j < 1 || j >= n.length) return o; // a principal só muda por "Usar como principal"
      [n[pos], n[j]] = [n[j]!, n[pos]!];
      return n;
    });

  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ order, framing } satisfies Saved));
      setNotice("Salvo neste navegador (protótipo: nada foi enviado ao servidor).");
    } catch {
      setNotice("Não deu para salvar neste navegador.");
    }
  };
  const load = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return setNotice("Nada salvo ainda neste navegador.");
      const s = JSON.parse(raw) as Saved;
      setOrder(s.order.filter((i) => photos[i]).slice(0, 3));
      setFraming(s.framing ?? {});
      setNotice("Personalização salva aplicada.");
    } catch {
      setNotice("Não deu para ler o que foi salvo.");
    }
  };
  const share = async () => {
    try {
      const blob = await (await fetch(finalUrl(format))).blob();
      const file = new File([blob], `MEL-cartaz-${format}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else window.location.href = finalUrl(format, true);
    } catch {
      /* compartilhamento cancelado */
    }
  };

  const { width: fw, height: fh } = V2_FORMATS[format];
  return (
    <div className="flex flex-col gap-6" data-testid="editor-prototipo">
      {/* 1. Formato */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">1. Formato</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Formato do cartaz">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={f === format}
              onClick={() => setFormat(f)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${f === format ? "border-transparent bg-[#e5484d] text-white" : "border-border-strong"}`}
            >
              {LABEL[f]}
              {framing[f] ? " •" : ""}
            </button>
          ))}
        </div>
        <p className="text-sm text-text-secondary">• = enquadramento próprio neste formato. Os outros formatos não mudam.</p>
      </section>

      {/* 2. Fotos */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">2. Fotos (até 3)</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {photos.map((p, i) => {
            const pos = order.indexOf(i);
            return (
              <div key={i} className={`flex flex-col gap-1 rounded-md border p-1 ${pos === 0 ? "border-[#e5484d] ring-2 ring-[#e5484d]" : pos > 0 ? "border-[#f6b928]" : "border-border"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded object-cover" />
                <span className="text-center text-xs font-semibold">{pos === 0 ? "Principal" : pos > 0 ? `Complementar ${pos}` : `Foto ${i + 1}`}</span>
                {pos !== 0 && (
                  <button type="button" className="text-xs font-semibold text-link" onClick={() => makeMain(i)}>
                    Usar como principal
                  </button>
                )}
                <button type="button" className="text-xs text-text-secondary" onClick={() => toggle(i)} disabled={pos === 0}>
                  {pos > 0 ? "Remover" : pos === 0 ? "—" : order.length < 3 ? "Incluir" : "Limite: 3"}
                </button>
                {pos > 0 && (
                  <div className="flex justify-center gap-2 text-xs">
                    <button type="button" aria-label="Mover para antes" onClick={() => move(pos, -1)} disabled={pos === 1}>
                      ◀
                    </button>
                    <button type="button" aria-label="Mover para depois" onClick={() => move(pos, 1)} disabled={pos === order.length - 1}>
                      ▶
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Enquadramento */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">3. Enquadrar a principal — {LABEL[format]}</h2>
          <p className="text-sm text-text-secondary">Arraste para reposicionar; pinça, roda do mouse ou o controle para aproximar.</p>
          <div
            ref={frameRef}
            className="relative w-full touch-none overflow-hidden rounded-md bg-[#1d2b44] select-none"
            style={{ aspectRatio: box ? `${box.width} / ${box.height}` : "4 / 3", cursor: "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => setCurrent({ ...current, zoom: current.zoom - e.deltaY * 0.002 })}
            data-testid="editor-moldura"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {imgStyle && <img src={photos[main]!.url} alt="Foto principal no enquadramento" style={imgStyle} draggable={false} />}
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            Aproximar
            <input type="range" min={1} max={3} step={0.05} value={current.zoom} onChange={(e) => setCurrent({ ...current, zoom: Number(e.target.value) })} className="flex-1" />
            <span className="w-10 text-right tabular-nums">{current.zoom.toFixed(1)}×</span>
          </label>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" className="rounded-md border border-border-strong px-3 py-1.5 font-semibold" 
              onClick={() =>
                setFraming((all) => {
                  const rest = { ...all };
                  delete rest[format];
                  return rest;
                })
              }
            >
              Restaurar original deste formato
            </button>
            <button
              type="button"
              className="rounded-md border border-border-strong px-3 py-1.5 font-semibold"
              onClick={() => {
                setOrder(initialOrder);
                setFraming({});
              }}
            >
              Restaurar tudo
            </button>
          </div>
        </div>

        {/* 4. Prévia final (o próprio PNG gerado) */}
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">4. Prévia do arquivo final</h2>
          <p className="text-sm text-text-secondary">
            {LABEL[format]} · {fw}×{fh} — é a mesma imagem que será baixada ou compartilhada.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`Prévia do cartaz ${LABEL[format]}`} className="w-full rounded-md border border-border" data-testid="editor-previa" />
          <div className="flex flex-wrap gap-2 text-sm">
            <a href={finalUrl(format, true)} className="rounded-md bg-[#e5484d] px-3 py-1.5 font-semibold text-white">
              Baixar
            </a>
            <button type="button" className="rounded-md border border-border-strong px-3 py-1.5 font-semibold" onClick={share}>
              Compartilhar
            </button>
            <button type="button" className="rounded-md border border-border-strong px-3 py-1.5 font-semibold" onClick={save}>
              Salvar para reutilizar
            </button>
            <button type="button" className="rounded-md border border-border-strong px-3 py-1.5 font-semibold" onClick={load}>
              Usar o que salvei
            </button>
          </div>
          {notice && (
            <p className="text-sm font-medium" role="status">
              {notice}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
