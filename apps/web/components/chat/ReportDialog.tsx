"use client";

import { useRef, useState } from "react";
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason, reportSchema, userErrorMessage } from "@mel/core";
import { reportConversation } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";

/** Denúncia da outra pessoa da conversa; bloqueia junto por padrão. */
export function ReportDialog({ conversationId, onReported }: { conversationId: string; onReported: (blocked: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function open() {
    setError(null);
    setDone(false);
    dialog.current?.showModal();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = reportSchema.safeParse({ reason: reason ?? undefined, details, block });
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reportConversation(getBrowserClient(), conversationId, parsed.data);
      setDone(true);
      onReported(parsed.data.block);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos enviar a denúncia. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-semibold text-status-lost hover:bg-status-lost-soft"
      >
        <span aria-hidden="true">⚑</span> Denunciar
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="report-title"
        className="m-auto w-[min(100%-2rem,28rem)] rounded-lg bg-surface p-0 text-text-primary shadow-card backdrop:bg-ink-900/50"
      >
        {done ? (
          <div className="flex flex-col gap-4 p-5">
            <h2 id="report-title" className="text-xl font-bold">
              Denúncia enviada
            </h2>
            <p>Obrigado por avisar. A equipe da MEL vai analisar esta conversa.</p>
            {block && <p>Você bloqueou esta pessoa: ela não consegue mais mandar mensagens para você.</p>}
            <Button onClick={() => dialog.current?.close()}>Fechar</Button>
          </div>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-4 p-5">
            <h2 id="report-title" className="text-xl font-bold">
              Denunciar
            </h2>
            <p className="text-sm text-text-secondary">
              A equipe da MEL lê esta conversa para analisar. A outra pessoa não fica sabendo quem denunciou.
            </p>
            <ChoiceGroup
              name="report-reason"
              legend="O que aconteceu?"
              columns={1}
              value={reason}
              onChange={setReason}
              options={REPORT_REASONS.map((r) => ({ value: r, label: REPORT_REASON_LABELS[r] }))}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-details" className="font-semibold">
                Detalhes <span className="font-normal text-text-secondary">(opcional)</span>
              </label>
              <textarea
                id="report-details"
                rows={3}
                maxLength={1000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 focus:border-focus focus:outline-none"
              />
            </div>
            <label className="flex min-h-12 items-start gap-3">
              <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
              <span className="font-semibold">Bloquear esta pessoa também</span>
            </label>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex flex-col gap-2">
              <Button type="submit" variant="danger" loading={busy} loadingText="Enviando…">
                Enviar denúncia
              </Button>
              <Button variant="secondary" onClick={() => dialog.current?.close()}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
