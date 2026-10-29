"use client";

import { BellRing, Info, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { DAILY_LIMITS, fieldErrors, GUARDIAN_RADII_M, guardianSettingsSchema, publicAreaFrom, radiusLabel, type GuardianRadius, type GuardianSettings } from "@mel/core";
import { saveGuardianSettings } from "@mel/data";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push/client";
import { getBrowserClient } from "@/lib/supabase/browser";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/FilterChip";
import { Card } from "@/components/ui/Surface";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";

/** Configuração do Guardião MEL + avisos no celular deste aparelho. */
export function GuardianForm({ userId, initial }: { userId: string; initial: GuardianSettings | null }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [area, setArea] = useState<PickedLocation | null>(initial ? { position: initial.area, label: initial.areaLabel ?? undefined, source: "map" } : null);
  const [radiusM, setRadiusM] = useState<GuardianRadius>(initial?.radiusM ?? 3000);
  const [alertLost, setAlertLost] = useState(initial?.alertLost ?? true);
  const [alertFound, setAlertFound] = useState(initial?.alertFound ?? true);
  const [maxPerDay, setMaxPerDay] = useState(initial?.maxPerDay ?? 5);
  const [quietNight, setQuietNight] = useState(initial?.quietNight ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial));

  async function save() {
    const parsed = guardianSettingsSchema.safeParse({
      enabled,
      area: area?.position,
      areaLabel: area ? (publicAreaFrom(area) ?? area.label ?? null) : null,
      radiusM,
      alertLost,
      alertFound,
      maxPerDay,
      quietNight,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setError(null);
    setSaving(true);
    try {
      await saveGuardianSettings(getBrowserClient(), userId, parsed.data);
      toast({ tone: "success", title: saved ? "Preferências salvas." : "Pronto! Você é um Guardião MEL.", description: enabled ? "Vamos avisar quando um pet precisar de ajuda perto de você." : "Avisos pausados." });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 bg-surface-warm">
        <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold">Seja um Guardião MEL</h1>
          <p className="text-text-secondary">
            Receba um aviso quando um pet se perder — ou for encontrado — perto de você. Você escolhe a área, o raio e quantos
            avisos por dia.
          </p>
        </div>
      </Card>

      {saved && <Switch checked={enabled} onChange={setEnabled} label="Guardião ativo" description="Desligue para pausar todos os avisos." />}

      <section aria-labelledby="area" className="flex flex-col gap-3">
        <h2 id="area" className="text-xl font-bold">
          Área que você quer proteger
        </h2>
        <LocationPicker value={area} onChange={setArea} privacyNote="Guardamos só uma área aproximada (cerca de 250 m). Ninguém vê onde você mora." />
        {errors.area && <p className="text-sm font-medium text-danger">{errors.area}</p>}
      </section>

      <section aria-labelledby="raio" className="flex flex-col gap-3">
        <h2 id="raio" className="font-semibold">
          Raio dos avisos
        </h2>
        <div className="flex flex-wrap gap-2">
          {GUARDIAN_RADII_M.map((r) => (
            <FilterChip key={r} pressed={radiusM === r} onClick={() => setRadiusM(r)}>
              {radiusLabel(r)}
            </FilterChip>
          ))}
        </div>
      </section>

      <section aria-labelledby="tipos" className="flex flex-col gap-4">
        <h2 id="tipos" className="font-semibold">
          Quero ser avisado sobre
        </h2>
        <Switch checked={alertLost} onChange={setAlertLost} label="Pets perdidos" description="Um tutor acabou de ativar um alerta perto de você." />
        <Switch checked={alertFound} onChange={setAlertFound} label="Encontrados e vistos soltos" description="Alguém encontrou ou viu um animal sozinho na rua." />
        {errors.alertLost && <p className="text-sm font-medium text-danger">{errors.alertLost}</p>}
      </section>

      <section aria-labelledby="limite" className="flex flex-col gap-3">
        <h2 id="limite" className="font-semibold">
          No máximo, por dia
        </h2>
        <div className="flex flex-wrap gap-2">
          {DAILY_LIMITS.map((n) => (
            <FilterChip key={n} pressed={maxPerDay === n} onClick={() => setMaxPerDay(n)}>
              {n} avisos
            </FilterChip>
          ))}
        </div>
        <Switch checked={quietNight} onChange={setQuietNight} label="Silêncio à noite (22h–7h)" description="O aviso fica no app, mas o celular não toca." />
      </section>

      {error && <Alert tone="error">{error}</Alert>}
      <Button onClick={save} loading={saving} loadingText="Salvando…">
        {saved ? "Salvar preferências" : "Quero ser Guardião"}
      </Button>

      <PushCard />
    </div>
  );
}

/** Avisos no celular deste aparelho (Web Push). */
function PushCard() {
  const toast = useToast();
  const [state, setState] = useState<PushState | "checking">("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  async function toggle(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (on) await enablePush();
      else await disablePush();
      setState(on ? "on" : "off");
      toast({ tone: "success", title: on ? "Avisos ativados neste aparelho." : "Avisos desativados neste aparelho." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos mudar agora.");
      setState(await getPushState().catch(() => "unsupported" as const));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3" aria-labelledby="push-titulo">
      <h2 id="push-titulo" className="flex items-center gap-2 font-semibold">
        <Smartphone aria-hidden="true" className="size-5 text-brand" strokeWidth={1.75} /> Avisos no celular
      </h2>
      {state === "checking" && <p className="text-sm text-text-secondary">Verificando este aparelho…</p>}
      {state === "unsupported" && (
        <p className="flex gap-2 text-sm text-text-secondary">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          Este navegador não recebe notificações. No iPhone, abra a MEL no Safari e use “Adicionar à Tela de Início”. Os
          avisos continuam aparecendo no sininho do app.
        </p>
      )}
      {state === "denied" && (
        <p className="text-sm text-text-secondary">
          As notificações estão bloqueadas para a MEL neste navegador. Libere nas configurações do site e volte aqui. Os avisos
          continuam no sininho do app.
        </p>
      )}
      {state === "off" && (
        <>
          <p className="text-sm text-text-secondary">Sem isso, você só vê os avisos quando abrir a MEL.</p>
          <Button variant="secondary" size="md" onClick={() => toggle(true)} loading={busy} loadingText="Ativando…">
            <BellRing aria-hidden="true" className="size-4" strokeWidth={2} /> Receber avisos neste celular
          </Button>
        </>
      )}
      {state === "on" && (
        <>
          <p className="text-sm font-medium text-status-found">Ativado neste aparelho.</p>
          <Button variant="ghost" size="md" onClick={() => toggle(false)} loading={busy} loadingText="Desativando…">
            Desativar neste aparelho
          </Button>
        </>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}
