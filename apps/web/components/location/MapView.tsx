"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { LatLng, MapPin } from "@mel/core";
import { mapLibreProvider } from "@/lib/map/maplibre";

/** Mapa só de visualização (página do alerta, listas). */
export function MapView({
  center,
  zoom = 15,
  pins,
  label,
  className = "h-56",
}: {
  center: LatLng;
  zoom?: number;
  pins: MapPin[];
  label: string;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!el.current) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    mapLibreProvider
      .mount(el.current, { center, zoom })
      .then((map) => {
        if (cancelled) return map.destroy();
        map.setPins(pins);
        destroy = () => map.destroy();
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[MapView] mapa indisponível", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      destroy?.();
    };
    // Mapa estático: criado uma vez com os dados da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-border">
      <div ref={el} role="img" aria-label={label} className={`${className} w-full bg-surface-muted`} data-map-status={status} />
      {status === "loading" && (
        <p role="status" className="absolute inset-0 flex items-center justify-center bg-surface-muted text-text-secondary">
          Carregando mapa…
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="absolute inset-0 flex items-center justify-center bg-surface-muted p-4 text-center">
          Não conseguimos mostrar o mapa agora.
        </p>
      )}
    </div>
  );
}
