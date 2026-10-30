"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actionsFor, type ReportAction, type ReportTargetType, userErrorMessage } from "@mel/core";
import { moderate } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { TextareaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const COPY: Record<ReportAction, { button: string; title: string; text: string; confirm: string; done: string }> = {
  hide: {
    button: "Ocultar conteúdo",
    title: "Ocultar este conteúdo?",
    text: "Ele deixa de aparecer para o público. Todas as denúncias abertas sobre ele serão encerradas.",
    confirm: "Sim, ocultar",
    done: "Conteúdo ocultado.",
  },
  suspend: {
    button: "Suspender autor",
    title: "Suspender a conta do autor?",
    text: "A pessoa não poderá publicar alertas, avistamentos, encontrados nem mandar mensagens.",
    confirm: "Sim, suspender",
    done: "Autor suspenso.",
  },
  dismiss: {
    button: "Descartar",
    title: "Descartar a denúncia?",
    text: "O conteúdo continua público. Use quando a denúncia não procede.",
    confirm: "Sim, descartar",
    done: "Denúncia descartada.",
  },
};

/** Ações sobre uma denúncia, sempre com confirmação e motivo opcional (vai para a auditoria). */
export function ModerationActions({ reportId, targetType, authorSuspended }: { reportId: string; targetType: ReportTargetType; authorSuspended: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<ReportAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await moderate(getBrowserClient(), reportId, pending, reason.trim() || undefined);
      toast({ tone: "success", title: COPY[pending].done });
      setPending(null);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos aplicar agora."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actionsFor(targetType)
          .filter((a) => !(a === "suspend" && authorSuspended))
          .map((a) => (
            <Button
              key={a}
              size="md"
              variant={a === "dismiss" ? "ghost" : a === "hide" ? "danger" : "secondary"}
              className="w-auto"
              onClick={() => {
                setError(null);
                setPending(a);
              }}
            >
              {COPY[a].button}
            </Button>
          ))}
      </div>
      <BottomSheet open={pending !== null} onClose={() => setPending(null)} title={pending ? COPY[pending].title : ""} description={pending ? COPY[pending].text : undefined}>
        <TextareaField label="Motivo (fica na auditoria)" optional rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button variant={pending === "dismiss" ? "primary" : "danger"} onClick={confirm} loading={busy} loadingText="Aplicando…">
          {pending ? COPY[pending].confirm : ""}
        </Button>
        <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
          Cancelar
        </Button>
      </BottomSheet>
    </>
  );
}
