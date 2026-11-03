"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { LatLng, MapPin } from "@mel/core";
import { mapLibreProvider } from "@/lib/map/maplibre";

/**
 * Mapa só de visualização (página do alerta, listas). Só carrega o MapLibre e
 * pede o mapa ao MapTiler quando a área do mapa chega perto da tela: quem abre o
 * alerta pelo WhatsApp e toca em "Eu vi este pet" não paga ~1,5 MB nem uma carga
 * de mapa da cota.
 */
export function MapView({
  center,
  zoom = 15,
  pins,
  path,
  label,
  className = "h-56",
}: {
  center: LatLng;
  zoom?: number;
  pins: MapPin[];
  /** Caminho em ordem cronológica (linha tracejada). */
  path?: LatLng[];
  label: string;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [near, setNear] = useState(false);
  // Antes de chegar perto da tela, o mapa só espera (nada é baixado).
  const shown = near ? status : "waiting";

  // Espera a área do mapa chegar a ~1 tela de distância (ou monta já, sem suporte).
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setNear(true));
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !el.current) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    mapLibreProvider
      .mount(el.current, { center, zoom })
      .then((map) => {
        if (cancelled) return map.destroy();
        map.setPins(pins);
        if (path && path.length > 1) map.drawPath(path);
        if (pins.length > 1) map.fitTo(pins.map((p) => p.position));
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
  }, [near]);

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-border">
      <div ref={el} role="img" aria-label={label} className={`${className} w-full bg-surface-muted`} data-map-status={shown} />
      {shown === "loading" && (
        <p role="status" className="absolute inset-0 flex items-center justify-center bg-surface-muted text-text-secondary">
          Carregando mapa…
        </p>
      )}
      {shown === "waiting" && (
        <button
          type="button"
          onClick={() => setNear(true)}
          className="absolute inset-0 flex items-center justify-center bg-surface-muted font-semibold text-link underline-offset-4 hover:underline"
        >
          Mostrar mapa
        </button>
      )}
      {shown === "error" && (
        <p role="alert" className="absolute inset-0 flex items-center justify-center bg-surface-muted p-4 text-center">
          Não conseguimos mostrar o mapa agora.
        </p>
      )}
    </div>
  );
}
