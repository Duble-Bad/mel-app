"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  DIRECTION_LABELS,
  fieldErrors,
  SEEN_WHEN,
  SEEN_WHEN_LABELS,
  seenAtFrom,
  SIGHTING_STATE_LABELS,
  SIGHTING_STATES,
  sightingInputSchema,
  type Direction,
  type SeenWhen,
  type SightingState,
} from "@mel/core";
import { ensureSession, uploadSightingPhoto } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { prepareImage } from "@/lib/images";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { Alert } from "@/components/ui/Alert";
import { ChoiceGroup, MultiChoiceGroup } from "@/components/ui/Choice";
import { TextField } from "@/components/ui/Field";
import { Turnstile } from "@/components/ui/Turnstile";

// Rosa dos ventos: Norte em cima, Oeste à esquerda… "Não sei" no centro.
const COMPASS: (Direction | null)[] = [null, "N", null, "W", "unknown", "E", null, "S", null];

export function SightingForm({ code, petName }: { code: string; petName: string }) {
  const [where, setWhere] = useState<PickedLocation | null>(null);
  const [when, setWhen] = useState<SeenWhen | null>(null);
  const [other, setOther] = useState("");
  const [direction, setDirection] = useState<Direction>("unknown");
  const [states, setStates] = useState<SightingState[]>([]);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const setToken = (t: string | null) => {
    tokenRef.current = t;
    setTokenState(t);
  };

  /** A verificação antirrobô costuma levar 1–2 s: espera por ela em vez de dar erro. */
  async function waitForToken(timeoutMs = 15_000): Promise<string | null> {
    const started = Date.now();
    while (!tokenRef.current && Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return tokenRef.current;
  }
  const [captchaKey, setCaptchaKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setError(null);
    const parsed = sightingInputSchema.safeParse({
      code,
      position: where?.position,
      placeLabel: where?.label ?? null,
      seenAt: when ? seenAtFrom(when, other) : undefined,
      direction,
      states,
      notes,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setError("Falta pouco: confira os campos destacados.");
      return;
    }
    setErrors({});
    setBusy("Confirmando que você não é um robô…");
    const captcha = await waitForToken();
    if (!captcha) {
      setBusy(null);
      setError("Não conseguimos confirmar que você não é um robô. Verifique a conexão e toque em enviar de novo.");
      setCaptchaKey((k) => k + 1);
      return;
    }

    const supabase = getBrowserClient();
    try {
      // Sem cadastro: uma sessão anônima identifica o envio (sem pedir dados).
      setBusy("Enviando…");
      const user = await ensureSession(supabase);
      let photoPath: string | null = null;
      if (photo) {
        setBusy("Enviando foto…");
        try {
          photoPath = await uploadSightingPhoto(supabase, user.id, await prepareImage(photo));
        } catch (err) {
          console.error("[SightingForm] foto falhou", err);
          setError("A foto não foi enviada, mas vamos mandar o avistamento mesmo assim.");
        }
      }
      setBusy("Enviando…");
      const res = await fetch("/api/avistamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, photoPath, turnstileToken: captcha }),
      });
      if (!res.ok) {
        const { error: message } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(message ?? "Não conseguimos enviar agora. Tente de novo.");
      }
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos enviar agora. Tente de novo.");
      // Token do captcha é de uso único: gera outro para a próxima tentativa.
      setToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success">
          <strong>Obrigado!</strong> O tutor já foi avisado. Cada pista aproxima {petName} de casa.
        </Alert>
        <Link
          href={`/alerta/${code}#linha-do-tempo`}
          className="inline-flex min-h-14 items-center justify-center rounded-md bg-brand-primary px-5 text-lg font-semibold text-brand-on-primary"
        >
          Ver o alerta e a linha do tempo
        </Link>
        <p className="text-text-secondary">Se vir de novo, envie outro avistamento — horários diferentes ajudam a entender o caminho.</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error && <Alert tone="error">{error}</Alert>}

      <section className="flex flex-col gap-2" aria-labelledby="onde">
        <h2 id="onde" className="text-lg font-bold">
          Onde você viu?
        </h2>
        <LocationPicker
          value={where}
          onChange={(v) => {
            setWhere(v);
            setErrors((e) => ({ ...e, position: "" }));
          }}
          privacyNote="O local que você marcar aparece no alerta. Seus dados pessoais, não."
        />
        {errors.position && <p className="font-medium text-danger">{errors.position}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <ChoiceGroup
          name="when"
          legend="Quando?"
          columns={2}
          value={when}
          onChange={setWhen}
          error={errors.seenAt}
          options={SEEN_WHEN.map((w) => ({ value: w, label: SEEN_WHEN_LABELS[w] }))}
        />
        {when === "other" && (
          <TextField label="Dia e hora aproximados" type="datetime-local" value={other} onChange={(e) => setOther(e.target.value)} />
        )}
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-semibold">
          Para onde ele ia? <span className="font-normal text-text-secondary">(opcional)</span>
        </legend>
        <div className="mx-auto grid w-full max-w-64 grid-cols-3 gap-2">
          {COMPASS.map((d, i) =>
            d ? (
              <label
                key={d}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-border-strong bg-surface text-center has-[:checked]:border-brand-primary has-[:checked]:bg-brand-secondary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
              >
                <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} className="sr-only" />
                <span aria-hidden="true" className="text-2xl">
                  {DIRECTION_LABELS[d].arrow}
                </span>
                <span className="text-sm font-semibold">{DIRECTION_LABELS[d].label}</span>
              </label>
            ) : (
              <span key={`empty-${i}`} aria-hidden="true" />
            ),
          )}
        </div>
      </fieldset>

      <MultiChoiceGroup
        name="states"
        legend="Como ele estava?"
        optional
        columns={2}
        values={states}
        onChange={setStates}
        options={SIGHTING_STATES.map((s) => ({ value: s, label: SIGHTING_STATE_LABELS[s] }))}
      />

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold">
          Foto <span className="font-normal text-text-secondary">(opcional)</span>
        </span>
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-strong font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
          <span aria-hidden="true">📷</span> {photo ? `Foto escolhida: ${photo.name}` : "Tirar ou escolher foto"}
          <input type="file" accept="image/*" className="sr-only" aria-label="Foto do avistamento" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sighting-notes" className="font-semibold">
          Mais alguma coisa? <span className="font-normal text-text-secondary">(opcional)</span>
        </label>
        <textarea
          id="sighting-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: entrou num terreno; estava perto do ponto de ônibus."
          className="block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 focus:border-focus focus:outline-none"
        />
      </div>

      <div data-testid="captcha-state" data-state={token ? "ok" : "pending"}>
        <Turnstile key={captchaKey} onToken={setToken} onError={setError} />
      </div>

      <button
        type="submit"
        disabled={Boolean(busy)}
        aria-busy={Boolean(busy) || undefined}
        className="min-h-16 w-full rounded-lg bg-status-sighting px-5 text-xl font-extrabold tracking-wide text-text-inverse uppercase shadow-card disabled:opacity-60"
      >
        {busy ?? "Enviar avistamento"}
      </button>
      <p className="text-center text-sm text-text-secondary">Não precisa criar conta.</p>
    </form>
  );
}
