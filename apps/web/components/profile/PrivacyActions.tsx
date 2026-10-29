"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DELETE_CONFIRMATION, isDeleteConfirmed } from "@mel/core";
import { acceptTerms, exportMyData } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

/** Aceite pendente (conta anterior à versão vigente dos Termos). */
export function AcceptTermsButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptTerms(getBrowserClient(), userId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos registrar agora.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <Button size="md" onClick={accept} loading={busy} loadingText="Registrando…">
        Li e aceito a versão atual
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

/** Baixa um JSON com tudo o que a MEL guarda sobre a pessoa. */
export function ExportDataButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    setBusy(true);
    setError(null);
    try {
      const data = await exportMyData(getBrowserClient());
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-mel-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos gerar o arquivo agora.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" size="md" onClick={download} loading={busy} loadingText="Preparando arquivo…">
        <Download aria-hidden="true" className="size-4" strokeWidth={2} /> Baixar meus dados
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

/** Exclusão definitiva: confirma num painel e pede a palavra EXCLUIR. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setTouched(true);
    if (!isDeleteConfirmed(typed)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/conta/excluir", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não conseguimos excluir agora.");
      // Recarrega tudo: a sessão não existe mais.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- saída completa da sessão
      window.location.assign("/conta-excluida");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos excluir agora.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} /> Excluir minha conta
      </Button>
      <BottomSheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Excluir sua conta?"
        description="Apagamos para sempre seu perfil, pets, alertas, fotos, conversas, anúncios e empresas. Não dá para desfazer."
      >
        <div className="flex flex-col gap-4">
          <TextField
            label={`Digite ${DELETE_CONFIRMATION} para confirmar`}
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
            error={touched && !isDeleteConfirmed(typed) ? `Digite ${DELETE_CONFIRMATION}, em letras maiúsculas ou minúsculas.` : undefined}
          />
          {error && <Alert tone="error">{error}</Alert>}
          <Button variant="danger" onClick={confirm} loading={busy} loadingText="Excluindo…">
            Excluir para sempre
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
