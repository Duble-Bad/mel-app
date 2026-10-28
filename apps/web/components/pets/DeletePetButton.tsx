"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Pet } from "@mel/core";
import { deletePet } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/** Exclusão com confirmação explícita (ação irreversível). */
export function DeletePetButton({ pet }: { pet: Pick<Pet, "id" | "ownerId" | "name"> }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deletePet(getBrowserClient(), pet);
      router.replace("/perfil?pet_removido=1");
      router.refresh();
    } catch {
      setError("Não conseguimos excluir agora. Tente novamente.");
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="md" className="text-danger" onClick={() => setConfirming(true)}>
        Excluir {pet.name} da MEL
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Confirmar exclusão" className="flex flex-col gap-3 rounded-lg border-2 border-danger p-4">
      <p className="font-semibold">Excluir {pet.name}?</p>
      <p className="text-text-secondary">O cadastro, as fotos e o MEL ID serão apagados. Isso não pode ser desfeito.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <Button variant="danger" size="md" onClick={handleDelete} loading={pending} loadingText="Excluindo…">
        Sim, excluir
      </Button>
      <Button variant="secondary" size="md" onClick={() => setConfirming(false)} disabled={pending}>
        Cancelar
      </Button>
    </div>
  );
}
