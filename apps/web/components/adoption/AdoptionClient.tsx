"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldErrors, type Housing, HOUSING, HOUSING_LABELS, interestSchema, userErrorMessage } from "@mel/core";
import { setAdoptionStatus, submitAdoptionInterest } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";
import { TextareaField } from "@/components/ui/Field";
import { FilterChip } from "@/components/ui/FilterChip";
import { useToast } from "@/components/ui/Toast";

/** "Quero adotar": algumas perguntas + apresentação; abre a conversa com quem doa. */
export function InterestForm({ code, petName }: { code: string; petName: string }) {
  const router = useRouter();
  const [housing, setHousing] = useState<Housing | null>(null);
  const [otherPets, setOtherPets] = useState<"yes" | "no" | null>(null);
  const [children, setChildren] = useState<"yes" | "no" | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = interestSchema.safeParse({
      housing: housing ?? undefined,
      otherPets: otherPets === null ? undefined : otherPets === "yes",
      children: children === null ? undefined : children === "yes",
      message,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      const conv = await submitAdoptionInterest(getBrowserClient(), code, parsed.data);
      router.push(`/conversas/${conv}`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos enviar agora. Tente de novo."));
      setBusy(false);
    }
  }

  const yesNo = [
    { value: "yes" as const, label: "Sim" },
    { value: "no" as const, label: "Não" },
  ];
  return (
    <div className="flex flex-col gap-6">
      <ChoiceGroup name="housing" legend="Onde você mora?" value={housing} onChange={setHousing} error={errors.housing} options={HOUSING.map((h) => ({ value: h, label: HOUSING_LABELS[h] }))} />
      <ChoiceGroup name="other-pets" legend="Já tem outros pets?" columns={2} value={otherPets} onChange={setOtherPets} error={errors.otherPets} options={yesNo} />
      <ChoiceGroup name="children" legend="Há crianças em casa?" columns={2} value={children} onChange={setChildren} error={errors.children} options={yesNo} />
      <TextareaField
        label={`Conte por que você quer adotar ${petName}`}
        rows={5}
        maxLength={1000}
        placeholder="Sua rotina, quem mora com você, experiência com animais…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        error={errors.message}
      />
      <p className="text-sm text-text-secondary">Suas respostas vão como primeira mensagem para quem está doando. Seu telefone não aparece.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <Button onClick={submit} loading={busy} loadingText="Enviando…">
        Enviar interesse
      </Button>
    </div>
  );
}

const STATUSES = [
  { value: "AVAILABLE", label: "Disponível" },
  { value: "IN_PROCESS", label: "Em processo" },
  { value: "ADOPTED", label: "Adotado" },
] as const;

/** Quem doa: muda o status do anúncio (disponível / em processo / adotado). */
export function AdoptionStatusControls({ code, status }: { code: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(next: (typeof STATUSES)[number]["value"]) {
    if (next === status) return;
    setBusy(true);
    setError(null);
    try {
      await setAdoptionStatus(getBrowserClient(), code, next);
      toast({ tone: "success", title: next === "ADOPTED" ? "Que alegria! Marcado como adotado." : "Status atualizado." });
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos atualizar."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Status do anúncio">
        {STATUSES.map((s) => (
          <FilterChip key={s.value} pressed={status === s.value} disabled={busy} onClick={() => change(s.value)}>
            {s.label}
          </FilterChip>
        ))}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
