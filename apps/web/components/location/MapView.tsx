"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/map.css";
import { useEffect, useRef, useState } from "react";
import { MapPin as MapPinIcon, Minus, Plus } from "lucide-react";
import type { LatLng, MapHandle, MapPin } from "@mel/core";
import { type AreaMapHandle, mapLibreAreasProvider, mapLibreProvider } from "@/lib/map/maplibre";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Mapa só de visualização (página do alerta, listas). Só carrega o MapLibre e
 * pede o mapa ao MapTiler quando a área do mapa chega perto da tela: quem abre o
 * alerta pelo WhatsApp e toca em "Eu vi este pet" não paga ~1,5 MB nem uma carga
 * de mapa da cota.
 *
 * Mesmo tema do mapa da rede (segue o tema da tela). Com `approximate`, os pontos
 * são áreas aproximadas (círculo de ~100 m em volta do ponto público, igual ao /mapa)
 * e os botões de zoom são os da MEL; sem ele (parceiros), pinos com o zoom do MapLibre.
 * `areaLabel` fica num chip fixo: o bairro aparece sem depender dos rótulos do estilo
 * (que somem no zoom 14 exato do estilo escuro e podem cair fora de um mapa baixo).
 */
export function MapView({
  center,
  zoom = 15,
  pins,
  path,
  label,
  className = "h-72 sm:h-[340px]",
  approximate = false,
  areaLabel,
}: {
  center: LatLng;
  zoom?: number;
  pins: MapPin[];
  /** Caminho em ordem cronológica (linha tracejada). */
  path?: LatLng[];
  label: string;
  className?: string;
  /** Pontos públicos aproximados: desenha a área de ~100 m, como no mapa da rede. */
  approximate?: boolean;
  /** Região pública (ex.: "Mooca, São Paulo – SP"), sempre visível sobre o mapa. */
  areaLabel?: string | null;
}) {
  const { resolvedTheme } = useTheme();
  const el = useRef<HTMLDivElement>(null);
  const handle = useRef<AreaMapHandle | null>(null);
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
    const provider = approximate ? mapLibreAreasProvider : mapLibreProvider;
    provider
      .mount(el.current, { center, zoom, theme: resolvedTheme })
      .then((map: MapHandle) => {
        if (cancelled) return map.destroy();
        map.setPins(pins);
        if (path && path.length > 1) map.drawPath(path);
        if (pins.length > 1) map.fitTo(pins.map((p) => p.position));
        handle.current = approximate ? (map as AreaMapHandle) : null;
        destroy = () => map.destroy();
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[MapView] mapa indisponível", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      handle.current = null;
      destroy?.();
    };
    // Mapa estático: criado uma vez com os dados da página (o tema remonta o estilo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, resolvedTheme]);

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-border">
      <div ref={el} role="img" aria-label={label} className={`${className} w-full bg-surface-muted`} data-map-status={shown} />
      {areaLabel && shown === "ready" && (
        <p className="mel-map-chip pointer-events-none absolute top-2.5 left-2.5 z-[2] flex max-w-[calc(100%-72px)] items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold" data-testid="map-area-label">
          <MapPinIcon aria-hidden="true" className="size-3.5 shrink-0 text-[#f6b928]" strokeWidth={2.25} />
          <span className="truncate">{areaLabel}</span>
        </p>
      )}
      {approximate && shown === "ready" && (
        <div className="mel-map-controls mel-map-controls--compact">
          <button type="button" aria-label="Aproximar" onClick={() => handle.current?.zoomBy(1)}>
            <Plus aria-hidden="true" />
          </button>
          <button type="button" aria-label="Afastar" onClick={() => handle.current?.zoomBy(-1)}>
            <Minus aria-hidden="true" />
          </button>
        </div>
      )}
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
