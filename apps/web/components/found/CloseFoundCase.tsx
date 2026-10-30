"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { closeFoundCase } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";
import { userErrorMessage } from "@mel/core";

/** Quem publicou encerra: devolvido ao tutor, ou o animal não está mais com a pessoa. */
export function CloseFoundCase({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"REUNITED" | "CLOSED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function close(status: "REUNITED" | "CLOSED") {
    setBusy(status);
    setError(null);
    try {
      await closeFoundCase(getBrowserClient(), code, status);
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos atualizar. Tente de novo."));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="md" onClick={() => close("REUNITED")} loading={busy === "REUNITED"} loadingText="Encerrando…" disabled={busy !== null}>
        Já devolvi ao tutor
      </Button>
      <Button variant="ghost" size="md" onClick={() => close("CLOSED")} loading={busy === "CLOSED"} loadingText="Encerrando…" disabled={busy !== null}>
        Não está mais comigo / encerrar
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
