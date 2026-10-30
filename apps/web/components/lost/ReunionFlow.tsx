"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MapPin } from "lucide-react";
import { useState } from "react";
import { describeSighting, fieldErrors, formatDateTimeBr, FOUND_HOW, FOUND_HOW_LABELS, type FoundHow, reunionSchema, timeAgo, type TimelineSighting, userErrorMessage } from "@mel/core";
import { confirmReunion } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";
import { TextareaField, TextField } from "@/components/ui/Field";
import { ProgressSteps } from "@/components/ui/ProgressSteps";

type Step = "confirm" | "how" | "clue" | "details";

interface ReunionFlowProps {
  code: string;
  petName: string;
  photoUrl: string | null;
  sightings: TimelineSighting[];
}

/** R1–R4: confirmar → como foi encontrado → pista que ajudou → onde/história. */
export function ReunionFlow({ code, petName, photoUrl, sightings }: ReunionFlowProps) {
  const router = useRouter();
  const steps: Step[] = sightings.length ? ["confirm", "how", "clue", "details"] : ["confirm", "how", "details"];
  const [step, setStep] = useState<Step>("confirm");
  const [how, setHow] = useState<FoundHow | null>(null);
  const [clue, setClue] = useState<string>("none");
  const [area, setArea] = useState("");
  const [story, setStory] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const index = steps.indexOf(step);
  const go = (s: Step) => {
    setStep(s);
    setError(null);
    window.scrollTo({ top: 0 });
  };
  const next = () => go(steps[index + 1]!);
  const back = () => go(steps[index - 1]!);

  async function submit() {
    const parsed = reunionSchema.safeParse({
      how: how ?? undefined,
      helpfulSightingId: clue === "none" ? null : clue,
      foundAreaLabel: area,
      story,
    });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      if (errs.how) go("how");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmReunion(getBrowserClient(), code, parsed.data);
      router.replace(`/alerta/${code}?reencontro=1`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos confirmar agora. Verifique a conexão e tente de novo."));
      setBusy(false);
    }
  }

  if (step === "confirm") {
    return (
      <div className="flex animate-enter flex-col items-center gap-6 pt-4 text-center">
        <div className="relative">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto já otimizada no upload (Supabase Storage)
            <img src={photoUrl} alt={`Foto de ${petName}`} className="size-32 rounded-full object-cover ring-4 ring-status-found-soft" />
          ) : (
            <span className="flex size-32 items-center justify-center rounded-full bg-status-found-soft text-status-found">
              <Heart aria-hidden="true" className="size-12" strokeWidth={1.75} />
            </span>
          )}
          <span className="absolute -right-1 -bottom-1 flex size-11 items-center justify-center rounded-full bg-status-found-solid text-text-inverse ring-4 ring-background">
            <Heart aria-hidden="true" className="size-5" fill="currentColor" strokeWidth={0} />
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Que notícia maravilhosa!</h1>
          <p className="text-body-lg text-text-secondary">Vamos confirmar que {petName} está em casa?</p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Button onClick={next}>Sim, {petName} está em casa</Button>
          <ButtonLink href={`/alerta/${code}`} variant="secondary">
            Ainda não
          </ButtonLink>
        </div>
      </div>
    );
  }

  const stepNumber = index; // "confirm" não conta como passo do formulário
  const totalSteps = steps.length - 1;

  return (
    <div className="flex animate-enter flex-col gap-6">
      <ProgressSteps current={stepNumber} total={totalSteps} />

      {step === "how" && (
        <>
          <h1 className="text-2xl font-bold">Como {petName} voltou para casa?</h1>
          <ChoiceGroup
            name="found-how"
            legend="Escolha a opção que mais se parece"
            columns={2}
            value={how}
            onChange={(v) => {
              setHow(v);
              setErrors({});
            }}
            error={errors.how}
            options={FOUND_HOW.map((h) => ({ value: h, label: FOUND_HOW_LABELS[h] }))}
          />
          <Nav onBack={back} onNext={() => (how ? next() : setErrors({ how: "Conte como foi o reencontro." }))} />
        </>
      )}

      {step === "clue" && (
        <>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold">Alguma pista ajudou?</h1>
            <p className="text-text-secondary">Quem enviou a pista recebe um agradecimento especial. É opcional.</p>
          </div>
          <div role="radiogroup" aria-label="Pista que ajudou" className="flex flex-col gap-2">
            {[{ id: "none" } as const, ...sightings].map((s) => {
              const selected = clue === s.id;
              const sighting = s.id === "none" ? null : (s as TimelineSighting);
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setClue(s.id)}
                  className={`flex min-h-14 items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors duration-200 ${
                    selected ? "border-focus bg-primary-soft" : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-border-strong"}`}
                  >
                    {selected && <span className="size-2.5 rounded-full bg-primary" />}
                  </span>
                  {sighting ? (
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{describeSighting(sighting)}</span>
                      <span className="text-sm text-text-secondary">
                        {formatDateTimeBr(sighting.seenAt)} · {timeAgo(sighting.seenAt)}
                      </span>
                      {sighting.placeLabel && (
                        <span className="mt-0.5 flex items-center gap-1 text-sm text-text-secondary">
                          <MapPin aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
                          perto de {sighting.placeLabel}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="font-semibold">Nenhuma pista específica</span>
                  )}
                </button>
              );
            })}
          </div>
          <Nav onBack={back} onNext={next} />
        </>
      )}

      {step === "details" && (
        <>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold">Quer contar mais?</h1>
            <p className="text-text-secondary">Tudo opcional. Aparece na página do alerta para quem ajudou.</p>
          </div>
          <TextField
            label="Onde estava?"
            optional
            hint="Só o bairro ou um ponto de referência. Nada de endereço."
            placeholder="Ex.: Liberdade, perto da praça"
            value={area}
            maxLength={120}
            onChange={(e) => setArea(e.target.value)}
            error={errors.foundAreaLabel}
          />
          <TextareaField
            label="A história do reencontro"
            optional
            rows={4}
            maxLength={2000}
            placeholder="Conte como foi. Isso dá esperança para quem ainda está procurando."
            value={story}
            onChange={(e) => setStory(e.target.value)}
            error={errors.story}
          />
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-col gap-3">
            <Button onClick={submit} loading={busy} loadingText="Confirmando…">
              Confirmar reencontro
            </Button>
            <Button variant="ghost" onClick={back} disabled={busy}>
              Voltar
            </Button>
          </div>
        </>
      )}

      <p className="text-center text-sm">
        <Link href={`/alerta/${code}`} className="font-semibold text-link underline-offset-4 hover:underline">
          Cancelar e voltar ao alerta
        </Link>
      </p>
    </div>
  );
}

function Nav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={onNext}>Continuar</Button>
      <Button variant="ghost" onClick={onBack}>
        Voltar
      </Button>
    </div>
  );
}
