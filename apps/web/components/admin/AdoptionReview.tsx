"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reviewAdoption } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { userErrorMessage } from "@mel/core";

/** Aprovar ou recusar um anúncio de adoção (recusa pede um motivo, mostrado a quem doa). */
export function AdoptionReview({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(approve: boolean) {
    if (!approve && !note.trim()) {
      setError("Explique o motivo para quem está doando.");
      return;
    }
    setBusy(approve ? "approve" : "reject");
    setError(null);
    try {
      await reviewAdoption(getBrowserClient(), code, approve, note.trim() || undefined);
      toast({ tone: "success", title: approve ? `${name} publicado para adoção.` : "Anúncio recusado." });
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos aplicar agora."));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Link href={`/adocao/${code}`} target="_blank" className="self-start text-sm font-semibold text-link hover:underline">
        Ver o anúncio completo
      </Link>
      <TextField label="Motivo (obrigatório para recusar)" optional value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button size="md" className="w-auto" onClick={() => act(true)} loading={busy === "approve"} loadingText="Aprovando…" disabled={busy !== null}>
          Aprovar
        </Button>
        <Button size="md" variant="secondary" className="w-auto" onClick={() => act(false)} loading={busy === "reject"} loadingText="Recusando…" disabled={busy !== null}>
          Recusar
        </Button>
      </div>
    </div>
  );
}
