"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * CPF guardado (cifrado) de um protetor. Nada vem na página: cada clique pede
 * ao servidor, que confere quem é e REGISTRA o acesso. Mascarado primeiro;
 * completo só num segundo pedido explícito. Esconde de novo ao sair.
 */
export function CpfReveal({ code, audience }: { code: string; audience: "owner" | "moderator" }) {
  const [value, setValue] = useState<{ cpf: string; full: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(full: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/parceiros/${code}/cpf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completo: full }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { cpf?: string; full?: boolean; error?: string };
      if (!res.ok || !body.cpf) setError(body.error ?? "Não conseguimos consultar agora.");
      else setValue({ cpf: body.cpf, full: Boolean(body.full) });
    } catch {
      setError("Não conseguimos consultar agora. Verifique a conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="cpf-reveal">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">CPF:</span>
        <span className="font-mono text-sm tabular-nums" aria-live="polite">
          {value ? value.cpf : "guardado com segurança"}
        </span>
        {!value?.full ? (
          <Button size="md" variant="secondary" className="w-auto" loading={busy} loadingText="Consultando…" onClick={() => load(Boolean(value))}>
            <Eye aria-hidden="true" className="size-4" strokeWidth={2} /> {value ? "Ver completo" : "Ver CPF"}
          </Button>
        ) : (
          <Button size="md" variant="ghost" className="w-auto" onClick={() => setValue(null)}>
            <EyeOff aria-hidden="true" className="size-4" strokeWidth={2} /> Esconder
          </Button>
        )}
      </div>
      <p className="text-caption text-text-secondary">
        {audience === "moderator"
          ? "Cada consulta fica registrada com seu nome, a data e o parceiro. CPF válido não é identidade verificada."
          : "Só você e a moderação autorizada podem ver; cada acesso fica registrado. Apagado se o cadastro for recusado ou a conta excluída."}
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
