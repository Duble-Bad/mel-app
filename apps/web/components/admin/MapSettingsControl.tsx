"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setShowAdoptionOnMap } from "@mel/data";
import { userErrorMessage } from "@mel/core";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";

/** Configuração do mapa da rede (só administradores; o banco recusa os demais). */
export function MapSettingsControl({ showAdoptionOnMap }: { showAdoptionOnMap: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(showAdoptionOnMap);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const s = await setShowAdoptionOnMap(getBrowserClient(), next);
      setOn(s.showAdoptionOnMap);
      toast({ tone: "success", title: s.showAdoptionOnMap ? "Adoção aparece no mapa da rede." : "Adoção fora do mapa (continua no mural e na página de adoção)." });
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos salvar agora."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="admin-map-settings">
      <Switch
        checked={on}
        onChange={change}
        disabled={busy}
        label="Mostrar animais disponíveis para adoção no mapa da rede"
        description="Marcadores dourados na área aproximada de cada anúncio (nunca o endereço de quem doa). Desligado, os anúncios continuam no mural e na página de adoção."
      />
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
