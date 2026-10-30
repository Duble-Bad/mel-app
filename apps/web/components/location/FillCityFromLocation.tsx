"use client";

import { useState } from "react";
import type { BrState } from "@mel/core";
import { getCurrentPosition, getGeocoder } from "@/lib/geo/client";
import { userErrorMessage } from "@mel/core";

/**
 * "Usar minha localização" para preencher cidade/estado. Usa o GPS uma vez,
 * guarda só cidade e UF (nunca as coordenadas).
 */
export function FillCityFromLocation({ onFill }: { onFill: (city: string, state: BrState | null) => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  async function handleClick() {
    setPending(true);
    setMessage(null);
    try {
      const { position } = await getCurrentPosition();
      const place = await getGeocoder().reverse(position);
      if (!place?.city) {
        setMessage({ tone: "error", text: "Não identificamos sua cidade. Preencha à mão, por favor." });
        return;
      }
      onFill(place.city, place.state ?? null);
      setMessage({ tone: "ok", text: `Preenchido: ${place.city}${place.state ? ` – ${place.state}` : ""}.` });
    } catch (err) {
      setMessage({
        tone: "error",
        text: userErrorMessage(err, "Não conseguimos usar sua localização. Preencha à mão."),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-md px-1 font-semibold text-link underline-offset-4 hover:underline disabled:opacity-60"
      >
        <span aria-hidden="true">📍</span>
        {pending ? "Procurando sua cidade…" : "Usar minha localização"}
      </button>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "font-medium text-danger" : "text-text-secondary"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
