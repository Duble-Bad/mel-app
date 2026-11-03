"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportableTarget, type ReportReason, UserFacingError, userErrorMessage } from "@mel/core";
import { ensureSession } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";
import { TextareaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { takeCaptchaToken, Turnstile, useCaptchaToken } from "@/components/ui/Turnstile";

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
  const captcha = useCaptchaToken();

  async function submit() {
    if (!reason) {
      setError("Escolha o motivo da denúncia.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = getBrowserClient();
      // Sem cadastro: criar a sessão pede um token do captcha; a rota pede outro
      // (só para sessão anônima — conta real já passou pelo captcha ao entrar).
      const user = await ensureSession(client, { captchaToken: () => takeCaptchaToken(captcha) });
      const turnstileToken = user.is_anonymous ? await takeCaptchaToken(captcha) : null;
      const res = await fetch("/api/denuncias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, key: targetKey, reason, details: details.trim() || null, turnstileToken }),
      });
      if (!res.ok) {
        const { error: message } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new UserFacingError(message ?? "Não conseguimos enviar agora. Tente de novo.");
      }
      setOpen(false);
      setReason(null);
      setDetails("");
      toast({ tone: "success", title: "Denúncia enviada.", description: "A equipe da MEL vai analisar. Obrigado por proteger a rede." });
    } catch (err) {
      // O motivo e os detalhes ficam preenchidos para tentar de novo.
      setError(userErrorMessage(err, "Não conseguimos enviar agora. Tente de novo."));
      captcha.reset();
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
          options={REPORT_REASONS.map((r) => ({
            value: r,
            label: r === "fake" && type === "business" ? "Informação falsa sobre a empresa" : REPORT_REASON_LABELS[r],
          }))}
        />
        <TextareaField label="Detalhes" optional rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        {error && <Alert tone="error">{error}</Alert>}
        {/* Só monta com o painel aberto: ninguém carrega o Turnstile só por ver o botão. */}
        {open && <Turnstile key={captcha.key} onToken={captcha.setToken} onError={setError} />}
        <Button variant="danger" onClick={submit} loading={busy} loadingText="Enviando…">
          Enviar denúncia
        </Button>
      </BottomSheet>
    </>
  );
}
