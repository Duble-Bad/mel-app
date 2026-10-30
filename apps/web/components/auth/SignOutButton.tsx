"use client";

import { useState } from "react";
import { signOut } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { userErrorMessage } from "@mel/core";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await signOut(getBrowserClient());
      // Navegação completa: descarta do cache do navegador as telas da conta.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intencional, ver acima
      window.location.assign("/");
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos sair agora. Tente novamente."));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <Button variant="ghost" size="md" onClick={handleClick} loading={pending} loadingText="Saindo…">
        Sair da conta
      </Button>
    </div>
  );
}
