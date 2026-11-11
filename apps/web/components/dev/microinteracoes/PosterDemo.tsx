"use client";

import { ArrowLeft, ArrowRight, Download, LayoutGrid, Printer, Proportions, RectangleHorizontal, RectangleVertical, Send, SkipForward, SlidersHorizontal, Smartphone, Square, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ActionButton, motionBadge, motionCard, StepStage, useStepFlow } from "@/components/motion/Motion";
import { MotionSteps, type MotionVariant } from "@/components/motion/MotionSteps";
import type { StepState } from "@/components/ui/StepIndicator";
import { FORMAT_PURPOSE, modelCapacity, POSTER_MODEL_IDS, POSTER_MODELS, type PosterModel } from "@/lib/poster/models";
import { V2_FORMATS, type PosterV2Format } from "@/lib/poster/PosterV2";

/**
 * PROTÓTIPO (DEV) do "Criar cartaz" com movimento. As quatro etapas, os cinco formatos, os
 * quatro modelos e o limite de fotos por modelo vêm do código real; as prévias são o gerador
 * real com o caso FICTÍCIO do protótipo da bonificação (nenhum pet, foto ou alerta real).
 * As fotos são ilustrações de exemplo geradas aqui. Nada é salvo.
 */

const STEPS: { label: string; icon: LucideIcon }[] = [
  { label: "Formato", icon: Proportions },
  { label: "Modelo", icon: LayoutGrid },
  { label: "Personalizar", icon: SlidersHorizontal },
  { label: "Usar", icon: Send },
];

const FORMATS: { id: PosterV2Format; icon: LucideIcon; where: string }[] = [
  { id: "impressao", icon: Printer, where: "Imprimir e colar em postes, comércios e murais." },
  { id: "square", icon: Square, where: "Grupos de WhatsApp, Facebook e feed do Instagram." },
  { id: "portrait", icon: RectangleVertical, where: "Feed do Instagram e Facebook." },
  { id: "story", icon: Smartphone, where: "Stories e Status, em tela cheia." },
  { id: "landscape", icon: RectangleHorizontal, where: "Links e publicações largas." },
];

// Fotos de exemplo: ilustrações (sem animal nem pessoa reais), com orientações variadas.
const DEMO_PHOTOS = [
  { w: 4, h: 3, hue: 28 },
  { w: 3, h: 4, hue: 200 },
  { w: 1, h: 1, hue: 140 },
  { w: 4, h: 3, hue: 330 },
  { w: 3, h: 4, hue: 260 },
  { w: 4, h: 3, hue: 90 },
].map((p, i) => ({
  ...p,
  url: `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w * 40} ${p.h * 40}"><rect width="100%" height="100%" fill="hsl(${p.hue} 45% 42%)"/><circle cx="50%" cy="45%" r="${Math.min(p.w, p.h) * 11}" fill="hsl(${p.hue} 60% 78%)"/><text x="50%" y="45%" dy="0.35em" font-family="sans-serif" font-size="${Math.min(p.w, p.h) * 12}" font-weight="800" fill="hsl(${p.hue} 45% 30%)" text-anchor="middle">${i + 1}</text></svg>`,
  )}`,
}));

const preview = (format: PosterV2Format, model: PosterModel) => `/dev/bonificacao/cartaz/${format}?estilo=${model}`;

const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 font-semibold transition-[background-color,filter,transform] duration-200 ease-mel active:scale-[.985]";
const btnPrimary = `${btn} bg-status-lost-solid text-white hover:brightness-110 disabled:opacity-60`;
const btnSecondary = `${btn} border border-border-strong bg-surface-elevated text-text-primary hover:bg-surface-muted`;
const btnLink = "inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-link underline-offset-4 hover:underline";

export function PosterDemo({ variant }: { variant: MotionVariant }) {
  const flow = useStepFlow(4);
  const [format, setFormat] = useState<PosterV2Format | null>(null);
  const [model, setModel] = useState<PosterModel | null>(null);
  // Ordem escolhida (principal primeiro); null = a do modelo (sem ajuste).
  const [order, setOrder] = useState<number[] | null>(null);
  const [download, setDownload] = useState<"idle" | "busy" | "done">("idle");
  const [notice, setNotice] = useState<string | null>(null);

  const max = format && model ? modelCapacity(format, model) : 1;
  const defaultOrder = DEMO_PHOTOS.slice(0, max).map((_, i) => i);
  const current = order ?? defaultOrder;
  const edited = order !== null && order.join(",") !== defaultOrder.join(",");

  // Mesma regra do fluxo real: Personalizar só conta como concluída se houve ajuste.
  const states: StepState[] = [0, 1, 2, 3].map((i) => {
    if (i === flow.index) return "current";
    if (i > flow.index) return "pending";
    if (i === 2) return edited ? "done" : "skipped";
    return "done";
  });

  const go = (i: number) => {
    setNotice(null);
    setDownload("idle");
    flow.go(i);
  };

  const heading = (text: string) => (
    <h3 data-step-heading tabIndex={-1} className="text-xl font-bold">
      {text}
    </h3>
  );

  let body: React.ReactNode = null;
  if (flow.index === 0)
    body = (
      <section className="flex flex-col gap-4" aria-label="Formato">
        <div className="flex flex-col gap-1">
          {heading("Onde você vai usar o cartaz?")}
          <p className="text-text-secondary">Escolha um formato. Depois você pode voltar e criar outro.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map(({ id, icon: Icon, where }) => {
            const selected = format === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (id !== format) {
                    setModel(null);
                    setOrder(null);
                  }
                  setFormat(id);
                  go(1);
                }}
                className={`${motionCard} flex items-center gap-4 rounded-lg border-2 bg-surface p-4 text-left shadow-card hover:border-status-lost-solid ${selected ? "border-status-lost-solid bg-status-lost-soft" : "border-border"}`}
              >
                <Icon aria-hidden="true" className="size-6 shrink-0 text-status-lost" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-lg font-bold">{FORMAT_PURPOSE[id].title}</span>
                  <span className="text-sm text-text-secondary">{where}</span>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {V2_FORMATS[id].width} × {V2_FORMATS[id].height} px
                  </span>
                </span>
                {selected && <span className={`${motionBadge} absolute top-2 right-2 rounded-full bg-status-lost-solid px-2 py-0.5 text-xs font-bold text-white`}>Selecionado</span>}
              </button>
            );
          })}
        </div>
      </section>
    );

  if (flow.index === 1 && format)
    body = (
      <section className="flex flex-col gap-4" aria-label="Modelo">
        <div className="flex flex-col gap-1">
          {heading(`Escolha o modelo — ${FORMAT_PURPOSE[format].title}`)}
          <p className="text-text-secondary">Prévias do gerador real com um caso fictício (sem fotos).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {POSTER_MODEL_IDS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={model === m}
              onClick={() => {
                if (m !== model) setOrder(null);
                setModel(m);
                go(2);
              }}
              className={`${motionCard} flex flex-col gap-2 rounded-lg border-2 bg-surface p-3 text-left shadow-card hover:border-status-lost-solid ${model === m ? "border-status-lost-solid" : "border-transparent"}`}
            >
              <span className="flex h-40 items-center justify-center rounded-md bg-surface-muted p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview(format, m)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
              </span>
              <span className="leading-tight font-bold">
                Modelo {m} — {POSTER_MODELS[m].name}
              </span>
              <span className="text-xs text-text-secondary">Mostra até {modelCapacity(format, m)} foto(s)</span>
              {model === m && <span className={`${motionBadge} self-start rounded-full bg-status-lost-solid px-2 py-0.5 text-xs font-bold text-white`}>Escolhido</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button type="button" className={btnSecondary} onClick={() => go(0)}>
            <ArrowLeft aria-hidden="true" className="size-5" /> Voltar
          </button>
        </div>
      </section>
    );

  if (flow.index === 2 && format && model) {
    const main = current[0]!;
    const extras = current.slice(1);
    body = (
      <section className="flex flex-col gap-4" aria-label="Personalizar">
        <div className="flex flex-col gap-1">
          {heading(`Personalizar — Modelo ${model}`)}
          <p className="text-text-secondary">Opcional. Neste formato o Modelo {model} mostra até {max} foto(s).</p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">1. Foto principal</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {DEMO_PHOTOS.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={main === i}
                aria-label={`Usar a foto ${i + 1} como principal`}
                onClick={() => main !== i && setOrder([i, ...current.filter((x) => x !== i)].slice(0, max))}
                className={`${motionCard} rounded-md border-2 p-0.5 ${main === i ? "border-status-lost-solid" : "border-transparent hover:border-border-strong"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="aspect-square w-full rounded object-cover" />
                {main === i && <span className={`${motionBadge} absolute inset-x-0.5 bottom-0.5 rounded-b bg-status-lost-solid py-0.5 text-center text-[11px] font-bold text-white`}>Principal</span>}
              </button>
            ))}
          </div>
        </fieldset>
        {max > 1 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-bold">2. Fotos complementares (até {max - 1})</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {DEMO_PHOTOS.map((p, i) => {
                if (i === main) return null;
                const pos = extras.indexOf(i);
                const full = pos < 0 && current.length >= max;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={pos >= 0}
                    aria-label={pos >= 0 ? `Tirar a foto ${i + 1}` : full ? `Foto ${i + 1}: limite de fotos` : `Incluir a foto ${i + 1}`}
                    disabled={full}
                    onClick={() => setOrder(pos >= 0 ? current.filter((x) => x !== i) : [...current, i])}
                    className={`${motionCard} group rounded-md border-2 p-0.5 disabled:cursor-not-allowed ${pos >= 0 ? "border-[#f6b928]" : "border-transparent hover:border-border-strong"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="aspect-square w-full rounded object-cover group-disabled:opacity-35" />
                    <span
                      key={pos >= 0 ? `on-${pos}` : "off"}
                      className={`absolute top-1 right-1 flex size-6 items-center justify-center rounded-full text-xs font-bold ${pos >= 0 ? `${motionBadge} bg-[#f6b928] text-[#0a111d]` : "border-2 border-white bg-black/40"}`}
                    >
                      {pos >= 0 ? pos + 1 : ""}
                    </span>
                    {full && <span className="absolute inset-x-0.5 bottom-0.5 rounded-b bg-black/75 py-0.5 text-center text-[11px] font-bold text-white">Limite</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-text-secondary">O Modelo 1 usa só a foto principal.</p>
        )}
        {edited && (
          <button type="button" className={`${btnLink} self-start`} onClick={() => setOrder(null)}>
            Restaurar o modelo original
          </button>
        )}
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className={btnSecondary} onClick={() => go(1)}>
            <ArrowLeft aria-hidden="true" className="size-5" /> Voltar
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {!edited && (
              <button type="button" className={btnSecondary} onClick={() => go(3)}>
                Pular personalização <SkipForward aria-hidden="true" className="size-5" />
              </button>
            )}
            <button type="button" className={btnPrimary} onClick={() => go(3)}>
              {edited ? "Usar este cartaz" : "Continuar"} <ArrowRight aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (flow.index === 3 && format && model)
    body = (
      <section className="flex flex-col gap-4" aria-label="Usar">
        <div className="flex flex-col gap-1">
          {heading("Seu cartaz está pronto")}
          <p className="text-text-secondary">
            {FORMAT_PURPOSE[format].title} · Modelo {model} — {POSTER_MODELS[model].name}
            {edited ? " · com os seus ajustes" : ""}
          </p>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <div className="order-2 flex justify-center rounded-lg bg-surface-muted p-3 md:order-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview(format, model)} alt="Cartaz de exemplo (caso fictício)" className="max-h-[40vh] max-w-full object-contain md:max-h-[56vh]" />
          </div>
          <div className="order-1 flex flex-col gap-3 md:order-none">
            <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
              <ActionButton
                state={download}
                busyText="Gerando…"
                doneText="Baixado"
                className={`${btnPrimary} flex-col gap-1 px-1 text-sm md:flex-row`}
                onClick={async () => {
                  // Processamento real: o PNG do gerador é buscado e baixado (caso fictício).
                  setDownload("busy");
                  setNotice(null);
                  try {
                    const blob = await (await fetch(preview(format, model))).blob();
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `MEL-exemplo-${format}-modelo-${model}.png`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                    setDownload("done");
                  } catch {
                    setDownload("idle");
                    setNotice("Não deu para gerar agora. Tente de novo.");
                  }
                }}
              >
                <Download aria-hidden="true" className="size-5" /> Baixar
              </ActionButton>
              <button type="button" className={`${btnSecondary} flex-col gap-1 px-1 text-sm md:flex-row`} onClick={() => setNotice("Demonstração: no fluxo real, abre o A4 em tamanho real numa nova aba.")}>
                <Printer aria-hidden="true" className="size-5" /> Imprimir
              </button>
              <button type="button" className={`${btnSecondary} flex-col gap-1 px-1 text-sm md:flex-row`} onClick={() => setNotice("Demonstração: no fluxo real, abre o compartilhamento do aparelho.")}>
                <Send aria-hidden="true" className="size-5" /> Compartilhar
              </button>
            </div>
            {notice && (
              <p role="status" className="rounded-md bg-surface-muted p-3 text-sm font-medium">
                {notice}
              </p>
            )}
            <div className="flex flex-col border-t border-border pt-3">
              <p className="text-sm font-semibold text-text-secondary">Mais opções</p>
              <button type="button" className={btnLink} onClick={() => go(2)}>
                <SlidersHorizontal aria-hidden="true" className="size-4" /> Personalizar novamente
              </button>
              <button type="button" className={btnLink} onClick={() => go(1)}>
                <LayoutGrid aria-hidden="true" className="size-4" /> Trocar modelo
              </button>
              <button type="button" className={btnLink} onClick={() => go(0)}>
                <Proportions aria-hidden="true" className="size-4" /> Escolher outro formato
              </button>
            </div>
          </div>
        </div>
      </section>
    );

  return (
    <div className="flex scroll-mt-20 flex-col gap-6" data-step-flow>
      <MotionSteps steps={STEPS} states={states} onSelect={go} label="Etapas do cartaz (demonstração)" variant={variant} direction={flow.direction} />
      <StepStage stepKey={`p-${flow.index}`} direction={flow.direction}>
        {body}
      </StepStage>
    </div>
  );
}
