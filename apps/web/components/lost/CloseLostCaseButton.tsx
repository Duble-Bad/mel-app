"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { userErrorMessage } from "@mel/core";
import { closeLostCase } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";

/**
 * ENCERRAR ALERTA (sem reencontro). Ação secundária e com confirmação: tira o
 * alerta das buscas e do mapa e para avistamentos e mensagens novas. Não conta
 * como reencontro — para isso existe "Meu pet foi encontrado".
 */
export function CloseLostCaseButton({ code, petName }: { code: string; petName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await closeLostCase(getBrowserClient(), code);
      setOpen(false);
      router.replace(`/alerta/${code}?encerrado=1`);
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos encerrar agora. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="md"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="whitespace-nowrap text-text-secondary hover:bg-status-lost-soft hover:text-status-lost sm:w-auto sm:px-4"
      >
        Encerrar alerta
      </Button>
      <BottomSheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Encerrar este alerta?"
        description={`Use esta opção se você não quiser mais manter este alerta ativo. Se ${petName} voltou para casa, escolha "Meu pet foi encontrado".`}
      >
        <p className="text-text-secondary">
          O alerta sai do mapa e das buscas, e ninguém mais poderá enviar avistamentos ou mensagens novas. O que já foi
          enviado continua guardado para você.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <Button variant="danger" onClick={confirm} loading={busy} loadingText="Encerrando…">
          Encerrar alerta
        </Button>
        <Button variant="ghost" size="md" onClick={() => setOpen(false)} disabled={busy}>
          Manter ativo
        </Button>
      </BottomSheet>
    </>
  );
}
