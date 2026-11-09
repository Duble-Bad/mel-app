"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FORMAT_PURPOSE, modelLayout, POSTER_MODEL_IDS, POSTER_MODELS, recommendModel, type PosterModel } from "@/lib/poster/models";
import { V2_FORMATS, type PosterV2Format } from "@/lib/poster/PosterV2";

/**
 * "Criar cartaz" do tutor: 1) formato → 2) três modelos com prévias reais do próprio alerta →
 * 3) personalizar (opcional) → 4) baixar, imprimir ou compartilhar. Cada prévia é o próprio
 * PNG final (o gerador dos cartazes), então o que se vê é o que se baixa.
 *
 * DEMONSTRAÇÃO (DEV): a escolha fica na URL desta página (recarregar mantém; outro aparelho
 * não). Nada é gravado no servidor; a foto original, a capa e a ordem do cadastro não mudam.
 */

const FORMATS: PosterV2Format[] = ["impressao", "square", "portrait", "story", "landscape"];
type Framing = { x: number; y: number; zoom: number };
type Custom = { order: number[]; framing: Framing | null };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function PosterStudio({ code, alertUrl, photos }: { code: string; alertUrl: string; photos: { url: string }[] }) {
  const defaultOrder = useMemo(() => photos.slice(0, 3).map((_, i) => i), [photos]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [format, setFormat] = useState<PosterV2Format | null>(null);
  const [model, setModel] = useState<PosterModel | null>(null);
  // Personalização independente por formato e modelo.
  const [custom, setCustom] = useState<Record<string, Custom>>({});
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const restored = useRef(false);

  // Tamanho real das fotos (layout e recomendação dependem da orientação e da resolução).
  useEffect(() => {
    photos.forEach((p, i) => {
      const img = new Image();
      img.onload = () => setSizes((s) => ({ ...s, [i]: { width: img.naturalWidth, height: img.naturalHeight } }));
      img.src = p.url;
    });
  }, [photos]);

  // A escolha vive na URL: recarregar a página mantém o passo, o formato, o modelo e os ajustes.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const q = new URLSearchParams(window.location.search);
    const f = q.get("formato");
    const m = Number(q.get("estilo"));
    if (f && f in V2_FORMATS) {
      const fmt = f as PosterV2Format;
      const order = (q.get("fotos") ?? "").split(",").filter(Boolean).map(Number).filter((i) => photos[i]);
      const foco = /^(\d{1,3}),(\d{1,3})$/.exec(q.get("foco") ?? "");
      const zoom = Number(q.get("zoom"));
      /* eslint-disable react-hooks/set-state-in-effect -- restaura uma única vez o estado salvo na URL */
      setFormat(fmt);
      if (m === 1 || m === 2 || m === 3) {
        setModel(m);
        if (order.length || foco)
          setCustom({ [`${fmt}-${m}`]: { order: order.length ? order : defaultOrder, framing: foco ? { x: Number(foco[1]), y: Number(foco[2]), zoom: zoom >= 1 && zoom <= 3 ? zoom : 1 } : null } });
        setStep(q.get("passo") === "3" ? 3 : 4);
      } else setStep(2);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [photos, defaultOrder]);

  const key = format && model ? `${format}-${model}` : "";
  const current: Custom = custom[key] ?? { order: defaultOrder, framing: null };
  const setCurrent = (c: Custom) => setCustom((all) => ({ ...all, [key]: c }));

  const posterUrl = (fmt: PosterV2Format, m: PosterModel, c: Custom | null, download = false) => {
    const q = new URLSearchParams({ modelo: "proposta", estilo: String(m) });
    if (c && c.order.join(",") !== defaultOrder.join(",")) q.set("fotos", c.order.join(","));
    if (c?.framing) {
      q.set("foco", `${Math.round(c.framing.x)},${Math.round(c.framing.y)}`);
      q.set("zoom", c.framing.zoom.toFixed(2));
    }
    if (download) q.set("baixar", "1");
    return `/alerta/${code}/cartaz/${fmt}?${q.toString()}`;
  };

  // Mantém a URL da página em dia com a escolha (sem recarregar).
  useEffect(() => {
    if (!restored.current) return;
    const q = new URLSearchParams();
    if (format) q.set("formato", format);
    if (format && model && step >= 3) {
      q.set("estilo", String(model));
      if (step === 3) q.set("passo", "3");
      const c = custom[`${format}-${model}`];
      if (c && c.order.join(",") !== defaultOrder.join(",")) q.set("fotos", c.order.join(","));
      if (c?.framing) {
        q.set("foco", `${Math.round(c.framing.x)},${Math.round(c.framing.y)}`);
        q.set("zoom", c.framing.zoom.toFixed(2));
      }
    }
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [format, model, step, custom, defaultOrder]);

  const ordered = (order: number[]) => order.map((i) => sizes[i]).filter((s): s is { width: number; height: number } => Boolean(s));
  const allLoaded = photos.every((_, i) => sizes[i]);
  const recommended = format && allLoaded ? recommendModel(format, ordered(defaultOrder)) : null;

  const steps = ["Formato", "Modelo", "Personalizar", "Usar"];
  return (
    <div className="flex flex-col gap-6" data-testid="criar-cartaz">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas">
        {steps.map((s, i) => (
          <li key={s} aria-current={step === i + 1 ? "step" : undefined} className={`rounded-full px-3 py-1 font-semibold ${step === i + 1 ? "bg-[#e5484d] text-white" : "border border-border text-text-secondary"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="flex flex-col gap-3" aria-labelledby="passo-formato">
          <h2 id="passo-formato" className="text-xl font-bold">
            Onde você vai usar o cartaz?
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFormat(f);
                  setModel(null);
                  setStep(2);
                }}
                className="flex items-center gap-4 rounded-lg border border-border-strong bg-surface p-4 text-left shadow-card"
                data-testid={`formato-${f}`}
              >
                <FormatShape format={f} />
                <span className="flex flex-col">
                  <span className="text-lg font-bold">{FORMAT_PURPOSE[f].title}</span>
                  <span className="text-text-secondary">{FORMAT_PURPOSE[f].purpose}</span>
                  <span className="text-xs text-text-secondary">
                    {V2_FORMATS[f].width}×{V2_FORMATS[f].height}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && format && (
        <section className="flex flex-col gap-3" aria-labelledby="passo-modelo">
          <h2 id="passo-modelo" className="text-xl font-bold">
            Escolha o modelo — {FORMAT_PURPOSE[format].title}
          </h2>
          <p className="text-text-secondary">As prévias já usam as fotos e os dados do seu alerta. Você pode trocar de modelo quando quiser.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {POSTER_MODEL_IDS.map((m) => (
              <figure key={m} className={`flex flex-col gap-2 rounded-lg bg-surface p-3 shadow-card ${recommended?.model === m ? "ring-2 ring-[#f6b928]" : ""}`} data-testid={`modelo-${m}`}>
                <figcaption className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">
                      Modelo {m} — {POSTER_MODELS[m].name}
                    </span>
                    {recommended?.model === m && <span className="rounded-md bg-[#f6b928] px-2 py-0.5 text-xs font-bold text-[#0a111d]">Recomendado pela MEL</span>}
                  </span>
                  <span className="text-sm text-text-secondary">{POSTER_MODELS[m].summary}</span>
                  {adaptedNote(format, m, ordered(defaultOrder).map((s) => s.width / s.height)) && (
                    <span className="text-xs text-text-secondary">{adaptedNote(format, m, ordered(defaultOrder).map((s) => s.width / s.height))}</span>
                  )}
                </figcaption>
                <PosterImage src={posterUrl(format, m, null)} alt={`Prévia do modelo ${m}`} />
                <button type="button" className="min-h-11 rounded-md bg-[#e5484d] px-4 font-semibold text-white" onClick={() => { setModel(m); setStep(4); }}>
                  Usar o Modelo {m}
                </button>
              </figure>
            ))}
          </div>
          {recommended && <p className="text-sm text-text-secondary">Por que recomendamos o Modelo {recommended.model}: {recommended.reason}</p>}
          <button type="button" className="self-start text-sm font-semibold text-link" onClick={() => setStep(1)}>
            ‹ Escolher outro formato
          </button>
        </section>
      )}

      {step === 3 && format && model && (
        <Customize
          format={format}
          model={model}
          photos={photos}
          sizes={sizes}
          value={current}
          defaultOrder={defaultOrder}
          onChange={setCurrent}
          previewUrl={posterUrl(format, model, current)}
          onDone={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && format && model && (
        <section className="flex flex-col gap-3" aria-labelledby="passo-usar">
          <h2 id="passo-usar" className="text-xl font-bold">
            Seu cartaz — {FORMAT_PURPOSE[format].title}, Modelo {model}
          </h2>
          <div className="mx-auto w-full max-w-md">
            <PosterImage src={posterUrl(format, model, custom[key] ?? null)} alt="Cartaz pronto" testId="cartaz-final" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <a href={posterUrl(format, model, custom[key] ?? null, true)} className="flex min-h-12 items-center justify-center rounded-md bg-[#e5484d] px-4 font-semibold text-white">
              Baixar
            </a>
            <a
              href={`/alerta/${code}/cartaz/imprimir?${new URL(posterUrl(format, model, custom[key] ?? null), "http://x").searchParams.toString()}&formato=${format}`}
              target="_blank"
              rel="noopener"
              className="flex min-h-12 items-center justify-center rounded-md border border-border-strong px-4 font-semibold"
            >
              Imprimir
            </a>
            <button
              type="button"
              className="min-h-12 rounded-md border border-border-strong px-4 font-semibold"
              onClick={async () => {
                setNotice(null);
                try {
                  const blob = await (await fetch(posterUrl(format, model, custom[key] ?? null))).blob();
                  const file = new File([blob], `MEL-cartaz-${format}-modelo-${model}.png`, { type: "image/png" });
                  if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], text: `Ajude a encontrar: ${alertUrl}` });
                    return;
                  }
                  window.location.href = posterUrl(format, model, custom[key] ?? null, true);
                  await navigator.clipboard?.writeText(alertUrl).catch(() => undefined);
                  setNotice("Este navegador não compartilha imagens: baixamos o cartaz e copiamos o link do alerta.");
                } catch (err) {
                  if ((err as Error).name !== "AbortError") setNotice("Não deu para compartilhar agora. Use Baixar ou copie o link do alerta.");
                }
              }}
            >
              Compartilhar
            </button>
          </div>
          <button
            type="button"
            className="self-start text-sm font-semibold text-link"
            onClick={async () => {
              await navigator.clipboard?.writeText(alertUrl).catch(() => undefined);
              setNotice("Link do alerta copiado.");
            }}
          >
            Copiar link do alerta
          </button>
          {notice && (
            <p role="status" className="text-sm font-medium">
              {notice}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <button type="button" className="text-link" onClick={() => setStep(3)}>
              Personalizar fotos e enquadramento
            </button>
            <button type="button" className="text-link" onClick={() => setStep(2)}>
              Trocar de modelo
            </button>
            <button type="button" className="text-link" onClick={() => setStep(1)}>
              Outro formato
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Quando o modelo se adapta às fotos que existem (para o tutor não estranhar a prévia). */
function adaptedNote(format: PosterV2Format, m: PosterModel, aspects: number[]): string | null {
  if (!aspects.length) return "Sem fotos: aparece o espaço “Sem foto”. Cadastre fotos para um cartaz melhor.";
  const l = modelLayout(format, m, aspects);
  if (m === 2 && aspects.length === 1) return "Seu pet tem 1 foto: o espaço das complementares mostra “Como reconhecer”.";
  if (l.card) return "O espaço que sobraria mostra “Como reconhecer”.";
  if (m !== 1 && l.used < Math.min(3, aspects.length)) return `Mostra ${l.used} de ${Math.min(3, aspects.length)} fotos para nenhuma ficar pequena demais.`;
  return null;
}

/** Imagem gerada na hora: mostra "gerando…" até carregar, sem pular o layout. */
function PosterImage({ src, alt, testId }: { src: string; alt: string; testId?: string }) {
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onLoad={() => setLoaded(src)} className="w-full rounded-md border border-border" data-testid={testId} />
      {loaded !== src && <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/30 text-sm font-semibold text-white">Gerando…</div>}
    </div>
  );
}

/** Desenho do formato (proporção real) no passo 1. */
function FormatShape({ format }: { format: PosterV2Format }) {
  const { width, height } = V2_FORMATS[format];
  const s = 56 / Math.max(width, height);
  return <span aria-hidden="true" className="shrink-0 rounded-sm border-2 border-[#e5484d] bg-[#e5484d]/15" style={{ width: Math.round(width * s), height: Math.round(height * s) }} />;
}

/** Passo 3: trocar fotos, reordenar, arrastar e aproximar a principal; prévia fiel ao arquivo final. */
function Customize({
  format,
  model,
  photos,
  sizes,
  value,
  defaultOrder,
  onChange,
  previewUrl,
  onDone,
  onBack,
}: {
  format: PosterV2Format;
  model: PosterModel;
  photos: { url: string }[];
  sizes: Record<number, { width: number; height: number }>;
  value: Custom;
  defaultOrder: number[];
  onChange: (c: Custom) => void;
  previewUrl: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const { order } = value;
  const framing = value.framing ?? { x: 50, y: 50, zoom: 1 };
  const main = order[0];
  const aspects = order.map((i) => (sizes[i] ? sizes[i].width / sizes[i].height : undefined));
  const box = aspects.every((a) => a !== undefined) && order.length ? modelLayout(format, model, aspects as number[]).boxes[0]! : null;
  const setFraming = (f: Framing) => onChange({ order, framing: { x: clamp(f.x, 0, 100), y: clamp(f.y, 0, 100), zoom: clamp(f.zoom, 1, 3) } });

  const [preview, setPreview] = useState(previewUrl);
  useEffect(() => {
    const t = setTimeout(() => setPreview(previewUrl), 350);
    return () => clearTimeout(t);
  }, [previewUrl]);

  // Arrastar (mouse e toque), pinça e roda do mouse.
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const a = main !== undefined && sizes[main] ? sizes[main].width / sizes[main].height : null;
  const geometry = () => {
    if (!box || !a) return null;
    const iw = a >= 1 ? 1000 : 1000 * a;
    const ih = a >= 1 ? 1000 / a : 1000;
    const scale = Math.max(box.width / iw, box.height / ih) * framing.zoom;
    return { rw: iw * scale, rh: ih * scale };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(p!.x - q!.x, p!.y - q!.y), zoom: framing.zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [p, q] = [...pointers.current.values()];
      setFraming({ ...framing, zoom: pinch.current.zoom * (Math.hypot(p!.x - q!.x, p!.y - q!.y) / pinch.current.dist) });
      return;
    }
    const g = geometry();
    if (!g || !box || !frameRef.current) return;
    const k = frameRef.current.clientWidth / box.width;
    setFraming({ ...framing, x: framing.x - ((e.clientX - prev.x) / (g.rw * k)) * 100, y: framing.y - ((e.clientY - prev.y) / (g.rh * k)) * 100 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const g = geometry();
  const imgStyle: React.CSSProperties | undefined =
    g && box
      ? {
          position: "absolute",
          width: `${(g.rw / box.width) * 100}%`,
          height: `${(g.rh / box.height) * 100}%`,
          maxWidth: "none",
          left: `${(-clamp((framing.x / 100) * g.rw - box.width / 2, 0, g.rw - box.width) / box.width) * 100}%`,
          top: `${(-clamp((framing.y / 100) * g.rh - box.height / 2, 0, g.rh - box.height) / box.height) * 100}%`,
        }
      : undefined;

  const max = model === 1 ? 1 : 3;
  const toggle = (i: number) =>
    onChange({ order: order.includes(i) ? (order.length > 1 ? order.filter((x) => x !== i) : order) : order.length < max ? [...order, i] : order, framing: value.framing });
  const makeMain = (i: number) => onChange({ order: [i, ...order.filter((x) => x !== i)].slice(0, max), framing: null });
  const move = (pos: number, dir: -1 | 1) => {
    const n = [...order];
    const j = pos + dir;
    if (j < 1 || j >= n.length) return;
    [n[pos], n[j]] = [n[j]!, n[pos]!];
    onChange({ order: n, framing: value.framing });
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="passo-personalizar">
      <h2 id="passo-personalizar" className="text-xl font-bold">
        Personalizar — {FORMAT_PURPOSE[format].title}, Modelo {model}
      </h2>
      <p className="text-sm text-text-secondary">Só muda este cartaz. As fotos originais, a capa e a ordem do cadastro continuam iguais.</p>

      <div className="flex flex-col gap-2">
        <h3 className="font-bold">Fotos {model === 1 ? "(este modelo usa 1)" : "(até 3)"}</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {photos.map((p, i) => {
            const pos = order.indexOf(i);
            return (
              <div key={i} className={`flex flex-col gap-1 rounded-md border p-1 ${pos === 0 ? "border-[#e5484d] ring-2 ring-[#e5484d]" : pos > 0 ? "border-[#f6b928]" : "border-border"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded object-cover" />
                <span className="text-center text-xs font-semibold">{pos === 0 ? "Principal" : pos > 0 ? `Complementar ${pos}` : `Foto ${i + 1}`}</span>
                {pos !== 0 && (
                  <button type="button" className="min-h-8 text-xs font-semibold text-link" onClick={() => makeMain(i)}>
                    Usar como principal
                  </button>
                )}
                {pos !== 0 && max > 1 && (
                  <button type="button" className="min-h-8 text-xs text-text-secondary" onClick={() => toggle(i)}>
                    {pos > 0 ? "Remover" : order.length < max ? "Incluir" : "Limite: 3"}
                  </button>
                )}
                {pos > 0 && (
                  <div className="flex justify-center gap-3 text-sm">
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">Enquadrar a foto principal</h3>
          <p className="text-sm text-text-secondary">Arraste para reposicionar. Aproxime com dois dedos, com a roda do mouse ou com o controle.</p>
          <div
            ref={frameRef}
            className="relative w-full touch-none overflow-hidden rounded-md bg-[#1d2b44] select-none"
            style={{ aspectRatio: box ? `${box.width} / ${box.height}` : "4 / 3", cursor: "grab", maxHeight: 420 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => setFraming({ ...framing, zoom: framing.zoom - e.deltaY * 0.002 })}
            data-testid="editor-moldura"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {imgStyle && main !== undefined && <img src={photos[main]!.url} alt="Foto principal no enquadramento" style={imgStyle} draggable={false} />}
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            Aproximar
            <input type="range" min={1} max={3} step={0.05} value={framing.zoom} onChange={(e) => setFraming({ ...framing, zoom: Number(e.target.value) })} className="flex-1" />
            <span className="w-10 text-right tabular-nums">{framing.zoom.toFixed(1)}×</span>
          </label>
          <button type="button" className="self-start rounded-md border border-border-strong px-3 py-2 text-sm font-semibold" onClick={() => onChange({ order: defaultOrder, framing: null })}>
            Restaurar o modelo original
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">Resultado</h3>
          <PosterImage src={preview} alt="Prévia do cartaz personalizado" testId="editor-previa" />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="min-h-12 rounded-md bg-[#e5484d] px-5 font-semibold text-white" onClick={onDone}>
          Continuar
        </button>
        <button type="button" className="min-h-12 rounded-md border border-border-strong px-5 font-semibold" onClick={onBack}>
          Voltar aos modelos
        </button>
      </div>
    </section>
  );
}
