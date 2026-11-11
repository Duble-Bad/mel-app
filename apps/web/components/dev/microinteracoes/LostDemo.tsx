"use client";

import { ClipboardCheck, Clock, FileText, MapPin, MessageCircle, PawPrint, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { contactStepSchema, detailsStepSchema, fieldErrors, formatPhoneInput, LOST_STEPS, type LostStep, type Wearing, WEARING, WEARING_LABELS, whenStepSchema, whereStepSchema } from "@mel/core";
import { FieldMessage, motionBadge, motionCard, Shake, StepStage, useStepFlow } from "@/components/motion/Motion";
import { MotionSteps, type MotionVariant } from "@/components/motion/MotionSteps";
import { PublicDescriptionField } from "@/components/pets/PublicDescriptionField";
import type { StepState } from "@/components/ui/StepIndicator";

/**
 * PROTÓTIPO (DEV) do "Perdi meu pet" com movimento. Os seis passos, os títulos e as regras de
 * validação são os do `LostWizard` (esquemas de `@mel/core`). Tudo fica na memória da página:
 * nenhum rascunho, pet ou alerta é criado, e "Ativar alerta" não existe aqui. Pets e locais
 * são fictícios; o mapa é substituído por três pontos de exemplo.
 */

// Ícone e nome curto de cada passo real (LOST_STEPS); os títulos são os do LostWizard.
const STEP_META: Record<LostStep, { label: string; icon: LucideIcon; title: string }> = {
  pet: { label: "Pet", icon: PawPrint, title: "Qual pet desapareceu?" },
  where: { label: "Onde", icon: MapPin, title: "Onde ele foi visto pela última vez?" },
  when: { label: "Quando", icon: Clock, title: "Quando ele sumiu?" },
  details: { label: "Detalhes", icon: FileText, title: "Algum detalhe que ajude a reconhecer?" },
  contact: { label: "Contato", icon: MessageCircle, title: "Como as pessoas podem falar com você?" },
  review: { label: "Revisão", icon: ClipboardCheck, title: "Confira e ative o alerta" },
};
const STEPS = LOST_STEPS.map((k) => STEP_META[k]);

const DEMO_PETS = [
  { id: "demo-1", name: "Pet de exemplo 1", summary: "Cachorro · SRD · porte médio (fictício)" },
  { id: "demo-2", name: "Pet de exemplo 2", summary: "Gato · sem raça definida (fictício)" },
];
const DEMO_PLACES = [
  { label: "Praça de Exemplo", area: "Jardim Fictício, Cidade Exemplo – SP", position: { lat: -23.5, lng: -46.6 } },
  { label: "Rua Imaginária, perto da padaria", area: "Vila Demonstração, Cidade Exemplo – SP", position: { lat: -23.51, lng: -46.61 } },
  { label: "Parque Modelo", area: "Bairro Teste, Cidade Exemplo – SP", position: { lat: -23.52, lng: -46.62 } },
];

type WhenChoice = "now" | "today" | "yesterday" | "other";
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const btn = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-5 font-semibold transition-[background-color,transform] duration-200 ease-mel active:scale-[.985]";
const cardBase = `${motionCard} flex min-h-12 w-full items-center gap-3 rounded-lg border-2 bg-surface p-3 text-left`;
const cardOn = "border-primary bg-primary-soft";
const cardOff = "border-border hover:border-primary";

export function LostDemo({ variant }: { variant: MotionVariant }) {
  const flow = useStepFlow(LOST_STEPS.length);
  const step = LOST_STEPS[flow.index]!;
  const [petId, setPetId] = useState<string | null>(null);
  const [place, setPlace] = useState<number | null>(null);
  const [exact, setExact] = useState(false);
  const [when, setWhen] = useState<WhenChoice | null>(null);
  const [time, setTime] = useState("18:00");
  const [other, setOther] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [wearing, setWearing] = useState<Wearing[]>([]);
  const [notes, setNotes] = useState("");
  const [chat, setChat] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);
  const [phone, setPhone] = useState("");
  // Erro do passo atual e quantas tentativas inválidas (a opção B balança o campo a cada uma).
  const [error, setError] = useState<{ step: LostStep; message: string; attempt: number } | null>(null);
  const [done, setDone] = useState<Set<LostStep>>(new Set());

  const states: StepState[] = LOST_STEPS.map((k, i) => {
    if (i === flow.index) return error?.step === k ? "error" : "current";
    return done.has(k) ? "done" : "pending";
  });

  const fail = (message: string) => setError((e) => ({ step, message, attempt: (e?.step === step ? e.attempt : 0) + 1 }));
  const clear = () => setError((e) => (e?.step === step ? null : e));
  const advance = () => {
    setError(null);
    setDone((d) => new Set(d).add(step));
    flow.next();
  };
  const go = (i: number) => {
    setError(null);
    flow.go(i);
  };
  const msg = error?.step === step ? error.message : null;
  const attempt = error?.step === step ? error.attempt : 0;

  function lostAt(): string | null {
    const now = new Date();
    if (when === "now") return now.toISOString();
    if (when === "today" || when === "yesterday") {
      const day = new Date(now);
      if (when === "yesterday") day.setDate(day.getDate() - 1);
      const d = new Date(`${localDate(day)}T${time || "12:00"}`);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (when === "other" && other) {
      const d = new Date(other);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  }

  // Cada passo valida com o mesmo esquema do LostWizard.
  function submit() {
    if (step === "where") {
      const p = place === null ? null : DEMO_PLACES[place]!;
      const parsed = whereStepSchema.safeParse({ lastSeen: p?.position, lastSeenLabel: p?.label ?? null, publicAreaLabel: p?.area ?? null, publicPointExact: exact });
      return parsed.success ? advance() : fail(fieldErrors(parsed.error).lastSeen ?? "Marque o local no mapa.");
    }
    if (step === "when") {
      const parsed = whenStepSchema.safeParse({ lostAt: lostAt(), lostAtUncertain: uncertain });
      return parsed.success ? advance() : fail(fieldErrors(parsed.error).lostAt ?? "Diga quando ele sumiu.");
    }
    if (step === "details") {
      const parsed = detailsStepSchema.safeParse({ wearing, notes });
      return parsed.success ? advance() : fail(fieldErrors(parsed.error).notes ?? "Confira os detalhes.");
    }
    if (step === "contact") {
      const parsed = contactStepSchema.safeParse({ contactChat: chat, contactWhatsappPublic: whatsapp, contactPhonePublic: false, contactPhone: phone || null });
      return parsed.success ? advance() : fail(fieldErrors(parsed.error).contactPhone ?? "Confira o contato.");
    }
  }

  const heading = (
    <h3 data-step-heading tabIndex={-1} className="text-2xl font-bold">
      {STEP_META[step].title}
    </h3>
  );
  const nav = (
    <div className="flex flex-col gap-3 pt-2">
      <button type="submit" className={`${btn} bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover`}>
        Continuar
      </button>
      <button type="button" onClick={() => go(flow.index - 1)} className={`${btn} text-link hover:bg-primary-soft`}>
        Voltar
      </button>
    </div>
  );
  const form = (children: ReactNode) => (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {children}
      {nav}
    </form>
  );
  const box = (on: boolean, label: ReactNode, onChange: (v: boolean) => void, hint?: string) => (
    <label className="flex min-h-12 items-start gap-3">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-text-secondary">{hint}</span>}
      </span>
    </label>
  );

  let body: ReactNode = null;
  if (step === "pet")
    body = (
      <ul className="flex flex-col gap-3" aria-label="Seus pets (exemplo)">
        {DEMO_PETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={p.id === petId}
              onClick={() => {
                setPetId(p.id);
                advance();
              }}
              className={`${cardBase} ${p.id === petId ? cardOn : cardOff}`}
            >
              <PawPrint aria-hidden="true" className="size-8 shrink-0 rounded-full bg-surface-muted p-1.5 text-text-secondary" />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">{p.name}</span>
                <span className="block truncate text-sm text-text-secondary">{p.summary}</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
    );

  if (step === "where")
    body = form(
      <>
        <fieldset className="flex flex-col gap-2" aria-invalid={msg ? true : undefined} aria-describedby="erro-onde">
          <legend className="mb-1.5 font-semibold">Ponto no mapa (exemplo, em vez do mapa)</legend>
          <Shake attempt={attempt} className="flex flex-col gap-2">
            {DEMO_PLACES.map((p, i) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={place === i}
                onClick={() => {
                  setPlace(i);
                  clear();
                }}
                className={`${cardBase} ${place === i ? cardOn : msg ? "border-danger-solid" : cardOff}`}
              >
                <MapPin aria-hidden="true" className="size-5 shrink-0 text-status-lost" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.label}</span>
                  <span className="block text-sm text-text-secondary">{p.area}</span>
                </span>
                {place === i && <span className={`${motionBadge} rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground`}>Marcado</span>}
              </button>
            ))}
          </Shake>
          <FieldMessage id="erro-onde" message={msg} />
        </fieldset>
        {box(exact, "Mostrar o local exato no alerta", setExact, "Não recomendado se o local for a sua casa.")}
      </>,
    );

  if (step === "when")
    body = form(
      <>
        <fieldset className="flex flex-col gap-2" aria-invalid={msg ? true : undefined} aria-describedby="erro-quando">
          <legend className="mb-1.5 font-semibold">Quando foi?</legend>
          <Shake attempt={attempt} className="grid grid-cols-2 gap-2">
            {(
              [
                ["now", "Agora há pouco"],
                ["today", "Hoje"],
                ["yesterday", "Ontem"],
                ["other", "Outro dia"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className={`${motionCard} flex min-h-12 cursor-pointer items-center rounded-md border-2 px-4 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${when === v ? cardOn : msg ? "border-danger-solid bg-surface" : "border-border-strong bg-surface"}`}>
                <input
                  type="radio"
                  name="quando-demo"
                  checked={when === v}
                  onChange={() => {
                    setWhen(v);
                    clear();
                  }}
                  className="sr-only"
                />
                <span className="font-semibold">{label}</span>
              </label>
            ))}
          </Shake>
          <FieldMessage id="erro-quando" message={msg} />
        </fieldset>
        {(when === "today" || when === "yesterday") && (
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Mais ou menos que horas?</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="min-h-12 rounded-md border-2 border-border-strong bg-surface px-4" />
          </label>
        )}
        {when === "other" && (
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Dia e hora aproximados</span>
            <input type="datetime-local" value={other} onChange={(e) => setOther(e.target.value)} className="min-h-12 rounded-md border-2 border-border-strong bg-surface px-4" />
          </label>
        )}
        {box(uncertain, "Não sei exatamente o horário", setUncertain)}
      </>,
    );

  if (step === "details")
    body = form(
      <>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-semibold">
            Estava usando <span className="font-normal text-text-secondary">(opcional)</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {WEARING.map((w) => {
              const on = wearing.includes(w);
              return (
                <label key={w} className={`${motionCard} flex min-h-12 cursor-pointer items-center rounded-md border-2 px-4 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${on ? cardOn : "border-border-strong bg-surface"}`}>
                  <input type="checkbox" checked={on} onChange={(e) => setWearing(e.target.checked ? [...wearing, w] : wearing.filter((x) => x !== w))} className="sr-only" />
                  <span className="font-semibold">{WEARING_LABELS[w]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Shake attempt={attempt}>
          <PublicDescriptionField
            id="notas-demo"
            label="Algo importante?"
            guidance="Exemplo: comportamento, condições especiais e referências do lugar."
            placeholder="Ex.: é dócil, mas pode ficar assustado e se esconder."
            value={notes}
            onChange={(v) => {
              setNotes(v);
              clear();
            }}
            className="block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 focus:border-focus focus:outline-none"
          />
        </Shake>
        <FieldMessage id="erro-detalhes" message={msg} />
      </>,
    );

  if (step === "contact")
    body = form(
      <>
        {box(chat, "Receber mensagens pelo chat da MEL", setChat, "Recomendado: ninguém vê seu número.")}
        {box(whatsapp, "Mostrar botão de WhatsApp no alerta", (v) => {
          setWhatsapp(v);
          clear();
        })}
        {whatsapp && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="celular-demo" className="font-semibold">
              Seu celular com DDD
            </label>
            <Shake attempt={attempt}>
              <input
                id="celular-demo"
                type="tel"
                inputMode="tel"
                placeholder="(11) 98765-4321"
                value={phone}
                aria-invalid={msg ? true : undefined}
                aria-describedby="erro-contato"
                onChange={(e) => {
                  setPhone(formatPhoneInput(e.target.value));
                  clear();
                }}
                className={`min-h-12 w-full rounded-md border-2 bg-surface px-4 transition-colors duration-200 ease-mel focus:border-focus focus:outline-none ${msg ? "border-danger-solid" : "border-border-strong"}`}
              />
            </Shake>
            <FieldMessage id="erro-contato" message={msg} />
          </div>
        )}
        <p className="rounded-md bg-surface-muted p-3 text-sm">Demonstração: marque o WhatsApp e continue sem o número para ver o erro de validação.</p>
      </>,
    );

  if (step === "review") {
    const p = place === null ? null : DEMO_PLACES[place];
    const rows: [string, string, LostStep][] = [
      ["Pet", DEMO_PETS.find((x) => x.id === petId)?.name ?? "—", "pet"],
      ["Visto por último", p ? `perto de ${p.label}` : "—", "where"],
      ["Quando", lostAt() ? new Date(lostAt()!).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) + (uncertain ? " (aproximado)" : "") : "—", "when"],
      ["Usando", wearing.length ? wearing.map((w) => WEARING_LABELS[w]).join(", ") : "—", "details"],
      ["Contato no alerta", [chat && "chat da MEL", whatsapp && phone && `WhatsApp · ${phone}`].filter(Boolean).join(" · ") || "nenhum (só avistamentos)", "contact"],
    ];
    body = (
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map(([label, value, target]) => (
            <div key={label} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <dt className="text-sm text-text-secondary">{label}</dt>
                <dd className="font-semibold break-words">{value}</dd>
              </div>
              <button type="button" onClick={() => go(LOST_STEPS.indexOf(target))} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-link underline-offset-4 hover:underline">
                Editar<span className="sr-only"> {label}</span>
              </button>
            </div>
          ))}
        </dl>
        <button type="button" disabled className="min-h-16 w-full cursor-not-allowed rounded-lg bg-status-lost-solid px-5 text-xl font-extrabold tracking-wide text-text-inverse uppercase opacity-60">
          Ativar alerta MEL
        </button>
        <p className="text-center text-sm text-text-secondary">Demonstração: nada é publicado. No fluxo real, este botão ativa o alerta.</p>
        <button type="button" onClick={() => go(flow.index - 1)} className={`${btn} text-link hover:bg-primary-soft`}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex scroll-mt-20 flex-col gap-6" data-step-flow>
      <MotionSteps steps={STEPS} states={states} onSelect={go} label="Passos do alerta (demonstração)" variant={variant} direction={flow.direction} />
      <StepStage stepKey={`l-${step}`} direction={flow.direction}>
        <div className="flex flex-col gap-5">
          {heading}
          {body}
        </div>
      </StepStage>
    </div>
  );
}
