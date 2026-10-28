"use client";

import type { BBox, LatLng, MapHandle, MapOptions, MapPin, MapProvider, PinKind, Picker } from "@mel/core";
import { colors } from "@mel/ui-tokens";

// Única parte do app que conhece o MapLibre/MapTiler. Trocar de fornecedor =
// escrever outro MapProvider; telas e regras de negócio não mudam.

const PIN_STYLE: Record<PinKind, { color: string; icon: string; label: string }> = {
  lost: { color: colors["status-lost"], icon: "!", label: "Perdido" },
  found: { color: colors["status-found"], icon: "✓", label: "Encontrado" },
  sighting: { color: colors["status-sighting"], icon: "👁", label: "Avistamento" },
  adoption: { color: colors["status-adoption"], icon: "♥", label: "Adoção" },
  business: { color: colors["brand-primary"], icon: "★", label: "Parceiro" },
};

function styleUrl(): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_MAPTILER_KEY ausente (veja .env.example).");
  return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
}

function pinElement(kind: PinKind, label: string): HTMLButtonElement {
  const s = PIN_STYLE[kind];
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${s.label}: ${label}`);
  el.textContent = s.icon;
  Object.assign(el.style, {
    width: "36px",
    height: "36px",
    borderRadius: "9999px",
    border: `3px solid ${colors.surface}`,
    background: s.color,
    color: colors["text-inverse"],
    fontWeight: "700",
    boxShadow: "0 1px 4px rgb(0 0 0 / 0.35)",
    cursor: "pointer",
  });
  return el;
}

/** Marcador do seletor de local: grande o bastante para arrastar com o dedo. */
function pickerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Local marcado");
  el.dataset.testid = "map-picker-pin";
  el.innerHTML = `<svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true">
    <path d="M22 2C11 2 2 11 2 22c0 15 20 32 20 32s20-17 20-32C42 11 33 2 22 2z" fill="${colors["status-lost"]}" stroke="${colors.surface}" stroke-width="3"/>
    <circle cx="22" cy="22" r="7" fill="${colors.surface}"/></svg>`;
  el.style.cursor = "grab";
  return el;
}

export const mapLibreProvider: MapProvider = {
  async mount(el: HTMLElement, opts: MapOptions): Promise<MapHandle> {
    // Carregado sob demanda: o MapLibre é pesado e só entra nas telas com mapa.
    const maplibre = await import("maplibre-gl");
    // Worker servido como arquivo estático (scripts/copy-maplibre-worker.mjs).
    maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);
    const map = new maplibre.Map({
      container: el,
      style: styleUrl(),
      center: [opts.center.lng, opts.center.lat],
      zoom: opts.zoom,
      interactive: opts.interactive ?? true,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("O mapa demorou demais para carregar.")), 20_000);
      // Pronto para uso quando o estilo carrega; "load" espera todas as camadas
      // baixarem, o que em rede móvel deixaria a tela "carregando" à toa.
      map.once("style.load", () => {
        clearTimeout(timer);
        resolve();
      });
      map.once("error", (e) => {
        if (!map.isStyleLoaded()) {
          clearTimeout(timer);
          reject(e.error ?? new Error("Falha ao carregar o mapa."));
        }
      });
    }).catch((error) => {
      map.remove();
      throw error;
    });

    let markers: InstanceType<typeof maplibre.Marker>[] = [];
    const pinClick = new Set<(id: string) => void>();
    const PATH_ID = "mel-path";

    const handle: MapHandle = {
      setCenter(p: LatLng, zoom?: number) {
        map.easeTo({ center: [p.lng, p.lat], ...(zoom ? { zoom } : {}), duration: 600 });
      },

      setPins(pins: MapPin[]) {
        markers.forEach((m) => m.remove());
        markers = pins.map((pin) => {
          const node = pinElement(pin.kind, pin.label);
          node.addEventListener("click", () => pinClick.forEach((cb) => cb(pin.id)));
          return new maplibre.Marker({ element: node }).setLngLat([pin.position.lng, pin.position.lat]).addTo(map);
        });
      },

      drawPath(points: LatLng[]) {
        const data = {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: points.map((p) => [p.lng, p.lat]) },
        };
        const source = map.getSource(PATH_ID) as { setData?: (d: unknown) => void } | undefined;
        if (source?.setData) {
          source.setData(data);
          return;
        }
        map.addSource(PATH_ID, { type: "geojson", data });
        map.addLayer({
          id: PATH_ID,
          type: "line",
          source: PATH_ID,
          paint: { "line-color": colors["status-sighting"], "line-width": 3, "line-dasharray": [2, 2] },
        });
      },

      onMove(cb: (bbox: BBox) => void) {
        const listener = () => {
          const b = map.getBounds();
          cb({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
        };
        map.on("moveend", listener);
        return () => map.off("moveend", listener);
      },

      onPinClick(cb: (id: string) => void) {
        pinClick.add(cb);
        return () => pinClick.delete(cb);
      },

      enablePicker(initial: LatLng, onPick: (p: LatLng) => void): Picker {
        const marker = new maplibre.Marker({ element: pickerElement(), draggable: true, anchor: "bottom" })
          .setLngLat([initial.lng, initial.lat])
          .addTo(map);
        const emit = () => {
          const { lat, lng } = marker.getLngLat();
          onPick({ lat, lng });
        };
        const onClick = (e: { lngLat: { lat: number; lng: number } }) => {
          marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
          emit();
        };
        marker.on("dragend", emit);
        map.on("click", onClick);
        return {
          set(p: LatLng) {
            marker.setLngLat([p.lng, p.lat]);
          },
          remove() {
            map.off("click", onClick);
            marker.remove();
          },
        };
      },

      destroy() {
        markers.forEach((m) => m.remove());
        map.remove();
      },
    };

    return handle;
  },
};
