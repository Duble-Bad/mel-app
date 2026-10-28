"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  contactStepSchema,
  detailsStepSchema,
  fieldErrors,
  firstIncompleteStep,
  formatBrPhone,
  formatDateTimeBr,
  LOST_STEPS,
  petSummary,
  publicAreaFrom,
  WEARING,
  WEARING_LABELS,
  whenStepSchema,
  whereStepSchema,
  type LostCase,
  type LostStep,
  type Pet,
  type Wearing,
} from "@mel/core";
import { activateLostCase, discardDraft, startLostCase, updateLostCase, type LostCasePatch } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { PetAvatar } from "@/components/pets/PetAvatar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, MultiChoiceGroup } from "@/components/ui/Choice";
import { TextField } from "@/components/ui/Field";
import { QuickPetForm } from "./QuickPetForm";

const TITLES: Record<LostStep, string> = {
  pet: "Qual pet desapareceu?",
  where: "Onde ele foi visto pela última vez?",
  when: "Quando ele sumiu?",
  details: "Algum detalhe que ajude a reconhecer?",
  contact: "Como as pessoas podem falar com você?",
  review: "Confira e ative o alerta",
};

interface WizardProps {
  profile: { id: string; city: string | null; state: string | null };
  pets: Pet[];
  draft: LostCase | null;
}

export function LostWizard({ profile, pets: initialPets, draft }: WizardProps) {
  const router = useRouter();
  const [pets, setPets] = useState(initialPets);
  const [lostCase, setLostCase] = useState<LostCase | null>(draft);
  const [step, setStep] = useState<LostStep>(() => firstIncompleteStep(draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const index = LOST_STEPS.indexOf(step);
  const pet = pets.find((p) => p.id === lostCase?.petId) ?? null;

  /** Salva o passo no rascunho e avança. Erros aparecem; nada se perde em silêncio. */
  async function save(patch: LostCasePatch, next: LostStep) {
    if (!lostCase) return;
    setBusy(true);
    setError(null);
    try {
      setLostCase(await updateLostCase(getBrowserClient(), lostCase.id, patch));
      setSaved(true);
      setStep(next);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos salvar. Verifique a conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function choosePet(petId: string) {
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserClient();
      if (lostCase && lostCase.petId !== petId && lostCase.status === "DRAFT") await discardDraft(supabase, lostCase.id);
      const started = await startLostCase(supabase, profile.id, petId);
      if (started.status === "ACTIVE") {
        // Já existe um alerta ativo para este pet: leva até ele em vez de duplicar.
        router.push(`/alerta/${started.code}`);
        return;
      }
      setLostCase(started);
      setSaved(true);
      setStep(firstIncompleteStep(started) === "pet" ? "where" : firstIncompleteStep(started));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos continuar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!lostCase) return;
    setBusy(true);
    setError(null);
    try {
      const active = await activateLostCase(getBrowserClient(), lostCase.id);
      router.push(`/alerta/${active.code}?novo=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos ativar o alerta. Tente de novo.");
      setBusy(false);
    }
  }

  const back = index > 0 ? () => setStep(LOST_STEPS[index - 1]!) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            Passo {index + 1} de {LOST_STEPS.length}
          </span>
          {saved && <span role="status">✓ Rascunho salvo</span>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
          <div className="h-full bg-status-lost-solid transition-all" style={{ width: `${((index + 1) / LOST_STEPS.length) * 100}%` }} />
        </div>
        <h1 className="text-2xl font-bold">{TITLES[step]}</h1>
        {pet && step !== "pet" && (
          <p className="flex items-center gap-2 text-text-secondary">
            <PetAvatar pet={pet} size="sm" /> {pet.name}
          </p>
        )}
      </header>

      {notice && <Alert tone="info">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {step === "pet" && (
        <PetStep
          pets={pets}
          selectedId={lostCase?.petId ?? null}
          profile={profile}
          busy={busy}
          onChoose={choosePet}
          onCreated={(created, warning) => {
            setPets((list) => [created, ...list]);
            if (warning) setNotice(warning);
            void choosePet(created.id);
          }}
        />
      )}
      {step === "where" && lostCase && (
        <WhereStep lostCase={lostCase} busy={busy} onBack={back} onNext={(patch) => save(patch, "when")} />
      )}
      {step === "when" && lostCase && (
        <WhenStep lostCase={lostCase} busy={busy} onBack={back} onNext={(patch) => save(patch, "details")} />
      )}
      {step === "details" && lostCase && (
        <DetailsStep lostCase={lostCase} busy={busy} onBack={back} onNext={(patch) => save(patch, "contact")} />
      )}
      {step === "contact" && lostCase && (
        <ContactStep lostCase={lostCase} busy={busy} onBack={back} onNext={(patch) => save(patch, "review")} />
      )}
      {step === "review" && lostCase && pet && (
        <ReviewStep lostCase={lostCase} pet={pet} busy={busy} onEdit={setStep} onActivate={activate} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Nav({ busy, onBack, children = "Continuar" }: { busy: boolean; onBack?: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <Button type="submit" loading={busy} loadingText="Salvando…">
        {children}
      </Button>
      {onBack && (
        <Button variant="ghost" size="md" onClick={onBack} disabled={busy}>
          Voltar
        </Button>
      )}
    </div>
  );
}

function PetStep({
  pets,
  selectedId,
  profile,
  busy,
  onChoose,
  onCreated,
}: {
  pets: Pet[];
  selectedId: string | null;
  profile: WizardProps["profile"];
  busy: boolean;
  onChoose: (id: string) => void;
  onCreated: (pet: Pet, warning?: string) => void;
}) {
  const [creating, setCreating] = useState(pets.length === 0);
  return (
    <div className="flex flex-col gap-4">
      {pets.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Seus pets">
          {pets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onChoose(p.id)}
                aria-pressed={p.id === selectedId}
                className="flex w-full items-center gap-4 rounded-lg border-2 border-border bg-surface p-3 text-left hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft"
              >
                <PetAvatar pet={p} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold">{p.name}</span>
                  <span className="block truncate text-sm text-text-secondary">{petSummary(p)}</span>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <>
          {pets.length === 0 && <p className="text-text-secondary">Vamos cadastrar seu pet rapidinho. Só o essencial.</p>}
          <QuickPetForm ownerId={profile.id} city={profile.city} state={profile.state} onCreated={onCreated} />
        </>
      ) : (
        <Button variant="secondary" onClick={() => setCreating(true)} disabled={busy}>
          + É outro pet (cadastrar rápido)
        </Button>
      )}
    </div>
  );
}

function WhereStep({
  lostCase,
  busy,
  onBack,
  onNext,
}: {
  lostCase: LostCase;
  busy: boolean;
  onBack?: () => void;
  onNext: (patch: LostCasePatch) => void;
}) {
  const [picked, setPicked] = useState<PickedLocation | null>(
    lostCase.lastSeen ? { position: lostCase.lastSeen, label: lostCase.lastSeenLabel ?? undefined, source: "map" } : null,
  );
  const [exact, setExact] = useState(lostCase.publicPointExact);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = whereStepSchema.safeParse({
          lastSeen: picked?.position,
          lastSeenLabel: picked?.label ?? null,
          publicAreaLabel: picked ? publicAreaFrom(picked) : null,
          city: picked?.city ?? null,
          state: picked?.state ?? null,
          publicPointExact: exact,
        });
        if (!parsed.success) {
          setError(fieldErrors(parsed.error).lastSeen ?? "Marque o local no mapa.");
          return;
        }
        onNext({
          ...parsed.data,
          // Mantém o que já estava salvo se o endereço ainda não foi identificado.
          publicAreaLabel: parsed.data.publicAreaLabel ?? lostCase.publicAreaLabel,
          city: parsed.data.city ?? lostCase.city,
          state: parsed.data.state ?? lostCase.state,
        });
      }}
    >
      <LocationPicker
        value={picked}
        onChange={(v) => {
          setPicked(v);
          setError(null);
        }}
        privacyNote="No alerta mostramos um local aproximado (cerca de 250 m) e só o bairro. Seu endereço não aparece."
      />
      <label className="flex min-h-12 items-start gap-3">
        <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
        <span>
          <span className="font-semibold">Mostrar o local exato no alerta</span>
          <span className="block text-sm text-text-secondary">Não recomendado se o local for a sua casa.</span>
        </span>
      </label>
      {error && (
        <p role="alert" className="font-medium text-danger">
          {error}
        </p>
      )}
      <Nav busy={busy} onBack={onBack} />
    </form>
  );
}

type WhenChoice = "now" | "today" | "yesterday" | "other";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function WhenStep({
  lostCase,
  busy,
  onBack,
  onNext,
}: {
  lostCase: LostCase;
  busy: boolean;
  onBack?: () => void;
  onNext: (patch: LostCasePatch) => void;
}) {
  const saved = lostCase.lostAt ? new Date(lostCase.lostAt) : null;
  const [choice, setChoice] = useState<WhenChoice | null>(saved ? "other" : null);
  const [time, setTime] = useState(() => localTime(new Date(Date.now() - 60 * 60_000)));
  const [other, setOther] = useState(saved ? `${localDate(saved)}T${localTime(saved)}` : "");
  const [uncertain, setUncertain] = useState(lostCase.lostAtUncertain);
  const [error, setError] = useState<string | null>(null);

  function computeLostAt(): string | null {
    const now = new Date();
    if (choice === "now") return now.toISOString();
    if (choice === "today" || choice === "yesterday") {
      const day = new Date(now);
      if (choice === "yesterday") day.setDate(day.getDate() - 1);
      const d = new Date(`${localDate(day)}T${time || "12:00"}`);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (choice === "other" && other) {
      const d = new Date(other);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = whenStepSchema.safeParse({ lostAt: computeLostAt(), lostAtUncertain: uncertain });
        if (!parsed.success) {
          setError(fieldErrors(parsed.error).lostAt ?? "Diga quando ele sumiu.");
          return;
        }
        onNext(parsed.data);
      }}
    >
      <ChoiceGroup
        name="when"
        legend="Quando foi?"
        columns={2}
        value={choice}
        onChange={(v) => {
          setChoice(v);
          setError(null);
        }}
        options={[
          { value: "now", label: "Agora há pouco" },
          { value: "today", label: "Hoje" },
          { value: "yesterday", label: "Ontem" },
          { value: "other", label: "Outro dia" },
        ]}
      />
      {(choice === "today" || choice === "yesterday") && (
        <TextField label="Mais ou menos que horas?" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      )}
      {choice === "other" && (
        <TextField
          label="Dia e hora aproximados"
          type="datetime-local"
          max={`${localDate(new Date())}T${localTime(new Date())}`}
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
      )}
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" checked={uncertain} onChange={(e) => setUncertain(e.target.checked)} className="size-5 accent-primary" />
        <span className="font-semibold">Não sei exatamente o horário</span>
      </label>
      {error && (
        <p role="alert" className="font-medium text-danger">
          {error}
        </p>
      )}
      <Nav busy={busy} onBack={onBack} />
    </form>
  );
}

function DetailsStep({
  lostCase,
  busy,
  onBack,
  onNext,
}: {
  lostCase: LostCase;
  busy: boolean;
  onBack?: () => void;
  onNext: (patch: LostCasePatch) => void;
}) {
  const [wearing, setWearing] = useState<Wearing[]>(lostCase.wearing);
  const [notes, setNotes] = useState(lostCase.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = detailsStepSchema.safeParse({ wearing, notes });
        if (!parsed.success) {
          setError(fieldErrors(parsed.error).notes ?? "Confira os detalhes.");
          return;
        }
        onNext(parsed.data);
      }}
    >
      <MultiChoiceGroup
        name="wearing"
        legend="Estava usando"
        optional
        columns={2}
        values={wearing}
        onChange={setWearing}
        options={WEARING.map((w) => ({ value: w, label: WEARING_LABELS[w] }))}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="font-semibold">
          Algo importante? <span className="font-normal text-text-secondary">(opcional)</span>
        </label>
        <p className="text-sm text-text-secondary">Ex.: é medroso e foge de gente; atende pelo nome; precisa de remédio.</p>
        <textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 focus:border-focus focus:outline-none"
        />
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </div>
      <Nav busy={busy} onBack={onBack} />
    </form>
  );
}

function ContactStep({
  lostCase,
  busy,
  onBack,
  onNext,
}: {
  lostCase: LostCase;
  busy: boolean;
  onBack?: () => void;
  onNext: (patch: LostCasePatch) => void;
}) {
  const [chat, setChat] = useState(lostCase.contactChat);
  const [whatsapp, setWhatsapp] = useState(lostCase.contactWhatsappPublic);
  const [phonePublic, setPhonePublic] = useState(lostCase.contactPhonePublic);
  const [phone, setPhone] = useState(lostCase.contactPhone ? formatBrPhone(lostCase.contactPhone) : "");
  const [error, setError] = useState<string | undefined>();
  const wantsPhone = whatsapp || phonePublic;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = contactStepSchema.safeParse({
          contactChat: chat,
          contactWhatsappPublic: whatsapp,
          contactPhonePublic: phonePublic,
          contactPhone: phone || null,
        });
        if (!parsed.success) {
          setError(fieldErrors(parsed.error).contactPhone);
          return;
        }
        onNext(parsed.data);
      }}
    >
      <label className="flex min-h-12 items-start gap-3">
        <input type="checkbox" checked={chat} onChange={(e) => setChat(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
        <span>
          <span className="block font-semibold">Receber mensagens pelo chat da MEL</span>
          <span className="block text-sm text-text-secondary">Recomendado: ninguém vê seu número, e você pode bloquear e denunciar.</span>
        </span>
      </label>
      <p className="text-text-secondary">
        Seu número <strong className="text-text-primary">só aparece no alerta se você marcar</strong> uma das opções abaixo.
      </p>
      <label className="flex min-h-12 items-start gap-3">
        <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
        <span className="font-semibold">Mostrar botão de WhatsApp no alerta</span>
      </label>
      <label className="flex min-h-12 items-start gap-3">
        <input type="checkbox" checked={phonePublic} onChange={(e) => setPhonePublic(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
        <span className="font-semibold">Mostrar botão para ligar</span>
      </label>
      {wantsPhone && (
        <TextField
          label="Seu celular com DDD"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 98765-4321"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={error}
        />
      )}
      <Alert tone="info">
        <strong>Cuidado com golpes.</strong> Desconfie de quem pedir PIX ou dinheiro antes de mostrar o animal. A MEL nunca
        pede pagamento.
      </Alert>
      <Nav busy={busy} onBack={onBack} />
    </form>
  );
}

function ReviewStep({
  lostCase,
  pet,
  busy,
  onEdit,
  onActivate,
}: {
  lostCase: LostCase;
  pet: Pet;
  busy: boolean;
  onEdit: (step: LostStep) => void;
  onActivate: () => void;
}) {
  const rows: [string, ReactNode, LostStep][] = [
    ["Pet", `${pet.name} · ${petSummary(pet)}`, "pet"],
    [
      "Visto por último",
      lostCase.lastSeenLabel ? `perto de ${lostCase.lastSeenLabel}` : "local marcado no mapa",
      "where",
    ],
    ["No alerta aparece", lostCase.publicPointExact ? "o local exato" : `local aproximado${lostCase.publicAreaLabel ? ` · ${lostCase.publicAreaLabel}` : ""}`, "where"],
    ["Quando", lostCase.lostAt ? `${formatDateTimeBr(lostCase.lostAt)}${lostCase.lostAtUncertain ? " (aproximado)" : ""}` : "—", "when"],
    ["Usando", lostCase.wearing.length ? lostCase.wearing.map((w) => WEARING_LABELS[w]).join(", ") : "—", "details"],
    ["Observação", lostCase.notes ?? "—", "details"],
    [
      "Contato no alerta",
      [
        lostCase.contactChat && "chat da MEL",
        lostCase.contactPhone &&
          `${[lostCase.contactWhatsappPublic && "WhatsApp", lostCase.contactPhonePublic && "ligação"].filter(Boolean).join(" e ")} · ${formatBrPhone(lostCase.contactPhone)}`,
      ]
        .filter(Boolean)
        .join(" · ") || "nenhum (só avistamentos)",
      "contact",
    ],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <PetAvatar pet={pet} size="lg" />
        <div>
          <p className="text-2xl font-bold">{pet.name}</p>
          <p className="text-text-secondary">{petSummary(pet)}</p>
        </div>
      </div>
      {pet.photos.length === 0 && (
        <Alert tone="info">Sem foto o alerta funciona, mas uma foto ajuda muito. Você pode adicionar depois em Meus pets.</Alert>
      )}
      <dl className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map(([label, value, target]) => (
          <div key={label} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <dt className="text-sm text-text-secondary">{label}</dt>
              <dd className="font-semibold break-words">{value}</dd>
            </div>
            <button
              type="button"
              onClick={() => onEdit(target)}
              className="min-h-11 shrink-0 px-2 text-sm font-semibold text-link underline-offset-4 hover:underline"
            >
              Editar<span className="sr-only"> {label}</span>
            </button>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onActivate}
        disabled={busy}
        aria-busy={busy || undefined}
        className="min-h-16 w-full rounded-lg bg-status-lost-solid px-5 text-xl font-extrabold tracking-wide text-text-inverse uppercase shadow-card disabled:opacity-60"
      >
        {busy ? "Ativando…" : "Ativar alerta MEL"}
      </button>
      <p className="text-center text-sm text-text-secondary">O alerta fica público e pode ser compartilhado.</p>
    </div>
  );
}
