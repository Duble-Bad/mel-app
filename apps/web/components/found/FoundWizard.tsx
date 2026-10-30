"use client";

import { Camera, Lock, X } from "lucide-react";
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
import { TextareaField, TextField } from "@/components/ui/Field";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { Turnstile, useCaptchaToken } from "@/components/ui/Turnstile";

type Step = "photo" | "where" | "when" | "looks" | "now" | "review";
const STEPS: Step[] = ["photo", "where", "when", "looks", "now", "review"];
const STEP_LABEL: Record<Step, string> = {
  photo: "Foto",
  where: "Onde",
  when: "Quando",
  looks: "Como ele é",
  now: "Onde está agora",
  review: "Publicar",
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

  const index = STEPS.indexOf(step);
  const go = (s: Step) => {
    setStep(s);
    setErrors({});
    setError(null);
    window.scrollTo({ top: 0 });
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
    setBusy("Confirmando que você não é um robô…");
    const token = await captcha.waitForToken();
    if (!token) {
      setBusy(null);
      setError("Não conseguimos confirmar que você não é um robô. Verifique a conexão e tente de novo.");
      captcha.reset();
      return;
    }
    const supabase = getBrowserClient();
    try {
      setBusy("Publicando…");
      const user = await ensureSession(supabase);
      let photoPath: string | null = null;
      if (photo) {
        setBusy("Enviando foto…");
        try {
          photoPath = await uploadSightingPhoto(supabase, user.id, await prepareImage(photo));
        } catch (err) {
          console.error("[FoundWizard] foto falhou", err);
          setError("A foto não foi enviada, mas vamos publicar mesmo assim.");
        }
      }
      setBusy("Publicando e procurando no Radar MEL…");
      const res = await fetch("/api/encontrados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, photoPath, turnstileToken: token }),
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-caption font-semibold tracking-[.08em] text-link uppercase">{title}</p>
        <ProgressSteps current={index + 1} total={STEPS.length} label={STEP_LABEL[step]} />
      </div>

      {step === "photo" && (
        <section className="flex animate-enter flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold">Tem uma foto dele?</h1>
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
        <section className="flex animate-enter flex-col gap-5">
          <h1 className="text-2xl font-bold">{sawOnly ? "Onde você viu?" : "Onde você encontrou?"}</h1>
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
        <section className="flex animate-enter flex-col gap-5">
          <h1 className="text-2xl font-bold">Quando foi?</h1>
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
            <TextField label="Data e hora" type="datetime-local" value={other} max={new Date().toISOString().slice(0, 16)} onChange={(e) => setOther(e.target.value)} />
          )}
          <Nav onBack={() => go("where")} onNext={() => next(["foundAt"])} />
        </section>
      )}

      {step === "looks" && (
        <section className="flex animate-enter flex-col gap-6">
          <h1 className="text-2xl font-bold">Como ele é?</h1>
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
        <section className="flex animate-enter flex-col gap-6">
          <h1 className="text-2xl font-bold">Onde ele está agora?</h1>
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
        <section className="flex animate-enter flex-col gap-5">
          <h1 className="text-2xl font-bold">Confira e publique</h1>
          <dl className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {[
              ["Foto", photo ? "Sim" : "Sem foto"],
              ["Onde", where ? (publicAreaFrom(where) ?? "Local marcado no mapa") + " (aproximado)" : "—"],
              ["Quando", when ? formatDateTimeBr(seenAtFrom(when, other) ?? new Date().toISOString()) : "—"],
              [
                "Como é",
                [species && SPECIES_LABELS[species], size && SIZE_LABELS[size].label, color && colorLabel(color), sex !== "unknown" && SEX_LABELS[sex], breed]
                  .filter(Boolean)
                  .join(" · "),
              ],
              ["Agora", custody ? FOUND_CUSTODY_LABELS[custody] : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 p-3">
                <dt className="text-sm text-text-secondary">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-text-secondary">
            Ao publicar, o Radar MEL procura na hora alertas de pets perdidos parecidos e avisa você e o tutor. Não precisa
            criar conta: as respostas aparecem aqui, neste aparelho.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <div data-testid="captcha-state" data-state={captcha.token ? "ok" : "pending"}>
            <Turnstile key={captcha.key} onToken={captcha.setToken} onError={setError} />
          </div>
          <Button onClick={publish} loading={Boolean(busy)} loadingText={busy}>
            Publicar
          </Button>
          <Button variant="ghost" onClick={() => go("now")} disabled={Boolean(busy)}>
            Voltar
          </Button>
        </section>
      )}
    </div>
  );
}

function Nav({ onBack, onNext, nextLabel = "Continuar" }: { onBack?: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      <Button onClick={onNext}>{nextLabel}</Button>
      {onBack && (
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
      )}
    </div>
  );
}
