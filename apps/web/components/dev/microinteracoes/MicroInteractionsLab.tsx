"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { MotionRoot } from "@/components/motion/Motion";
import type { MotionVariant } from "@/components/motion/MotionSteps";
import { LostDemo } from "./LostDemo";
import { PosterDemo } from "./PosterDemo";

type Flow = "cartaz" | "perdi";

const VARIANTS: Record<MotionVariant, { title: string; summary: string }> = {
  a: {
    title: "Opção A — Progressão elegante",
    summary: "Evolução do indicador atual: conector que se preenche, ícone que vira ✓ desenhado, halo discreto na etapa atual, conteúdo cruzando com um movimento curto.",
  },
  b: {
    title: "Opção B — Progressão dinâmica",
    summary: "Destaque que desliza até a etapa ativa, trilha contínua com marcador na ponta, etapa alcançada com leve “pop”, conteúdo deslizando no sentido do avanço ou do retorno.",
  },
};

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-semibold text-text-secondary">{label}</legend>
      <div className="flex rounded-lg border border-border-strong bg-surface p-1 sm:inline-flex">
        {options.map(([v, text]) => (
          <label
            key={v}
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-center text-sm leading-tight font-semibold transition-colors duration-200 ease-mel has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${value === v ? "bg-status-lost-solid text-white" : "text-text-secondary hover:text-text-primary"}`}
          >
            <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Demo({ flow, variant, run }: { flow: Flow; variant: MotionVariant; run: number }) {
  return (
    <section aria-labelledby={`titulo-${variant}`} className="flex min-w-0 flex-col gap-4 rounded-xl border-2 border-border bg-surface-elevated p-4 sm:p-5" data-testid={`demo-${variant}`}>
      <div className="flex flex-col gap-1">
        <h2 id={`titulo-${variant}`} className="text-lg font-bold">
          <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-status-lost-solid text-sm text-white">{variant.toUpperCase()}</span>
          {VARIANTS[variant].title}
        </h2>
        <p className="text-sm text-text-secondary">{VARIANTS[variant].summary}</p>
      </div>
      <MotionRoot variant={variant}>{flow === "cartaz" ? <PosterDemo key={`c-${run}`} variant={variant} /> : <LostDemo key={`l-${run}`} variant={variant} />}</MotionRoot>
    </section>
  );
}

export function MicroInteractionsLab() {
  const [variant, setVariant] = useState<MotionVariant>("a");
  const [flow, setFlow] = useState<Flow>("cartaz");
  const [side, setSide] = useState(false);
  const [run, setRun] = useState(0);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);

  // A escolha fica no endereço (dá para abrir A e B em duas janelas e comparar).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect -- lê a escolha do endereço uma vez */
    if (q.get("opcao") === "b") setVariant("b");
    if (q.get("fluxo") === "perdi") setFlow("perdi");
    if (q.get("lado") === "1") setSide(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    const q = new URLSearchParams({ opcao: variant, fluxo: flow, ...(side ? { lado: "1" } : {}) });
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [variant, flow, side]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Segmented<Flow>
          label="Fluxo"
          value={flow}
          onChange={setFlow}
          options={[
            ["cartaz", "Criar cartaz (4 etapas)"],
            ["perdi", "Perdi meu pet (6 passos)"],
          ]}
        />
        {!side && (
          <Segmented<MotionVariant>
            label="Proposta"
            value={variant}
            onChange={setVariant}
            options={[
              ["a", "A · Elegante"],
              ["b", "B · Dinâmica"],
            ]}
          />
        )}
        <label className="hidden min-h-11 items-center gap-2 text-sm font-semibold lg:flex">
          <input type="checkbox" checked={side} onChange={(e) => setSide(e.target.checked)} className="size-5 accent-primary" />
          Lado a lado (A e B)
        </label>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-3 text-sm font-semibold transition-colors duration-200 ease-mel hover:bg-surface-muted sm:ml-auto"
        >
          <RotateCcw aria-hidden="true" className="size-4" /> Recomeçar do início
        </button>
      </div>
      {reduced && (
        <p role="status" className="rounded-md bg-surface-muted p-3 text-sm font-medium">
          Seu sistema pede movimento reduzido: as transições ficam instantâneas nas duas opções. Para comparar os movimentos, desligue essa preferência.
        </p>
      )}
      {side ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Demo flow={flow} variant="a" run={run} />
          <Demo flow={flow} variant="b" run={run} />
        </div>
      ) : (
        <Demo key={variant} flow={flow} variant={variant} run={run} />
      )}
    </div>
  );
}
