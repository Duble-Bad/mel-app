"use client";

import { ClipboardCheck, Clock, FileText, MapPin, MessageCircle, PawPrint, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { contactStepSchema, detailsStepSchema, fieldErrors, firstIncompleteStep, formatBrPhone, formatDateTimeBr, formatPhoneInput, LOST_STEPS, type LostCase, type LostStep, type Pet, petSummary, publicAreaFrom, userErrorMessage, type Wearing, WEARING, WEARING_LABELS, whenStepSchema, whereStepSchema } from "@mel/core";
import { activateLostCase, discardDraft, startLostCase, updateLostCase, type LostCasePatch } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { kickPushDispatch } from "@/lib/push/client";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { PetAvatar } from "@/components/pets/PetAvatar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, MultiChoiceGroup } from "@/components/ui/Choice";
import { TextField } from "@/components/ui/Field";
import { QuickPetForm } from "./QuickPetForm";
import { PublicDescriptionField } from "@/components/pets/PublicDescriptionField";
import { FieldMessage, motionCard, MotionRoot, Shake, StepStage, type Direction } from "@/components/motion/Motion";
import { MotionSteps } from "@/components/motion/MotionSteps";
import type { StepState } from "@/components/ui/StepIndicator";

/** Nome curto e ícone de cada passo no indicador. */
const STEP_META: Record<LostStep, { label: string; icon: LucideIcon }> = {
  pet: { label: "Pet", icon: PawPrint },
  where: { label: "Onde", icon: MapPin },
  when: { label: "Quando", icon: Clock },
  details: { label: "Detalhes", icon: FileText },
  contact: { label: "Contato", icon: MessageCircle },
  review: { label: "Revisão", icon: ClipboardCheck },
};

/** Avisa o assistente quando o passo atual tem erro de validação (o indicador mostra "com erro"). */
type OnInvalid = (invalid: boolean) => void;

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
  /**
   * "edit": alerta já ATIVO — só onde, quando, detalhes e contato (sem trocar o
   * pet nem ativar de novo). Cada "Continuar" já vale no alerta publicado.
   */
  mode?: "create" | "edit";
}

/** Passos ao editar um alerta ativo (o pet e a ativação não mudam). */
const EDIT_STEPS: LostStep[] = ["where", "when", "details", "contact"];

export function LostWizard({ profile, pets: initialPets, draft, mode = "create" }: WizardProps) {
  const router = useRouter();
  const editing = mode === "edit";
  const steps = editing ? EDIT_STEPS : LOST_STEPS;
  const [pets, setPets] = useState(initialPets);
  const [lostCase, setLostCase] = useState<LostCase | null>(draft);
  const [step, setStepState] = useState<LostStep>(() => (editing ? "where" : firstIncompleteStep(draft)));
  // Sentido da última troca (a animação acompanha), se o tutor já navegou (o foco só muda
  // depois disso) e se o passo atual está com erro de validação.
  const [direction, setDirection] = useState<Direction>("forward");
  const [moved, setMoved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const setStep = (next: LostStep) => {
    setDirection(steps.indexOf(next) < steps.indexOf(step) ? "back" : "forward");
    setMoved(true);
    setInvalid(false);
    setStepState(next);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const index = steps.indexOf(step);
  const pet = pets.find((p) => p.id === lostCase?.petId) ?? null;

  /** Salva o passo e avança (ou, ao editar, termina no alerta). Erros aparecem; nada se perde em silêncio. */
  async function save(patch: LostCasePatch, next: LostStep | "done") {
    if (!lostCase) return;
    setBusy(true);
    setError(null);
    try {
      setLostCase(await updateLostCase(getBrowserClient(), lostCase.id, patch));
      setSaved(true);
      if (next === "done") {
        router.push(`/alerta/${lostCase.code}?editado=1`);
        return;
      }
      setStep(next);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos salvar. Verifique a conexão e tente de novo."));
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
      setError(userErrorMessage(err, "Não conseguimos continuar. Tente de novo."));
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
      // Guardiões da região: o banco já criou os avisos; aqui só pede o envio do push.
      kickPushDispatch();
      router.push(`/alerta/${active.code}?novo=1`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos ativar o alerta. Tente de novo."));
      setBusy(false);
    }
  }

  const back = index > 0 ? () => setStep(steps[index - 1]!) : undefined;
  // Passos anteriores ficam concluídos (tocar volta a eles); o atual pode estar com erro.
  const states: StepState[] = steps.map((_, i) => (i < index ? "done" : i === index ? (invalid ? "error" : "current") : "pending"));

  return (
    <MotionRoot variant="b" className="flex scroll-mt-20 flex-col gap-6" data-step-flow>
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
          {/* No celular, "Editar alerta" aparece junto do "Passo N de M" do indicador. */}
          <span className="hidden font-semibold sm:inline">{editing && "Editar alerta"}</span>
          {saved && (
            <span role="status" className="ml-auto">
              {editing ? "✓ Alterações salvas" : "✓ Rascunho salvo"}
            </span>
          )}
        </div>
        <MotionSteps
          steps={steps.map((k) => STEP_META[k])}
          states={states}
          onSelect={busy ? undefined : (i) => setStep(steps[i]!)}
          label={editing ? "Passos da edição do alerta" : "Passos do alerta"}
          variant="b"
          direction={direction}
          prefix={editing ? "Editar alerta · " : undefined}
        />
      </header>

      {notice && <Alert tone="info">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <StepStage stepKey={step} direction={direction} focus={moved}>
      <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 data-step-heading tabIndex={-1} className="text-2xl font-bold">
          {TITLES[step]}
        </h1>
        {pet && step !== "pet" && (
          <p className="flex items-center gap-2 text-text-secondary">
            <PetAvatar pet={pet} size="sm" /> {pet.name}
          </p>
        )}
      </div>

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
        <WhereStep lostCase={lostCase} busy={busy} onBack={back} onInvalid={setInvalid} onNext={(patch) => save(patch, "when")} />
      )}
      {step === "when" && lostCase && (
        <WhenStep lostCase={lostCase} busy={busy} onBack={back} onInvalid={setInvalid} onNext={(patch) => save(patch, "details")} />
      )}
      {step === "details" && lostCase && (
        <DetailsStep lostCase={lostCase} busy={busy} onBack={back} onInvalid={setInvalid} onNext={(patch) => save(patch, "contact")} />
      )}
      {step === "contact" && lostCase && (
        <ContactStep
          lostCase={lostCase}
          busy={busy}
          onBack={back}
          onInvalid={setInvalid}
          onNext={(patch) => save(patch, editing ? "done" : "review")}
          submitLabel={editing ? "Salvar alterações" : undefined}
        />
      )}
      {step === "review" && lostCase && pet && (
        <ReviewStep lostCase={lostCase} pet={pet} busy={busy} onEdit={setStep} onActivate={activate} />
      )}
      </div>
      </StepStage>
    </MotionRoot>
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
                className={`${motionCard} flex w-full items-center gap-4 rounded-lg border-2 border-border bg-surface p-3 text-left hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft`}
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

/** Erro de validação de um passo: mensagem, tentativas (o campo balança a cada uma) e aviso ao indicador. */
function useStepError(onInvalid?: OnInvalid) {
  const [error, setErrorState] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const setError = (message: string | null) => {
    setErrorState(message);
    if (message) setAttempt((n) => n + 1);
    onInvalid?.(Boolean(message));
  };
  return { error, attempt, setError };
}

function WhereStep({
  lostCase,
  busy,
  onBack,
  onNext,
  onInvalid,
}: {
  lostCase: LostCase;
  busy: boolean;
  onBack?: () => void;
  onNext: (patch: LostCasePatch) => void;
  onInvalid?: OnInvalid;
}) {
  const [picked, setPicked] = useState<PickedLocation | null>(
    lostCase.lastSeen ? { position: lostCase.lastSeen, label: lostCase.lastSeenLabel ?? undefined, source: "map" } : null,
  );
  const [exact, setExact] = useState(lostCase.publicPointExact);
  const { error, attempt, setError } = useStepError(onInvalid);

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
      <Shake attempt={attempt}>
        <LocationPicker
          value={picked}
          onChange={(v) => {
            setPicked(v);
            if (error) setError(null);
          }}
          privacyNote="No alerta mostramos um local aproximado (cerca de 100 m) e só o bairro. Seu endereço não aparece."
        />
      </Shake>
      <label className="flex min-h-12 items-start gap-3">
        <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
        <span>
          <span className="font-semibold">Mostrar o local exato no alerta</span>
          <span className="block text-sm text-text-secondary">Não recomendado se o local for a sua casa.</span>
        </span>
      </label>
      <FieldMessage id="erro-onde" message={error} />
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
  onInvalid,
}: {
  lostCase: LostCase;
  busy: boolean;
  onBack?: () => void;
  onNext: (patch: LostCasePatch) => void;
  onInvalid?: OnInvalid;
}) {
  const saved = lostCase.lostAt ? new Date(lostCase.lostAt) : null;
  const [choice, setChoice] = useState<WhenChoice | null>(saved ? "other" : null);
  const [time, setTime] = useState(() => localTime(new Date(Date.now() - 60 * 60_000)));
  const [other, setOther] = useState(saved ? `${localDate(saved)}T${localTime(saved)}` : "");
  const [uncertain, setUncertain] = useState(lostCase.lostAtUncertain);
  const { error, attempt, setError } = useStepError(onInvalid);

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
      <Shake attempt={attempt}>
        <ChoiceGroup
          name="when"
          legend="Quando foi?"
          columns={2}
          value={choice}
          onChange={(v) => {
            setChoice(v);
            if (error) setError(null);
          }}
          options={[
            { value: "now", label: "Agora há pouco" },
            { value: "today", label: "Hoje" },
            { value: "yesterday", label: "Ontem" },
            { value: "other", label: "Outro dia" },
          ]}
        />
      </Shake>
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
      <FieldMessage id="erro-quando" message={error} />
      <Nav busy={busy} onBack={onBack} />
    </form>
  );
}

function DetailsStep({
  lostCase,
  busy,
  onBack,
  onNext,
  onInvalid,
}: {
  lostCase: LostCase;
  busy: boolean;
  onBack?: () => void;
  onNext: (patch: LostCasePatch) => void;
  onInvalid?: OnInvalid;
}) {
  const [wearing, setWearing] = useState<Wearing[]>(lostCase.wearing);
  const [notes, setNotes] = useState(lostCase.notes ?? "");
  const { error, attempt, setError } = useStepError(onInvalid);
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
      {/* Observações do alerta: mesmo campo livre e público da descrição do pet (componente compartilhado). */}
      <Shake attempt={attempt}>
        <PublicDescriptionField
          id="notes"
          label="Algo importante?"
          guidance="Conte o que ajuda quem estiver procurando: comportamento (ex.: é medroso e foge de gente, atende pelo nome), condições especiais (precisa de remédio) e referências de onde foi visto ou desapareceu."
          placeholder="Ex.: é dócil, mas pode ficar assustado e se esconder. Foi visto pela última vez próximo à praça do bairro."
          value={notes}
          onChange={(v) => {
            setNotes(v);
            if (error) setError(null);
          }}
          error={error ?? undefined}
          className="block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 focus:border-focus focus:outline-none"
        />
      </Shake>
      <Nav busy={busy} onBack={onBack} />
    </form>
  );
}

function ContactStep({
  lostCase,
  busy,
  onBack,
  onNext,
  onInvalid,
  submitLabel,
}: {
  lostCase: LostCase;
  busy: boolean;
  onBack?: () => void;
  onNext: (patch: LostCasePatch) => void;
  onInvalid?: OnInvalid;
  submitLabel?: string;
}) {
  const [chat, setChat] = useState(lostCase.contactChat);
  const [whatsapp, setWhatsapp] = useState(lostCase.contactWhatsappPublic);
  const [phonePublic, setPhonePublic] = useState(lostCase.contactPhonePublic);
  const [phone, setPhone] = useState(lostCase.contactPhone ? formatBrPhone(lostCase.contactPhone) : "");
  const { error, attempt, setError } = useStepError(onInvalid);
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
          setError(fieldErrors(parsed.error).contactPhone ?? null);
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
        <Shake attempt={attempt}>
          <TextField
            label="Seu celular com DDD"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 98765-4321"
            value={phone}
            onChange={(e) => {
              setPhone(formatPhoneInput(e.target.value));
              if (error) setError(null);
            }}
            error={error ?? undefined}
          />
        </Shake>
      )}
      <Alert tone="info">
        <strong>Cuidado com golpes.</strong> Desconfie de quem pedir PIX ou dinheiro antes de mostrar o animal. A MEL nunca
        pede pagamento.
      </Alert>
      <Nav busy={busy} onBack={onBack}>
        {submitLabel ?? "Continuar"}
      </Nav>
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
