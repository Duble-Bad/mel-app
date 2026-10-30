"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportableTarget, type ReportReason, userErrorMessage } from "@mel/core";
import { ensureSession, reportContent } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";
import { TextareaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const TITLES: Record<ReportableTarget, string> = {
  lost_case: "Denunciar este alerta",
  found_case: "Denunciar esta publicação",
  sighting: "Denunciar este avistamento",
  adoption: "Denunciar este anúncio",
  business: "Denunciar este parceiro",
};

/** "Denunciar" em 1 toque, em qualquer conteúdo público. Funciona sem conta. */
export function ReportButton({ type, targetKey, compact = false }: { type: ReportableTarget; targetKey: string; compact?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason) {
      setError("Escolha o motivo da denúncia.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = getBrowserClient();
      await ensureSession(client);
      await reportContent(client, { type, key: targetKey }, { reason, details: details.trim() || null });
      setOpen(false);
      setReason(null);
      setDetails("");
      toast({ tone: "success", title: "Denúncia enviada.", description: "A equipe da MEL vai analisar. Obrigado por proteger a rede." });
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos enviar agora. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-md font-semibold text-text-secondary underline-offset-4 hover:text-status-lost hover:underline ${
          compact ? "min-h-11 text-sm" : "min-h-11 px-1 text-sm"
        }`}
      >
        <Flag aria-hidden="true" className="size-4" strokeWidth={2} />
        Denunciar
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={TITLES[type]}
        description="A equipe da MEL analisa. Quem publicou não fica sabendo quem denunciou."
      >
        <ChoiceGroup
          name={`report-${type}`}
          legend="O que está errado?"
          columns={1}
          value={reason}
          onChange={(v) => {
            setReason(v);
            setError(null);
          }}
          options={REPORT_REASONS.map((r) => ({ value: r, label: REPORT_REASON_LABELS[r] }))}
        />
        <TextareaField label="Detalhes" optional rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button variant="danger" onClick={submit} loading={busy} loadingText="Enviando…">
          Enviar denúncia
        </Button>
      </BottomSheet>
    </>
  );
}
