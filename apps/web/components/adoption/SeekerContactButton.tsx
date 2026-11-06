"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Lock, MessageCircle } from "lucide-react";
import { firstContactIssue, MESSAGE_MAX, messageBodySchema, userErrorMessage } from "@mel/core";
import { type ContactListing, startAdoptionSeekerConversation } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";

/**
 * "Conversar" no card da fila: só aparece para quem tem anúncio DISPONÍVEL e só
 * em quem aceitou contato (o banco confere tudo de novo). Escolhe o animal e
 * manda a 1ª mensagem; a conversa segue no chat da MEL (/conversas).
 */
export function SeekerContactButton({ contactRef, firstName, listings }: { contactRef: string; firstName: string | null; listings: ContactListing[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState<string | null>(listings.length === 1 ? listings[0]!.code : null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const who = firstName ?? "esta pessoa";
  const chosen = listings.find((l) => l.code === code) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!chosen) {
      setError("Escolha sobre qual animal você quer conversar.");
      return;
    }
    const parsed = messageBodySchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    const issue = firstContactIssue(parsed.data);
    if (issue) {
      setError(issue);
      return;
    }
    setBusy(true);
    try {
      const id = await startAdoptionSeekerConversation(getBrowserClient(), { listingCode: chosen.code, contactRef, body: parsed.data });
      router.push(`/conversas/${id}`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos enviar agora. Tente de novo."));
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="md"
        variant="secondary"
        className="mt-2 w-auto self-start"
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
      >
        <MessageCircle aria-hidden="true" className="size-4" strokeWidth={2} /> Conversar
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`contact-${contactRef}`}
        className="m-auto w-[min(100%-2rem,30rem)] rounded-lg bg-surface p-0 text-text-primary shadow-card backdrop:bg-ink-900/50"
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-4 p-5">
          <h2 id={`contact-${contactRef}`} className="text-xl font-bold">
            Conversar com {who}
          </h2>
          {listings.length > 1 ? (
            <ChoiceGroup
              name={`listing-${contactRef}`}
              legend="Sobre qual animal?"
              columns={1}
              value={code}
              onChange={setCode}
              options={listings.map((l) => ({ value: l.code, label: l.name }))}
            />
          ) : (
            chosen && (
              <p className="flex items-center gap-3">
                {chosen.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- foto pública do anúncio
                  <img src={chosen.photoUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                )}
                <span>
                  Sobre <strong>{chosen.name}</strong>
                </span>
              </p>
            )
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`contact-body-${contactRef}`} className="font-semibold">
              Sua mensagem
            </label>
            <textarea
              id={`contact-body-${contactRef}`}
              rows={5}
              maxLength={MESSAGE_MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Ex.: Olá${firstName ? `, ${firstName}` : ""}! ${chosen ? `${chosen.name} combina com o que você procura. ` : ""}Quer conhecer?`}
              className="block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 focus:border-focus focus:outline-none"
            />
            <p className="text-sm text-text-secondary">Na primeira mensagem, sem links, telefone ou e-mail.</p>
          </div>
          <p className="flex gap-2.5 rounded-[14px] border border-status-sighting/35 bg-status-sighting-soft px-3.5 py-3 text-sm">
            <Lock aria-hidden="true" className="mt-px size-4 shrink-0 text-status-sighting" strokeWidth={2} />
            <span>
              {who} vê o animal e a sua mensagem e pode bloquear ou denunciar. Telefone, e-mail e endereço não aparecem para ninguém. A MEL nunca pede pagamento.
            </span>
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-col gap-2">
            <Button type="submit" loading={busy} loadingText="Enviando…">
              Enviar mensagem
            </Button>
            <Button variant="secondary" onClick={() => dialog.current?.close()} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
