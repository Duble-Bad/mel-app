"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setBusinessPublicAddress } from "@mel/data";
import { userErrorMessage } from "@mel/core";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * Administrador: libera (ou retira) o endereço exato de empresa/ONG aprovada que
 * declarou endereço comercial/institucional e autorizou a divulgação. O banco
 * recusa quem não é administrador e parceiro sem autorização.
 */
export function PublicAddressControl({ code, consent, verified }: { code: string; consent: boolean; verified: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(isPublic: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setBusinessPublicAddress(getBrowserClient(), code, isPublic);
      toast({ tone: "success", title: isPublic ? "Endereço liberado no mapa." : "Endereço retirado: em público só a região." });
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos aplicar agora."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="endereco-publico" className="flex flex-col gap-3 rounded-lg border border-border p-4" data-testid="admin-public-address">
      <h2 id="endereco-publico" className="font-semibold">
        Endereço no mapa <span className="font-normal text-text-secondary">(só administradores)</span>
      </h2>
      <p className="text-sm text-text-secondary">
        {!consent
          ? "O parceiro não autorizou mostrar o endereço. Em público aparecem só o bairro, a cidade e um ponto aproximado (~1 km)."
          : verified
            ? "Endereço exato liberado: aparece no perfil e no mapa de parceiros."
            : "O parceiro declarou que é um endereço comercial/institucional público e autorizou a divulgação. Confira antes de liberar: nunca libere residência ou lar temporário."}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {consent && (
        <Button size="md" variant={verified ? "secondary" : "primary"} className="w-auto self-start" onClick={() => act(!verified)} loading={busy} loadingText="Salvando…">
          {verified ? "Retirar endereço do mapa" : "Liberar endereço exato no mapa"}
        </Button>
      )}
    </section>
  );
}
