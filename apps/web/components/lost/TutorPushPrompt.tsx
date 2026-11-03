"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { userErrorMessage } from "@mel/core";
import { enablePush, getPushState, type PushState } from "@/lib/push/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";

const DISMISS_KEY = "mel:tutor-push-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Para o tutor, no próprio alerta ativo: oferece avisos no celular quando chegar
 * uma pista. A permissão do navegador só é pedida ao tocar no botão; recusar não
 * muda nada no alerta (os avisos continuam no sininho).
 */
export function TutorPushPrompt() {
  const [state, setState] = useState<PushState | "checking" | "enabled">("checking");
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushState()
      .catch(() => "unsupported" as const)
      .then((s) => {
        setDismissed(readDismissed());
        setState(s);
      });
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sem armazenamento (aba anônima): some só nesta visita.
    }
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await enablePush();
      setState("enabled");
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos ativar os avisos agora."));
      setState(await getPushState().catch(() => "unsupported" as const));
    } finally {
      setBusy(false);
    }
  }

  if (state === "enabled") {
    return (
      <div data-testid="tutor-push">
        <Alert tone="success">Pronto: este celular vai avisar quando chegar uma pista.</Alert>
      </div>
    );
  }
  // Já ativo, bloqueado no navegador, sem suporte ou dispensado: nada a oferecer.
  if (dismissed || state !== "off") return null;

  return (
    <Card className="flex flex-col gap-3" data-testid="tutor-push" aria-labelledby="tutor-push-titulo">
      <h2 id="tutor-push-titulo" className="flex items-center gap-2 font-semibold">
        <BellRing aria-hidden="true" className="size-5 text-brand" strokeWidth={1.75} /> Receber avisos no celular
      </h2>
      <p className="text-sm text-text-secondary">
        Avisamos aqui quando alguém enviar um avistamento ou uma mensagem sobre seu pet, mesmo com a MEL fechada.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="md" onClick={enable} loading={busy} loadingText="Ativando…">
          Receber avisos no celular
        </Button>
        <Button variant="ghost" size="md" onClick={dismiss} disabled={busy}>
          Agora não
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}
