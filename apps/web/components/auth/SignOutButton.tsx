"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await signOut(getBrowserClient());
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos sair agora. Tente novamente.");
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
