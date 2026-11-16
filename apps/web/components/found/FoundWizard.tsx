"use client";

import { Camera, ClipboardCheck, Clock, Lock, MapPin, Navigation, PawPrint, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { colorLabel, fieldErrors, formatDateTimeBr, FOUND_CUSTODY, FOUND_CUSTODY_LABELS, type FoundCustody, foundInputSchema, PET_COLORS, PET_SEXES, PET_SIZES, type PetColor, type PetSex, type PetSize, publicAreaFrom, SEEN_WHEN, SEEN_WHEN_LABELS, seenAtFrom, type SeenWhen, SEX_LABELS, SIZE_LABELS, type Species, SPECIES, SPECIES_LABELS, userErrorMessage, UserFacingError } from "@mel/core";
import { ensureSession, uploadSightingPhoto } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { prepareImage } from "@/lib/images";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { BreedField } from "@/components/pets/BreedField";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";
import { DateTimeFields, isoDate } from "@/components/ui/DateCalendar";
import { TextareaField, TextField } from "@/components/ui/Field";
import { takeCaptchaToken, Turnstile, useCaptchaToken } from "@/components/ui/Turnstile";
import { MotionRoot, StepStage, type Direction } from "@/components/motion/Motion";
import { MotionSteps } from "@/components/motion/MotionSteps";
import type { StepState } from "@/components/ui/StepIndicator";

type Step = "photo" | "where" | "when" | "looks" | "now" | "review";
const STEPS: Step[] = ["photo", "where", "when", "looks", "now", "review"];
/** Nome curto e ícone de cada passo no indicador (mesmo padrão do alerta de perdido). */
const STEP_META: Record<Step, { label: string; icon: LucideIcon }> = {
  photo: { label: "Foto", icon: Camera },
  where: { label: "Onde", icon: MapPin },
  when: { label: "Quando", icon: Clock },
  looks: { label: "Como é", icon: PawPrint },
  now: { label: "Agora", icon: Navigation },
  review: { label: "Publicar", icon: ClipboardCheck },
};

/** E1–E7: foto → onde → quando → como é → onde está agora (+ detalhe privado) → publicar. */
export function FoundWizard({ sawOnly }: { sawOnly: boolean }) {
  const [step, setStep] = useState<Step>("photo");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [where, setWhere] = useState<PickedLocation | null>(null);
  const [when, setWhen] = useState<SeenWhen | null>(null);
  const [other, setOther] = useState("");
  const [species, setSpecies] = useState<Species | null>(null);
  const [size, setSize] = useState<PetSize | null>(null);
  const [color, setColor] = useState<PetColor | null>(null);
  const [sex, setSex] = useState<PetSex>("unknown");
  const [breed, setBreed] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [custody, setCustody] = useState<FoundCustody | null>(sawOnly ? "street" : null);
  const [custodyNotes, setCustodyNotes] = useState("");
  const [hint, setHint] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const captcha = useCaptchaToken();

  const previewRef = useRef<string | null>(null);
  function choosePhoto(file: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = file ? URL.createObjectURL(file) : null;
    setPhoto(file);
    setPreview(previewRef.current);
  }
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  // Sentido da última troca (a animação acompanha), se já houve troca (o foco só muda depois
  // disso) e se o passo atual está com erro de validação (o indicador mostra "com erro").
  const [direction, setDirection] = useState<Direction>("forward");
  const [moved, setMoved] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const index = STEPS.indexOf(step);
  const go = (s: Step) => {
    setDirection(STEPS.indexOf(s) < index ? "back" : "forward");
    setMoved(true);
    setInvalid(false);
    setStep(s);
    setErrors({});
    setError(null);
  };

  function draft() {
    return {
      species: species ?? undefined,
      size,
      sex,
      colorPrimary: color,
      breedGuess: breed ?? "",
      description,
      position: where?.position,
      areaLabel: where ? publicAreaFrom(where) : null,
      foundAt: when ? (seenAtFrom(when, other) ?? undefined) : undefined,
      custody: custody ?? undefined,
      custodyNotes,
      verificationHint: custody === "street" ? "" : hint,
    };
  }

  /** Valida só os campos do passo atual; avança se estiverem certos. */
  function next(fields: string[]) {
    const parsed = foundInputSchema.safeParse(draft());
    const errs: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);
    const mine = Object.fromEntries(Object.entries(errs).filter(([k]) => fields.includes(k)));
    if (Object.keys(mine).length) {
      setErrors(mine);
      setInvalid(true);
      return;
    }
    go(STEPS[index + 1]!);
  }

  async function publish() {
    const parsed = foundInputSchema.safeParse(draft());
    if (!parsed.success) {
      setError("Falta alguma informação. Volte e confira os passos.");
      return;
    }
    setError(null);
    const supabase = getBrowserClient();
    try {
      // Sessão sem cadastro: criá-la pede um token do captcha (quem já tem sessão não gasta).
      setBusy("Confirmando que você não é um robô…");
      await ensureSession(supabase, { captchaToken: () => takeCaptchaToken(captcha) });
      let photoPath: string | null = null;
      if (photo) {
        setBusy("Enviando foto…");
        try {
          photoPath = await uploadSightingPhoto(supabase, await prepareImage(photo));
        } catch (err) {
          console.error("[FoundWizard] foto falhou", err);
          setError("A foto não foi enviada, mas vamos publicar mesmo assim.");
        }
      }
      setBusy("Confirmando que você não é um robô…");
      const turnstileToken = await takeCaptchaToken(captcha);
      setBusy("Publicando e procurando no Radar MEL…");
      const res = await fetch("/api/encontrados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, photoPath, turnstileToken }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new UserFacingError(data.error ?? "Não conseguimos publicar agora. Tente de novo.");
      // Navegação completa: a sessão pode ter acabado de ser criada (anônima).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intencional, ver acima
      window.location.assign(`/encontrado/${data.code}?novo=1`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos publicar agora. Tente de novo."));
      captcha.reset();
      setBusy(null);
    }
  }

  const title = sawOnly ? "Vi um pet solto" : "Encontrei um pet";
  // Passos anteriores ficam concluídos (tocar volta a eles); o atual pode estar com erro.
  const states: StepState[] = STEPS.map((_, i) => (i < index ? "done" : i === index ? (invalid ? "error" : "current") : "pending"));
  // Resumo do que já foi preenchido: revisão (todas as telas) e prévia ao lado (telas largas).
  const summary = {
    where: where ? (publicAreaFrom(where) ?? "Local marcado no mapa") + " (aproximado)" : null,
    when: when ? formatDateTimeBr(seenAtFrom(when, other) ?? new Date().toISOString()) : null,
    looks: [species && SPECIES_LABELS[species], size && SIZE_LABELS[size].label, color && colorLabel(color), sex !== "unknown" && SEX_LABELS[sex], breed].filter(Boolean).join(" · ") || null,
    now: custody ? FOUND_CUSTODY_LABELS[custody] : null,
  };

  return (
    <MotionRoot
      variant="b"
      data-tone={sawOnly ? "sighting" : "found"}
      className="flex scroll-mt-20 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10"
      data-step-flow
    >
      {/* Telas largas: o passo num painel, com a prévia do anúncio ao lado (nada de coluna estreita no meio da tela). */}
      <div className="flex min-w-0 flex-col gap-6 lg:rounded-[28px] lg:border lg:border-border lg:bg-surface lg:p-10 lg:shadow-sm">
      <header className="flex flex-col gap-2">
        <p className="text-caption font-semibold tracking-[.08em] text-link uppercase">{title}</p>
        <MotionSteps
          steps={STEPS.map((k) => STEP_META[k])}
          states={states}
          onSelect={busy ? undefined : (i) => go(STEPS[i]!)}
          label={sawOnly ? "Passos do avistamento" : "Passos do pet encontrado"}
          variant="b"
          direction={direction}
        />
      </header>

      <StepStage stepKey={step} direction={direction} focus={moved}>
      <div className="flex flex-col gap-6">

      {step === "photo" && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 data-step-heading tabIndex={-1} className="text-2xl font-bold">Tem uma foto dele?</h1>
            <p className="text-text-secondary">A foto é o que mais ajuda o tutor a reconhecer. Se não tiver, tudo bem.</p>
          </div>
          {preview ? (
            <div className="relative self-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob) */}
              <img src={preview} alt="Foto escolhida" className="size-48 rounded-card object-cover shadow-sm" />
              <button
                type="button"
                onClick={() => choosePhoto(null)}
                aria-label="Remover foto"
                className="absolute -top-2 -right-2 inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface-elevated shadow-sm"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong bg-surface p-6 text-center transition-colors hover:bg-surface-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
              <Camera aria-hidden="true" className="size-8 text-brand" strokeWidth={1.75} />
              <span className="font-semibold">Tirar ou escolher foto</span>
              <span className="text-sm text-text-secondary">A localização da foto é removida antes do envio.</span>
              <input type="file" accept="image/*" className="sr-only" aria-label="Foto do animal" onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)} />
            </label>
          )}
          <Nav onNext={() => go("where")} nextLabel={photo ? "Continuar" : "Continuar sem foto"} />
        </section>
      )}

      {step === "where" && (
        <section className="flex flex-col gap-5">
          <h1 data-step-heading tabIndex={-1} className="text-2xl font-bold">{sawOnly ? "Onde você viu?" : "Onde você encontrou?"}</h1>
          <LocationPicker
            value={where}
            onChange={setWhere}
            privacyNote="O ponto exato fica privado. Publicamos só a região aproximada."
          />
          {errors.position && <p className="text-sm font-medium text-danger">{errors.position}</p>}
          <Nav onBack={() => go("photo")} onNext={() => next(["position"])} />
        </section>
      )}

      {step === "when" && (
        <section className="flex flex-col gap-5">
          <h1 data-step-heading tabIndex={-1} className="text-2xl font-bold">Quando foi?</h1>
          <ChoiceGroup
            name="found-when"
            legend="Escolha o mais próximo"
            columns={2}
            value={when}
            onChange={setWhen}
            error={errors.foundAt}
            options={SEEN_WHEN.map((w) => ({ value: w, label: SEEN_WHEN_LABELS[w] }))}
          />
          {when === "other" && (
            <DateTimeFields dateLabel="Em que dia?" value={other} max={isoDate(new Date())} onChange={setOther} />
          )}
          <Nav onBack={() => go("where")} onNext={() => next(["foundAt"])} />
        </section>
      )}

      {step === "looks" && (
        <section className="flex flex-col gap-6">
          <h1 data-step-heading tabIndex={-1} className="text-2xl font-bold">Como ele é?</h1>
          <ChoiceGroup
            name="found-species"
            legend="É um…"
            value={species}
            onChange={(v) => {
              setSpecies(v);
              setBreed(null);
            }}
            error={errors.species}
            options={SPECIES.map((s) => ({ value: s, label: SPECIES_LABELS[s] }))}
          />
          <ChoiceGroup
            name="found-size"
            legend="Porte"
            optional
            value={size}
            onChange={setSize}
            options={PET_SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s].label, hint: SIZE_LABELS[s].hint }))}
          />
          <ChoiceGroup
            name="found-color"
            legend="Cor principal"
            optional
            value={color}
            onChange={setColor}
            options={PET_COLORS.map((c) => ({ value: c.id, label: c.label }))}
          />
          <ChoiceGroup name="found-sex" legend="Sexo" value={sex} onChange={setSex} options={PET_SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))} />
          {species && species !== "other" && <BreedField species={species} value={breed} onChange={setBreed} />}
          <TextareaField
            label="Mais algum detalhe?"
            optional
            rows={3}
            maxLength={500}
            placeholder="Ex.: coleira azul, muito dócil, parece assustado."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Nav onBack={() => go("when")} onNext={() => next(["species", "description"])} />
        </section>
      )}

      {step === "now" && (
        <section className="flex flex-col gap-6">
          <h1 data-step-heading tabIndex={-1} className="text-2xl font-bold">Onde ele está agora?</h1>
          <ChoiceGroup
            name="found-custody"
            legend="Escolha uma opção"
            columns={1}
            value={custody}
            onChange={setCustody}
            error={errors.custody}
            options={FOUND_CUSTODY.map((c) => ({ value: c, label: FOUND_CUSTODY_LABELS[c] }))}
          />
          {custody && custody !== "street" && (
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-warm p-4">
              <p className="flex items-center gap-2 font-semibold">
                <Lock aria-hidden="true" className="size-4 text-brand" strokeWidth={2} /> Para conferir o tutor (privado)
              </p>
              <p className="text-sm text-text-secondary">
                Anote algo que só o verdadeiro tutor saberia, como uma mancha escondida ou uma cicatriz. Ninguém verá
                isso. Pergunte ao tutor antes de devolver e não conte a resposta.
              </p>
              <TextField label="Detalhe para conferir" optional placeholder="Ex.: mancha branca na barriga" maxLength={200} value={hint} onChange={(e) => setHint(e.target.value)} />
            </div>
          )}
          <TextareaField
            label="Observação sobre onde ele está"
            optional
            rows={2}
            maxLength={300}
            placeholder={custody === "street" ? "Ex.: estava indo em direção à praça." : "Ex.: está bem, comeu e bebeu água."}
            value={custodyNotes}
            onChange={(e) => setCustodyNotes(e.target.value)}
          />
          <Nav onBack={() => go("looks")} onNext={() => next(["custody", "custodyNotes", "verificationHint"])} />
        </section>
      )}

      {step === "review" && (
        <section className="flex flex-col gap-5">
          <h1 data-step-heading tabIndex={-1} className="text-2xl font-bold">Confira e publique</h1>
          <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-start">
          {preview ? (
            <figure className="flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-card border border-border bg-surface-muted shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob) */}
                <img src={preview} alt="Foto que vai no anúncio" className="aspect-[4/3] w-full object-cover" data-testid="review-photo" />
                <button
                  type="button"
                  onClick={() => go("photo")}
                  disabled={Boolean(busy)}
                  className="absolute right-3 bottom-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-background/85 px-3.5 text-sm font-semibold shadow-md backdrop-blur-md"
                >
                  <Camera aria-hidden="true" className="size-4" strokeWidth={2} /> Trocar foto
                </button>
              </div>
              <figcaption className="text-sm text-text-secondary">É esta foto que aparece no anúncio. A localização dela já foi removida.</figcaption>
            </figure>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-strong bg-surface p-5 text-center md:aspect-[4/3]">
              <Camera aria-hidden="true" className="size-7 text-text-muted" strokeWidth={1.75} />
              <span className="text-sm text-text-secondary">Sem foto. Com foto, o tutor reconhece mais rápido.</span>
              <Button variant="secondary" size="md" className="w-auto" onClick={() => go("photo")} disabled={Boolean(busy)}>
                Adicionar foto
              </Button>
            </div>
          )}
          <dl className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface lg:bg-background/40">
            {(
              [
                ["Onde", summary.where],
                ["Quando", summary.when],
                ["Como é", summary.looks],
                ["Agora", summary.now],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 p-3">
                <dt className="text-sm text-text-secondary">{k}</dt>
                <dd className="text-right font-semibold">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          </div>
          <p className="text-sm text-text-secondary">
            Ao publicar, o Radar MEL procura na hora alertas de pets perdidos parecidos e avisa você e o tutor. Não precisa
            criar conta: as respostas aparecem aqui, neste aparelho.
          </p>
        </section>
      )}
      </div>
      </StepStage>

      {/* Fora da troca animada: o captcha não pode ser desenhado duas vezes durante a transição. */}
      {step === "review" && (
        <section className="flex flex-col gap-5">
          {error && <Alert tone="error">{error}</Alert>}
          <div data-testid="captcha-state" data-state={captcha.token ? "ok" : "pending"}>
            <Turnstile key={captcha.key} onToken={captcha.setToken} onError={setError} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
            <Button className="sm:w-auto sm:min-w-52" onClick={publish} loading={Boolean(busy)} loadingText={busy}>
              Publicar
            </Button>
            <Button variant="ghost" className="sm:w-auto" onClick={() => go("now")} disabled={Boolean(busy)}>
              Voltar
            </Button>
          </div>
        </section>
      )}
      </div>

      <PreviewAside
        sawOnly={sawOnly}
        preview={preview}
        summary={summary}
        speciesLabel={species ? SPECIES_LABELS[species] : null}
        onPhoto={busy ? undefined : () => go("photo")}
      />
    </MotionRoot>
  );
}

/**
 * Telas largas: prévia do anúncio montando-se ao lado do passo (foto, como é, onde, quando) e o que
 * fica privado. Só decorativa para leitores de tela: a revisão diz tudo isso no último passo.
 */
function PreviewAside({
  sawOnly,
  preview,
  summary,
  speciesLabel,
  onPhoto,
}: {
  sawOnly: boolean;
  preview: string | null;
  summary: { where: string | null; when: string | null; looks: string | null; now: string | null };
  speciesLabel: string | null;
  onPhoto?: () => void;
}) {
  const rows = [
    { Icon: MapPin, value: summary.where, empty: "Onde" },
    { Icon: Clock, value: summary.when, empty: "Quando" },
    { Icon: Navigation, value: summary.now, empty: "Onde está agora" },
  ];
  return (
    <aside aria-hidden="true" className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-4">
      <p className="text-caption font-semibold tracking-[.08em] text-text-secondary uppercase">Prévia do anúncio</p>
      <div className="overflow-hidden rounded-[22px] border border-border bg-surface shadow-md">
        <div className="relative aspect-[4/3] bg-surface-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob)
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-2 text-text-muted">
              <PawPrint className="size-10" strokeWidth={1.5} />
              <span className="text-sm">Sem foto</span>
            </span>
          )}
          <span className="absolute top-3 left-3 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
            {sawOnly ? "Avistado" : "Encontrado"}
          </span>
          {onPhoto && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onPhoto}
              className="absolute right-3 bottom-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background/85 px-3 text-xs font-semibold shadow-md backdrop-blur-md"
            >
              <Camera className="size-3.5" strokeWidth={2} /> {preview ? "Trocar foto" : "Adicionar foto"}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2.5 p-4">
          <p className={`font-bold ${summary.looks ? "" : "text-text-muted"}`}>{summary.looks ?? speciesLabel ?? "Como ele é"}</p>
          {rows.map(({ Icon, value, empty }) => (
            <p key={empty} className={`flex items-start gap-2 text-sm ${value ? "text-text-secondary" : "text-text-muted"}`}>
              <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <span>{value ?? `${empty}: falta preencher`}</span>
            </p>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-2.5 rounded-[22px] border border-border p-4 text-sm text-text-secondary">
        <li className="flex gap-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} /> O ponto exato fica privado: publicamos só a região.
        </li>
        <li className="flex gap-2">
          <Camera className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} /> A localização gravada na foto é removida antes do envio.
        </li>
        <li className="flex gap-2">
          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} /> Não precisa criar conta: as respostas chegam neste aparelho.
        </li>
      </ul>
    </aside>
  );
}

/** Continuar e Voltar: empilhados no celular; lado a lado (Voltar à esquerda) em telas maiores. */
function Nav({ onBack, onNext, nextLabel = "Continuar" }: { onBack?: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex flex-col gap-3 pt-1 sm:flex-row-reverse sm:items-center sm:justify-between">
      <Button className="sm:w-auto sm:min-w-52" onClick={onNext}>
        {nextLabel}
      </Button>
      {onBack && (
        <Button variant="ghost" className="sm:w-auto" onClick={onBack}>
          Voltar
        </Button>
      )}
    </div>
  );
}
