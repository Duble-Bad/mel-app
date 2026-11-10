"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  Link2,
  Maximize2,
  Minus,
  PawPrint,
  Plus,
  Printer,
  Proportions,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Save,
  Send,
  Share2,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { resetPosterDesign, savePosterDesign, type PosterDesign } from "@mel/data";
import { ActionButton, motionBadge, motionCard, MotionRoot, StepStage, type Direction } from "@/components/motion/Motion";
import { MotionSteps } from "@/components/motion/MotionSteps";
import type { StepState } from "@/components/ui/StepIndicator";
import { FORMAT_PURPOSE, isPosterModel, modelCapacity, modelLayout, POSTER_MODEL_IDS, POSTER_MODELS, recommendModel, type PosterModel } from "@/lib/poster/models";
import { V2_FORMATS, type PosterV2Format } from "@/lib/poster/PosterV2";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * "Criar cartaz" do tutor: 1) formato → 2) quatro modelos com prévias reais do próprio alerta →
 * 3) personalizar (opcional) → 4) baixar, imprimir ou compartilhar. Cada prévia é o próprio
 * PNG final (o gerador dos cartazes), então o que se vê é o que se baixa.
 *
 * A escolha em andamento fica na URL desta página (recarregar mantém). O TUTOR pode salvar o
 * cartaz de cada formato na conta (o banco confere que é ele); a página abre com o que foi salvo,
 * em qualquer aparelho. A foto original, a capa e a ordem do cadastro nunca mudam.
 */

const FORMATS: PosterV2Format[] = ["impressao", "square", "portrait", "story", "landscape"];
type Step = 1 | 2 | 3 | 4;
type Framing = { x: number; y: number; zoom: number };
type Custom = { order: number[]; framing: Framing | null };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const STEPS: { label: string; icon: LucideIcon }[] = [
  { label: "Formato", icon: Proportions },
  { label: "Modelo", icon: LayoutGrid },
  { label: "Personalizar", icon: SlidersHorizontal },
  { label: "Usar", icon: Send },
];

/** Onde cada formato é usado, em linguagem simples (o título e as medidas vêm do gerador). */
const FORMAT_CARD: Record<PosterV2Format, { icon: LucideIcon; where: string }> = {
  impressao: {
    icon: Printer,
    where: "Imprimir e colar em postes, comércios, condomínios e murais.",
  },
  square: {
    icon: Square,
    where: "Grupos de WhatsApp, Facebook e feed do Instagram.",
  },
  portrait: {
    icon: RectangleVertical,
    where: "Feed do Instagram e Facebook: ocupa mais espaço na tela.",
  },
  story: {
    icon: Smartphone,
    where: "Stories do Instagram e Status do WhatsApp, em tela cheia.",
  },
  landscape: {
    icon: RectangleHorizontal,
    where: "Links, X (Twitter) e publicações largas.",
  },
};

// Botões do fluxo: vermelho da identidade MEL (contraste ≥ 4,5:1 com branco), 48 px de toque.
const btn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 font-semibold transition-[background-color,filter,transform] duration-200 ease-mel active:scale-[.985]";
const btnPrimary = `${btn} bg-status-lost-solid text-white hover:brightness-110`;
const btnSecondary = `${btn} border border-border-strong bg-surface-elevated text-text-primary hover:bg-surface-muted`;
const btnLink = "inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-link underline-offset-4 hover:underline";

type Saved = { model: PosterModel; order: number[]; framing: Framing | null };

export function PosterStudio({
  code,
  alertUrl,
  photos,
  isOwner = false,
  savedDesigns = [],
}: {
  code: string;
  alertUrl: string;
  photos: { id?: string; url: string }[];
  /** Só o tutor salva (o banco confere de novo). */
  isOwner?: boolean;
  savedDesigns?: PosterDesign[];
}) {
  // Cartazes salvos, por formato, com as fotos convertidas de id para a posição atual.
  const [saved, setSaved] = useState<Partial<Record<PosterV2Format, Saved>>>(() =>
    Object.fromEntries(
      savedDesigns.map((d) => [
        d.format,
        { model: d.model, order: d.photoIds.map((id) => photos.findIndex((p) => p.id === id)).filter((i) => i >= 0), framing: d.framing },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  // Recomendação olha as 3 primeiras fotos (capa primeiro), como antes do modelo 4.
  const firstThree = useMemo(() => photos.slice(0, 3).map((_, i) => i), [photos]);
  const [step, setStep] = useState<Step>(1);
  const [format, setFormat] = useState<PosterV2Format | null>(null);
  const [model, setModel] = useState<PosterModel | null>(null);
  // Personalização independente por formato e modelo.
  const [custom, setCustom] = useState<Record<string, Custom>>({});
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState<{ src: string; title: string } | null>(null);
  const restored = useRef(false);
  // Sentido da última troca de etapa e se o tutor já navegou (o foco só muda depois disso).
  const [direction, setDirection] = useState<Direction>("forward");
  const [moved, setMoved] = useState(false);
  const [sharing, setSharing] = useState(false);

  /** Fotos que o modelo de fato mostra nesta ordem: as que deixariam alguma estreita demais saem. */
  function fit(fmt: PosterV2Format, m: PosterModel, order: number[]): number[] {
    const capped = order.slice(0, modelCapacity(fmt, m));
    const aspects = capped.map((i) => (sizes[i] ? sizes[i].width / sizes[i].height : undefined));
    if (aspects.some((a) => a === undefined)) return capped;
    return capped.slice(0, Math.max(Math.min(1, capped.length), modelLayout(fmt, m, aspects as number[]).used));
  }
  /** O que o gerador mostra sem ajuste (capa primeiro, até a capacidade do modelo). */
  function defaultFor(fmt: PosterV2Format, m: PosterModel): number[] {
    return fit(fmt, m, photos.slice(0, modelCapacity(fmt, m)).map((_, i) => i));
  }  /** O cartaz em tela é exatamente o salvo deste formato? */
  function sameAsSaved(fmt: PosterV2Format, m: PosterModel, c: Custom): boolean {
    const d = saved[fmt];
    if (!d || d.model !== m || fit(fmt, m, d.order).join(",") !== c.order.join(",")) return false;
    const a = d.framing;
    const b = c.framing;
    return a === b || Boolean(a && b && Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && a.zoom.toFixed(2) === b.zoom.toFixed(2));
  }


  // Tamanho real das fotos (layout e recomendação dependem da orientação e da resolução).
  useEffect(() => {
    photos.forEach((p, i) => {
      const img = new Image();
      img.onload = () =>
        setSizes((s) => ({
          ...s,
          [i]: { width: img.naturalWidth, height: img.naturalHeight },
        }));
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
      const order = (q.get("fotos") ?? "")
        .split(",")
        .filter(Boolean)
        .map(Number)
        .filter((i) => photos[i]);
      const foco = /^(\d{1,3}),(\d{1,3})$/.exec(q.get("foco") ?? "");
      const zoom = Number(q.get("zoom"));
      /* eslint-disable react-hooks/set-state-in-effect -- restaura uma única vez o estado salvo na URL */
      setFormat(fmt);
      if (isPosterModel(m)) {
        setModel(m);
        if (order.length || foco)
          setCustom({
            [`${fmt}-${m}`]: {
              order: order.length ? order : defaultFor(fmt, m),
              framing: foco
                ? {
                    x: Number(foco[1]),
                    y: Number(foco[2]),
                    zoom: zoom >= 1 && zoom <= 3 ? zoom : 1,
                  }
                : null,
            },
          });
        setStep(q.get("passo") === "3" ? 3 : 4);
      } else setStep(2);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    // Abre com os cartazes salvos na conta (a URL, se tiver um ajuste em andamento, prevalece).
    const fromSaved = Object.fromEntries(
      Object.entries(saved).map(([fmt, d]) => [`${fmt}-${d!.model}`, { order: d!.order.length ? d!.order : defaultFor(fmt as PosterV2Format, d!.model), framing: d!.framing }]),
    );
    if (Object.keys(fromSaved).length) setCustom((c) => ({ ...fromSaved, ...c }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na primeira montagem
  }, [photos]);

  const key = format && model ? `${format}-${model}` : "";
  const isEdited = (c: Custom | undefined, fmt = format, m = model) => Boolean(c && fmt && m && (c.framing || c.order.join(",") !== defaultFor(fmt, m).join(",")));
  const inProgress = custom[key];
  const current: Custom =
    format && model ? (inProgress ? { ...inProgress, order: fit(format, model, inProgress.order) } : { order: defaultFor(format, model), framing: null }) : { order: [], framing: null };
  const setCurrent = (c: Custom) => setCustom((all) => ({ ...all, [key]: c }));
  const edited = isEdited(custom[key]);

  const posterUrl = (fmt: PosterV2Format, m: PosterModel, c: Custom | null, download = false) => {
    const q = new URLSearchParams({ modelo: "proposta", estilo: String(m) });
    if (c && c.order.join(",") !== defaultFor(fmt, m).join(",")) q.set("fotos", fit(fmt, m, c.order).join(","));
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
      if (c && c.order.join(",") !== defaultFor(format, model).join(",")) q.set("fotos", fit(format, model, c.order).join(","));
      if (c?.framing) {
        q.set("foco", `${Math.round(c.framing.x)},${Math.round(c.framing.y)}`);
        q.set("zoom", c.framing.zoom.toFixed(2));
      }
    }
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit/defaultFor dependem só das fotos e dos tamanhos
  }, [format, model, step, custom, sizes]);

  // Ajustes de outros formatos/modelos ficam só na memória desta aba: avisa antes de fechá-la.
  const unsaved = Object.entries(custom).some(([k, c]) => {
    const [f, m] = k.split("-");
    return k !== key && isEdited(c, f as PosterV2Format, Number(m) as PosterModel) && !sameAsSaved(f as PosterV2Format, Number(m) as PosterModel, c);
  });
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Ao trocar de etapa, o foco vai para o título dela (teclado e leitor de tela sabem onde
  // estão): quem faz isso é o StepStage, só depois que o tutor navegou.
  const go = (s: Step) => {
    setMoved(true);
    setDirection(s < step ? "back" : "forward");
    setNotice(null);
    setFailed(false);
    setStep(s);
  };

  const ordered = (order: number[]) => order.map((i) => sizes[i]).filter((s): s is { width: number; height: number } => Boolean(s));
  const allLoaded = photos.every((_, i) => sizes[i]);
  const recommended = format && allLoaded ? recommendModel(format, ordered(firstThree)) : null;

  // A etapa 3 só aparece concluída se houve ajuste; sem ajuste, aparece como pulada.
  const states: StepState[] = [1, 2, 3, 4].map((n) => {
    if (n === step) return failed ? "error" : "current";
    if (n > step) return "pending";
    if (n === 3) return edited ? "done" : "skipped";
    return "done";
  });

  const title = (text: string) => (
    <h2 data-step-heading tabIndex={-1} className="text-xl font-bold sm:text-2xl">
      {text}
    </h2>
  );

  return (
    <MotionRoot variant="b" className="flex scroll-mt-20 flex-col gap-6" data-step-flow data-testid="criar-cartaz">
      <MotionSteps steps={STEPS} states={states} onSelect={(i) => go((i + 1) as Step)} label="Etapas do cartaz" variant="b" direction={direction} />

      <StepStage stepKey={`etapa-${step}`} direction={direction} focus={moved}>
      {step === 1 && (
        <section className="flex flex-col gap-4" aria-label="Formato">
          <div className="flex flex-col gap-1">
            {title("Onde você vai usar o cartaz?")}
            <p className="text-text-secondary">Escolha um formato. Depois você pode voltar e criar outro.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FORMATS.map((f) => {
              const selected = format === f;
              const Icon = FORMAT_CARD[f].icon;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (f !== format) setModel(null);
                    setFormat(f);
                    go(2);
                  }}
                  className={`${motionCard} group flex items-center gap-4 rounded-lg border-2 bg-surface p-4 text-left shadow-card hover:border-status-lost-solid ${selected ? "border-status-lost-solid bg-status-lost-soft" : "border-border"}`}
                  data-testid={`formato-${f}`}
                >
                  <FormatThumb format={f} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-lg font-bold">
                      <Icon aria-hidden="true" className="size-5 shrink-0 text-status-lost" />
                      {FORMAT_PURPOSE[f].title}
                    </span>
                    <span className="text-sm text-text-secondary">{FORMAT_CARD[f].where}</span>
                    <span className="text-xs text-text-secondary tabular-nums">
                      {V2_FORMATS[f].width} × {V2_FORMATS[f].height} px
                    </span>
                  </span>
                  {selected && <span className={`${motionBadge} absolute top-2 right-2 rounded-full bg-status-lost-solid px-2 py-0.5 text-xs font-bold text-white`}>Selecionado</span>}
                </button>
              );
            })}
          </div>
          {format && (
            <StepNav>
              <span />
              <button type="button" className={btnPrimary} onClick={() => go(2)}>
                Continuar com {FORMAT_PURPOSE[format].title} <ArrowRight aria-hidden="true" className="size-5" />
              </button>
            </StepNav>
          )}
        </section>
      )}

      {step === 2 && format && (
        <section className="flex flex-col gap-4" aria-label="Modelo">
          <div className="flex flex-col gap-1">
            {title(`Escolha o modelo — ${FORMAT_PURPOSE[format].title}`)}
            <p className="text-text-secondary">As prévias já usam as fotos e os dados do seu alerta. Toque em “Ampliar” para ver o cartaz inteiro.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
            {POSTER_MODEL_IDS.map((m) => {
              const isRec = recommended?.model === m;
              const note = adaptedNote(
                format,
                m,
                ordered(photos.map((_, i) => i)).map((s) => s.width / s.height),
              );
              const src = posterUrl(format, m, custom[`${format}-${m}`] ?? null);
              const wide = format === "landscape";
              return (
                <article
                  key={m}
                  className={`${motionCard} flex flex-col gap-3 rounded-lg border-2 bg-surface p-3 shadow-card ${isRec ? "border-[#f6b928]" : model === m ? "border-status-lost-solid" : "border-transparent"}`}
                  data-testid={`modelo-${m}`}
                  aria-labelledby={`modelo-${m}-nome`}
                >
                  <div className={`flex flex-1 gap-3 md:flex-col ${wide ? "flex-col" : "flex-row"}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomed({
                          src,
                          title: `Modelo ${m} — ${POSTER_MODELS[m].name}`,
                        })
                      }
                      className={`flex shrink-0 items-center justify-center rounded-md bg-surface-muted p-1.5 md:h-64 md:w-full ${wide ? "w-full" : "w-[42%] self-start"}`}
                      aria-label={`Ampliar o Modelo ${m}`}
                    >
                      <PosterImage src={src} alt={`Prévia do Modelo ${m}`} onError={() => setFailed(true)} className="md:max-h-[15rem]" />
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <h3 id={`modelo-${m}-nome`} className="leading-tight font-bold">
                          Modelo {m} — {POSTER_MODELS[m].name}
                        </h3>
                        {isRec && (
                          <span className="inline-flex items-center gap-1 self-start rounded-md bg-[#f6b928] px-2 py-0.5 text-xs font-bold text-[#0a111d]">
                            <Sparkles aria-hidden="true" className="size-3.5" /> Recomendado pela MEL
                          </span>
                        )}
                        <p className="text-sm text-text-secondary">{POSTER_MODELS[m].summary}</p>
                        {isRec && recommended && <p className="text-sm">Por quê: {recommended.reason}</p>}
                        {note && <p className="text-xs text-text-secondary">{note}</p>}
                        {saved[format]?.model === m && (
                        <p className="text-xs font-semibold text-status-found" data-testid={`salvo-${m}`}>
                          ✓ Salvo na sua conta
                        </p>
                      )}
                      {isEdited(custom[`${format}-${m}`], format, m) && saved[format]?.model !== m && <p className="text-xs font-semibold text-status-lost">Com os seus ajustes (guardados nesta página).</p>}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2 md:grid-cols-1">
                    <button
                      type="button"
                      className={`${btnPrimary} px-3 whitespace-nowrap`}
                      onClick={() => {
                        setModel(m);
                        go(3);
                      }}
                    >
                      Escolher este modelo
                    </button>
                    <button
                      type="button"
                      className={`${btnSecondary} px-3 text-sm`}
                      onClick={() =>
                        setZoomed({
                          src,
                          title: `Modelo ${m} — ${POSTER_MODELS[m].name}`,
                        })
                      }
                    >
                      <Maximize2 aria-hidden="true" className="size-4" /> Ampliar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {failed && <RetryNote />}
          <StepNav>
            <button type="button" className={btnSecondary} onClick={() => go(1)}>
              <ArrowLeft aria-hidden="true" className="size-5" /> Voltar
            </button>
            <span className="text-sm text-text-secondary">Você pode trocar de modelo quando quiser.</span>
          </StepNav>
        </section>
      )}

      {step === 3 && format && model && (
        <Customize
          title={title}
          format={format}
          model={model}
          photos={photos}
          sizes={sizes}
          value={current}
          defaultOrder={defaultFor(format, model)}
          fit={(order) => fit(format, model, order)}
          edited={edited}
          onChange={setCurrent}
          previewUrl={posterUrl(format, model, current)}
          onZoom={(src) => setZoomed({ src, title: `Modelo ${model} — prévia personalizada` })}
          onError={() => setFailed(true)}
          onDone={() => go(4)}
          onBack={() => go(2)}
        />
      )}

      {step === 4 && format && model && (
        <section className="flex flex-col gap-4" aria-label="Usar">
          <div className="flex flex-col gap-1">
            {title("Seu cartaz está pronto")}
            <p className="text-text-secondary">
              {FORMAT_PURPOSE[format].title} · Modelo {model} — {POSTER_MODELS[model].name}
              {edited ? " · com os seus ajustes" : ""}
            </p>
          </div>
          {/* No celular as ações vêm antes do cartaz (sem rolar); no desktop, cartaz à esquerda e ações à direita. */}
          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:grid-rows-[auto_1fr] md:gap-x-6">
            <div className="order-2 flex flex-col items-center gap-2 rounded-lg bg-surface-muted p-3 md:order-none md:col-start-1 md:row-span-2 md:row-start-1">
              <button
                type="button"
                onClick={() =>
                  setZoomed({
                    src: posterUrl(format, model, custom[key] ?? null),
                    title: "Cartaz pronto",
                  })
                }
                aria-label="Ampliar o cartaz"
                className="flex max-w-full justify-center"
              >
                <PosterImage
                  src={posterUrl(format, model, custom[key] ?? null)}
                  alt="Cartaz pronto"
                  testId="cartaz-final"
                  onError={() => setFailed(true)}
                  className="max-h-[42vh] max-w-full md:max-h-[68vh]"
                />
              </button>
              <button
                type="button"
                className={btnLink}
                onClick={() =>
                  setZoomed({
                    src: posterUrl(format, model, custom[key] ?? null),
                    title: "Cartaz pronto",
                  })
                }
              >
                <Maximize2 aria-hidden="true" className="size-4" /> Ampliar para conferir os detalhes
              </button>
            </div>
            <div className="order-1 flex flex-col gap-3 md:order-none md:col-start-2 md:row-start-1">
              <div className="grid grid-cols-3 gap-2 md:grid-cols-1" data-testid="acoes-principais">
                <a href={posterUrl(format, model, custom[key] ?? null, true)} className={`${btnPrimary} flex-col gap-1 px-1 text-sm sm:text-[15px] md:flex-row md:gap-2`}>
                  <Download aria-hidden="true" className="size-5" /> Baixar
                </a>
                <a
                  href={`/alerta/${code}/cartaz/imprimir?${new URL(posterUrl(format, model, custom[key] ?? null), "http://x").searchParams.toString()}&formato=${format}`}
                  target="_blank"
                  rel="noopener"
                  className={`${btnSecondary} flex-col gap-1 px-1 text-sm sm:text-[15px] md:flex-row md:gap-2`}
                >
                  <Printer aria-hidden="true" className="size-5" /> Imprimir
                </a>
                <ActionButton
                  state={sharing ? "busy" : "idle"}
                  busyText="Preparando…"
                  doneText=""
                  className={`${btnSecondary} flex-col gap-1 px-1 text-sm sm:text-[15px] md:flex-row md:gap-2`}
                  onClick={async () => {
                    setNotice(null);
                    // Processamento real: o PNG final é buscado antes de abrir o compartilhamento.
                    setSharing(true);
                    try {
                      const blob = await (await fetch(posterUrl(format, model, custom[key] ?? null))).blob();
                      const file = new File([blob], `MEL-cartaz-${format}-modelo-${model}.png`, { type: "image/png" });
                      if (navigator.canShare?.({ files: [file] })) {
                        await navigator.share({
                          files: [file],
                          text: `Ajude a encontrar: ${alertUrl}`,
                        });
                        return;
                      }
                      window.location.href = posterUrl(format, model, custom[key] ?? null, true);
                      await navigator.clipboard?.writeText(alertUrl).catch(() => undefined);
                      setNotice("Este navegador não compartilha imagens: baixamos o cartaz e copiamos o link do alerta.");
                    } catch (err) {
                      if ((err as Error).name !== "AbortError") setNotice("Não deu para compartilhar agora. Use Baixar ou copie o link do alerta.");
                    } finally {
                      setSharing(false);
                    }
                  }}
                >
                  <Share2 aria-hidden="true" className="size-5" /> Compartilhar
                </ActionButton>
              </div>
              {format === "impressao" && <p className="text-sm text-text-secondary">Imprimir abre o A4 em tamanho real, sem margens, numa nova aba.</p>}
              {notice && (
                <p role="status" className="rounded-md bg-surface-muted p-3 text-sm font-medium">
                  {notice}
                </p>
              )}
              {failed && <RetryNote />}
              {isOwner && (
                <SaveBox
                  saved={Boolean(saved[format])}
                  current={sameAsSaved(format, model, current)}
                  saving={saving}
                  onSave={async () => {
                    const ids = current.order.map((i) => photos[i]?.id);
                    if (ids.some((id) => !id)) return setNotice("Não deu para salvar agora: recarregue a página e tente de novo.");
                    setSaving(true);
                    setNotice(null);
                    try {
                      await savePosterDesign(getBrowserClient(), code, { format, model, photoIds: ids as string[], framing: current.framing });
                      setSaved((all) => ({ ...all, [format]: { model, order: current.order, framing: current.framing } }));
                      setNotice("Cartaz salvo na sua conta. Ele abre assim em qualquer aparelho.");
                    } catch (err) {
                      setNotice((err as Error).message || "Não deu para salvar agora. Tente de novo.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  onRemove={async () => {
                    setSaving(true);
                    setNotice(null);
                    try {
                      await resetPosterDesign(getBrowserClient(), code, format);
                      setSaved((all) => {
                        const next = { ...all };
                        delete next[format];
                        return next;
                      });
                      setNotice("O cartaz salvo deste formato foi removido. Os outros formatos continuam salvos.");
                    } catch (err) {
                      setNotice((err as Error).message || "Não deu para remover agora. Tente de novo.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
              )}
            </div>
            <div className="order-3 flex flex-col border-t border-border pt-3 md:order-none md:col-start-2 md:row-start-2">
              <p className="text-sm font-semibold text-text-secondary">Mais opções</p>
              <button type="button" className={btnLink} onClick={() => go(3)}>
                <SlidersHorizontal aria-hidden="true" className="size-4" /> Personalizar novamente
              </button>
              <button type="button" className={btnLink} onClick={() => go(2)}>
                <LayoutGrid aria-hidden="true" className="size-4" /> Trocar modelo
              </button>
              <button type="button" className={btnLink} onClick={() => go(1)}>
                <Proportions aria-hidden="true" className="size-4" /> Escolher outro formato
              </button>
              <button
                type="button"
                className={btnLink}
                onClick={async () => {
                  await navigator.clipboard?.writeText(alertUrl).catch(() => undefined);
                  setNotice("Link do alerta copiado.");
                }}
              >
                <Link2 aria-hidden="true" className="size-4" /> Copiar link do alerta
              </button>
            </div>
          </div>
        </section>
      )}
      </StepStage>

      {zoomed && <PosterZoom src={zoomed.src} title={zoomed.title} onClose={() => setZoomed(null)} />}
    </MotionRoot>
  );
}

/** Salvar na conta (só o tutor): estado claro do que está salvo e do que mudou. */
function SaveBox({ saved, current, saving, onSave, onRemove }: { saved: boolean; current: boolean; saving: boolean; onSave: () => void; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3" data-testid="salvar-cartaz">
      <p className={`text-sm ${current ? "font-semibold text-status-found" : "text-text-secondary"}`} data-testid="salvar-estado">
        {current
          ? "✓ Este é o cartaz salvo na sua conta para este formato."
          : saved
            ? "Você mudou o cartaz salvo deste formato. Salve para guardar a nova versão."
            : "Salve para encontrar este cartaz pronto em qualquer aparelho."}
      </p>
      <button type="button" className={btnSecondary} onClick={onSave} disabled={current || saving} aria-busy={saving || undefined}>
        <Save aria-hidden="true" className="size-5" /> {saving ? "Salvando…" : current ? "Salvo" : "Salvar na minha conta"}
      </button>
      {saved && (
        <button type="button" className={`${btnLink} self-start`} onClick={onRemove} disabled={saving}>
          Remover o cartaz salvo deste formato
        </button>
      )}
    </div>
  );
}

/** Barra de navegação da etapa: fica presa ao rodapé da tela enquanto se rola a etapa. */
function StepNav({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 sm:static flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:rounded-lg sm:border sm:px-3">
      {children}
    </div>
  );
}

function RetryNote() {
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-danger bg-status-lost-soft p-3 text-sm font-medium text-danger">
      Não foi possível gerar uma das prévias.
      <button type="button" className="min-h-11 font-bold underline" onClick={() => window.location.reload()}>
        Tentar de novo
      </button>
    </p>
  );
}

/** Quando o modelo se adapta às fotos que existem (para o tutor não estranhar a prévia). */
function adaptedNote(format: PosterV2Format, m: PosterModel, aspects: number[]): string | null {
  if (!aspects.length) return "Sem fotos: aparece o espaço “Sem foto”. Cadastre fotos para um cartaz melhor.";
  const cap = modelCapacity(format, m);
  const l = modelLayout(format, m, aspects.slice(0, cap));
  const wanted = Math.min(cap, aspects.length);
  if (m === 4 && l.card) return "Com 1 foto, o espaço ao lado dela mostra as características.";
  if (m === 2 && aspects.length === 1) return "Seu pet tem 1 foto: o espaço das complementares mostra “Como reconhecer”.";
  if (l.card) return "O espaço que sobraria mostra “Como reconhecer”.";
  if (m !== 1 && l.used < wanted) return `Mostra ${l.used} de ${wanted} fotos para nenhuma ficar pequena demais.`;
  if (m === 4) return "O telefone só aparece se você autorizou publicá-lo no alerta.";
  return null;
}

/** Imagem gerada na hora: inteira (sem recorte), mostra "Gerando…" até carregar e avisa se falhar. */
function PosterImage({ src, alt, testId, className = "", onError }: { src: string; alt: string; testId?: string; className?: string; onError?: () => void }) {
  const [state, setState] = useState<{ src: string; ok: boolean } | null>(null);
  return (
    <span className="relative flex w-full justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setState({ src, ok: true })}
        onError={() => {
          setState({ src, ok: false });
          onError?.();
        }}
        className={`block h-auto w-auto max-w-full rounded-sm border border-border object-contain ${className}`}
        data-testid={testId}
      />
      {state?.src !== src && <span className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/35 text-sm font-semibold text-white">Gerando…</span>}
    </span>
  );
}

/** Cartaz ampliado: cabe na tela ou em tamanho real (rolando dentro da janela). Esc fecha. */
function PosterZoom({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [actual, setActual] = useState(false);
  // Sem close() na limpeza: o evento "close" desmontaria a janela recém-aberta (StrictMode).
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-black/90 p-0 backdrop:bg-black/80"
      data-testid="cartaz-ampliado"
    >
      <div className="flex h-full flex-col gap-2 p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
          <p className="truncate text-sm font-bold">{title}</p>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className={`${btn} min-h-11 px-3 text-sm`} onClick={() => setActual((a) => !a)} aria-pressed={actual}>
              {actual ? "Caber na tela" : "Tamanho real"}
            </button>
            <button type="button" className={`${btn} min-h-11 px-3`} onClick={onClose} aria-label="Fechar" autoFocus>
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
        <div
          className={`min-h-0 flex-1 rounded-md ${actual ? "overflow-auto" : "flex items-center justify-center overflow-hidden"}`}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={title} className={actual ? "max-w-none" : "max-h-full max-w-full object-contain"} />
        </div>
      </div>
    </dialog>
  );
}

/** Miniatura do formato na proporção real, com o esboço de um cartaz (faixa, foto e texto). */
function FormatThumb({ format }: { format: PosterV2Format }) {
  const { width, height } = V2_FORMATS[format];
  const s = 76 / Math.max(width, height);
  const wide = width > height;
  return (
    <span className="flex size-20 shrink-0 items-center justify-center" aria-hidden="true">
      <span
        className="flex overflow-hidden rounded-[3px] border border-border-strong bg-white shadow-xs"
        style={{
          width: Math.round(width * s),
          height: Math.round(height * s),
          flexDirection: wide ? "row" : "column",
        }}
      >
        {wide ? (
          <>
            <span className="flex w-[45%] flex-col justify-center gap-1 p-1">
              <span className="h-1.5 rounded-[1px] bg-[#c22a31]" />
              <span className="h-1 w-4/5 rounded-[1px] bg-[#1d2b44]" />
              <span className="h-1 w-3/5 rounded-[1px] bg-[#9aa3b2]" />
            </span>
            <span className="flex flex-1 items-center justify-center bg-[#d9c3a0]">
              <PawPrint className="size-4 text-[#7a5a2e]" />
            </span>
          </>
        ) : (
          <>
            <span className="h-[14%] shrink-0 bg-[#c22a31]" />
            <span className="flex flex-1 items-center justify-center bg-[#d9c3a0]">
              <PawPrint className="size-4 text-[#7a5a2e]" />
            </span>
            <span className="flex h-[24%] shrink-0 flex-col justify-center gap-0.5 bg-[#1d2b44] px-1">
              <span className="h-1 w-3/5 rounded-[1px] bg-white" />
              <span className="h-0.5 w-4/5 rounded-[1px] bg-[#9aa3b2]" />
            </span>
          </>
        )}
      </span>
    </span>
  );
}

/** Passo 3 (opcional): trocar fotos, reordenar, arrastar e aproximar a principal; prévia fiel ao arquivo final. */
function Customize({
  title,
  format,
  model,
  photos,
  sizes,
  value,
  defaultOrder,
  fit,
  edited,
  onChange,
  previewUrl,
  onZoom,
  onError,
  onDone,
  onBack,
}: {
  title: (text: string) => React.ReactNode;
  format: PosterV2Format;
  model: PosterModel;
  photos: { url: string }[];
  sizes: Record<number, { width: number; height: number }>;
  value: Custom;
  defaultOrder: number[];
  /** Corta a ordem para as fotos que o modelo consegue mostrar. */
  fit: (order: number[]) => number[];
  edited: boolean;
  onChange: (c: Custom) => void;
  previewUrl: string;
  onZoom: (src: string) => void;
  onError: () => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const { order } = value;
  const framing = value.framing ?? { x: 50, y: 50, zoom: 1 };
  const main = order[0];
  const aspects = order.map((i) => (sizes[i] ? sizes[i].width / sizes[i].height : undefined));
  const box = aspects.every((a) => a !== undefined) && order.length ? modelLayout(format, model, aspects as number[]).boxes[0]! : null;
  const setFraming = (f: Framing) =>
    onChange({
      order,
      framing: {
        x: clamp(f.x, 0, 100),
        y: clamp(f.y, 0, 100),
        zoom: clamp(f.zoom, 1, 3),
      },
    });
  const [undo, setUndo] = useState<Custom | null>(null);

  const [preview, setPreview] = useState(previewUrl);
  useEffect(() => {
    const t = setTimeout(() => setPreview(previewUrl), 350);
    return () => clearTimeout(t);
  }, [previewUrl]);

  // Arrastar (mouse e toque), pinça, roda do mouse e setas do teclado.
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
      pinch.current = {
        dist: Math.hypot(p!.x - q!.x, p!.y - q!.y),
        zoom: framing.zoom,
      };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [p, q] = [...pointers.current.values()];
      setFraming({
        ...framing,
        zoom: pinch.current.zoom * (Math.hypot(p!.x - q!.x, p!.y - q!.y) / pinch.current.dist),
      });
      return;
    }
    const g = geometry();
    if (!g || !box || !frameRef.current) return;
    const k = frameRef.current.clientWidth / box.width;
    setFraming({
      ...framing,
      x: framing.x - ((e.clientX - prev.x) / (g.rw * k)) * 100,
      y: framing.y - ((e.clientY - prev.y) / (g.rh * k)) * 100,
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = {
      ArrowLeft: [-3, 0],
      ArrowRight: [3, 0],
      ArrowUp: [0, -3],
      ArrowDown: [0, 3],
    }[e.key];
    if (d) setFraming({ ...framing, x: framing.x + d[0]!, y: framing.y + d[1]! });
    else if (e.key === "+" || e.key === "=") setFraming({ ...framing, zoom: framing.zoom + 0.1 });
    else if (e.key === "-") setFraming({ ...framing, zoom: framing.zoom - 0.1 });
    else return;
    e.preventDefault();
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

  // A seleção fica limitada ao que o modelo mostra: uma foto que não caberia não pode ser marcada.
  const max = modelCapacity(format, model);
  const extras = order.slice(1);
  const [dropped, setDropped] = useState<string | null>(null);
  const canAdd = (i: number) => order.length < max && fit([...order, i]).length === order.length + 1;
  const toggle = (i: number) => {
    setDropped(null);
    if (order.includes(i)) onChange({ order: order.filter((x) => x !== i), framing: value.framing });
    else if (canAdd(i)) onChange({ order: [...order, i], framing: value.framing });
  };
  const makeMain = (i: number) => {
    const next = [i, ...order.filter((x) => x !== i)].slice(0, max);
    const fitted = fit(next);
    const out = next.filter((x) => !fitted.includes(x));
    const many = out.length > 1;
    setDropped(
      out.length
        ? `${many ? "As fotos" : "A foto"} ${out.map((x) => x + 1).join(" e ")} ${many ? "saíram" : "saiu"} das complementares: com a nova principal, não ${many ? "cabem" : "cabe"} neste modelo.`
        : null,
    );
    onChange({ order: fitted, framing: null });
  };
  const move = (pos: number, dir: -1 | 1) => {
    const n = [...order];
    const j = pos + dir;
    if (j < 1 || j >= n.length) return;
    [n[pos], n[j]] = [n[j]!, n[pos]!];
    onChange({ order: n, framing: value.framing });
  };
  const restore = () => {
    setUndo(value);
    onChange({ order: defaultOrder, framing: null });
  };
  const thumb = "aspect-square w-full rounded object-cover";

  return (
    <section className="flex flex-col gap-4" aria-label="Personalizar">
      <div className="flex flex-col gap-1">
        {title(`Personalizar — Modelo ${model}`)}
        <p className="text-text-secondary">
          Opcional: se o cartaz já está bom, toque em “Pular personalização”. Os ajustes valem só para {FORMAT_PURPOSE[format].title}, Modelo {model}; as fotos originais, a capa, a
          descrição e a ordem do cadastro não mudam.
        </p>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] md:gap-6">
        <div className="flex min-w-0 flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-bold">1. Foto principal</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photos.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={main === i}
                  aria-label={`Usar a foto ${i + 1} como principal`}
                  onClick={() => main !== i && makeMain(i)}
                  className={`${motionCard} rounded-md border-2 p-0.5 ${main === i ? "border-status-lost-solid" : "border-transparent hover:border-border-strong"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className={thumb} />
                  {main === i && (
                    <span className={`${motionBadge} absolute inset-x-0.5 bottom-0.5 rounded-b bg-status-lost-solid py-0.5 text-center text-[11px] font-bold text-white`}>Principal</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          {max > 1 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-bold">2. Fotos complementares (até {max - 1})</legend>
              <p className="text-sm text-text-secondary" data-testid="capacidade">
                Neste formato, o Modelo {model} mostra até {max} fotos: a principal e até {max - 1} complementares. Toque para incluir ou tirar; a ordem define a posição no
                cartaz. “Não cabe” quer dizer que, com as fotos já escolhidas, essa ficaria estreita demais.
              </p>
              {dropped && (
                <p role="status" className="text-sm font-semibold text-status-lost">
                  {dropped}
                </p>
              )}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {photos.map((p, i) => {
                  if (i === main) return null;
                  const pos = extras.indexOf(i);
                  const full = pos < 0 && order.length >= max;
                  const noRoom = pos < 0 && !full && !canAdd(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={pos >= 0}
                      aria-label={
                        pos >= 0
                          ? `Tirar a foto ${i + 1} (complementar ${pos + 1})`
                          : noRoom
                            ? `Foto ${i + 1}: não cabe neste modelo`
                            : full
                              ? `Foto ${i + 1}: limite de fotos`
                              : `Incluir a foto ${i + 1}`
                      }
                      disabled={full || noRoom}
                      onClick={() => toggle(i)}
                      className={`${motionCard} group rounded-md border-2 p-0.5 disabled:cursor-not-allowed ${pos >= 0 ? "border-[#f6b928]" : "border-transparent hover:border-border-strong"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className={`${thumb} group-disabled:opacity-35`} />
                      <span
                        key={pos >= 0 ? `on-${pos}` : "off"}
                        className={`absolute top-1 right-1 flex size-6 items-center justify-center rounded-full text-xs font-bold ${pos >= 0 ? `${motionBadge} bg-[#f6b928] text-[#0a111d]` : "border-2 border-white bg-black/40"}`}
                      >
                        {pos >= 0 ? pos + 1 : ""}
                      </span>
                      {(noRoom || full) && (
                        <span className="absolute inset-x-0.5 bottom-0.5 rounded-b bg-black/75 py-0.5 text-center text-[11px] font-bold text-white">{noRoom ? "Não cabe" : "Limite"}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {extras.length > 1 && (
                <ol className="flex flex-col gap-1">
                  {extras.map((i, k) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-36 font-medium">
                        Complementar {k + 1}: foto {i + 1}
                      </span>
                      <button
                        type="button"
                        className={`${btnSecondary} min-h-11 px-3`}
                        aria-label={`Mover a foto ${i + 1} para antes`}
                        disabled={k === 0}
                        onClick={() => move(k + 1, -1)}
                      >
                        <ChevronLeft aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        type="button"
                        className={`${btnSecondary} min-h-11 px-3`}
                        aria-label={`Mover a foto ${i + 1} para depois`}
                        disabled={k === extras.length - 1}
                        onClick={() => move(k + 1, 1)}
                      >
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </fieldset>
          ) : (
            <p className="text-sm text-text-secondary">O Modelo 1 usa só a foto principal, em destaque.</p>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-bold">{max > 1 ? "3" : "2"}. Enquadrar a foto principal</legend>
            <p className="text-sm text-text-secondary">Arraste a foto (ou use as setas do teclado) e aproxime com o controle, com dois dedos ou com a roda do mouse.</p>
            <div
              ref={frameRef}
              role="group"
              tabIndex={0}
              aria-label="Enquadramento da foto principal: setas movem, + e − aproximam"
              className="relative mx-auto w-full touch-none overflow-hidden rounded-md bg-[#1d2b44] select-none"
              style={{
                aspectRatio: box ? `${box.width} / ${box.height}` : "4 / 3",
                cursor: "grab",
                maxHeight: 360,
                maxWidth: box ? `${(360 * box.width) / box.height}px` : undefined,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={(e) =>
                setFraming({
                  ...framing,
                  zoom: framing.zoom - e.deltaY * 0.002,
                })
              }
              onKeyDown={onKeyDown}
              data-testid="editor-moldura"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {imgStyle && main !== undefined && <img src={photos[main]!.url} alt="Foto principal no enquadramento" style={imgStyle} draggable={false} />}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${btnSecondary} min-h-11 px-3`}
                aria-label="Afastar"
                onClick={() => setFraming({ ...framing, zoom: framing.zoom - 0.25 })}
                disabled={framing.zoom <= 1}
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <label className="flex flex-1 items-center gap-2 text-sm font-semibold">
                <span className="sr-only">Aproximar</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={framing.zoom}
                  onChange={(e) => setFraming({ ...framing, zoom: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-[#c22a31]"
                />
                <span className="w-10 text-right tabular-nums">{framing.zoom.toFixed(1)}×</span>
              </label>
              <button
                type="button"
                className={`${btnSecondary} min-h-11 px-3`}
                aria-label="Aproximar mais"
                onClick={() => setFraming({ ...framing, zoom: framing.zoom + 0.25 })}
                disabled={framing.zoom >= 3}
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${btnSecondary} min-h-11 text-sm`} onClick={restore} disabled={!edited}>
              <RotateCcw aria-hidden="true" className="size-4" /> Restaurar o modelo original
            </button>
            {undo && (
              <p role="status" className="flex items-center gap-2 text-sm">
                Ajustes desfeitos.
                <button
                  type="button"
                  className="min-h-11 font-bold text-link underline"
                  onClick={() => {
                    onChange(undo);
                    setUndo(null);
                  }}
                >
                  Desfazer
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-lg bg-surface-muted p-3 md:sticky md:top-4">
          <h3 className="self-start font-bold">Resultado</h3>
          <button type="button" onClick={() => onZoom(preview)} aria-label="Ampliar a prévia" className="flex max-w-full justify-center">
            <PosterImage src={preview} alt="Prévia do cartaz personalizado" testId="editor-previa" onError={onError} className="max-h-[50vh] max-w-full md:max-h-[62vh]" />
          </button>
          <button type="button" className={btnLink} onClick={() => onZoom(preview)}>
            <Maximize2 aria-hidden="true" className="size-4" /> Ampliar
          </button>
        </div>
      </div>

      <StepNav>
        <button type="button" className={btnSecondary} onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="size-5" /> Voltar
        </button>
        {edited ? (
          <button type="button" className={btnPrimary} onClick={onDone}>
            Continuar <ArrowRight aria-hidden="true" className="size-5" />
          </button>
        ) : (
          <button type="button" className={`${btnPrimary} whitespace-nowrap`} onClick={onDone}>
            Pular personalização <SkipForward aria-hidden="true" className="hidden size-5 sm:block" />
          </button>
        )}
      </StepNav>
    </section>
  );
}
