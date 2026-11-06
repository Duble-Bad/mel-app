"use client";

import type { BBox, LatLng, MapHandle, MapOptions, MapPin, MapProvider, PinKind, Picker } from "@mel/core";
import { colors } from "@mel/ui-tokens";
import type { ExpressionSpecification } from "maplibre-gl";

// Única parte do app que conhece o MapLibre/MapTiler. Trocar de fornecedor =
// escrever outro MapProvider; telas e regras de negócio não mudam.

const PIN_STYLE: Record<PinKind, { color: string; icon: string; label: string }> = {
  lost: { color: colors["status-lost"], icon: "!", label: "Perdido" },
  found: { color: colors["status-found"], icon: "✓", label: "Encontrado" },
  sighting: { color: colors["status-sighting"], icon: "👁", label: "Avistamento" },
  adoption: { color: colors["status-adoption"], icon: "♥", label: "Adoção" },
  business: { color: colors.brand, icon: "★", label: "Parceiro" },
};

function styleUrl(theme: "light" | "dark" = "light"): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_MAPTILER_KEY ausente (veja .env.example).");
  // Tema escuro pronto no provider; as telas passam `theme` quando forem redesenhadas.
  return `https://api.maptiler.com/maps/${theme === "dark" ? "streets-v2-dark" : "streets-v2"}/style.json?key=${key}`;
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

/** Cores das áreas aproximadas (mapa da rede): as mesmas da legenda e dos selos. */
export const AREA_COLORS: Record<PinKind, string> = {
  lost: "#ef5157",
  found: "#22b67e",
  sighting: "#3d8bff",
  adoption: "#f6b928",
  business: "#f6b928",
};

/** Raio do círculo desenhado em volta do ponto público (grade de ~100 m). */
export const AREA_RADIUS_M = 100;

/** Ponto central da área: botão de 44 px (alvo de toque) com o ponto colorido e o pulso. */
function areaDotElement(kind: PinKind, label: string, id: string): HTMLButtonElement {
  const s = PIN_STYLE[kind];
  const el = document.createElement("button");
  el.type = "button";
  el.className = "mel-area-dot";
  el.dataset.pinId = id;
  el.style.setProperty("--c", AREA_COLORS[kind]);
  // Mesmo nome acessível dos pinos ("Perdido: Thor"), mais o aviso de área aproximada.
  el.setAttribute("aria-label", `${s.label}: ${label} (área aproximada)`);
  el.innerHTML = '<span class="mel-area-dot__pulse" aria-hidden="true"></span><span class="mel-area-dot__core" aria-hidden="true"></span>';
  return el;
}

/** Círculo (polígono) de `radiusM` metros em volta de `c`. */
function circlePolygon(c: LatLng, radiusM: number, steps = 48): number[][] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push([c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return ring;
}

/** Mapa da rede: além do contrato comum, zoom próprio e destaque da área ativa. */
export interface AreaMapHandle extends MapHandle {
  zoomBy(delta: number): void;
  setActive(id: string | null): void;
}

/**
 * Áreas aproximadas (mapa da rede): círculo translúcido com borda tracejada
 * (~100 m, acompanha o zoom porque é desenhado em metros) e um ponto central
 * clicável por tipo. O ponto já é o público (aproximado); nunca há coordenada exata.
 */
export const mapLibreAreasProvider = {
  async mount(el: HTMLElement, opts: MapOptions): Promise<AreaMapHandle> {
    return mountMap(el, opts, "areas") as Promise<AreaMapHandle>;
  },
};

export const mapLibreProvider: MapProvider = {
  mount(el: HTMLElement, opts: MapOptions): Promise<MapHandle> {
    return mountMap(el, opts, "pins");
  },
};

async function mountMap(el: HTMLElement, opts: MapOptions, mode: "pins" | "areas"): Promise<MapHandle | AreaMapHandle> {
  // Carregado sob demanda: o MapLibre é pesado e só entra nas telas com mapa.
  const maplibre = await import("maplibre-gl");
  // Worker servido como arquivo estático (scripts/copy-maplibre-worker.mjs).
  maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);
  const map = new maplibre.Map({
    container: el,
    style: styleUrl(opts.theme),
    center: [opts.center.lng, opts.center.lat],
    zoom: opts.zoom,
    interactive: opts.interactive ?? true,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  // No mapa da rede os botões de zoom são da própria tela (estilo do Conceito B).
  if (mode === "pins") map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

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
  const AREAS_ID = "mel-areas";
  let areaPins: MapPin[] = [];
  let activeId: string | null = null;

  // Áreas: uma fonte GeoJSON com um círculo por caso; `active` realça o selecionado.
  // Uma área por célula pública (e por tipo): vários casos na mesma célula não
  // empilham círculos translúcidos; os pontos continuam separados para o toque.
  const areaCells = () => {
    const cells = new Map<string, { pin: MapPin; center: LatLng; active: boolean }>();
    for (const pin of areaPins) {
      const center = pin.area ?? pin.position;
      const key = `${pin.kind}|${center.lat}|${center.lng}`;
      const cell = cells.get(key);
      if (cell) cell.active ||= pin.id === activeId;
      else cells.set(key, { pin, center, active: pin.id === activeId });
    }
    return [...cells.values()];
  };
  const areaData = () => ({
    type: "FeatureCollection" as const,
    features: areaCells().map(({ pin, center, active }) => ({
      type: "Feature" as const,
      properties: { id: pin.id, color: AREA_COLORS[pin.kind], active: active ? 1 : 0 },
      geometry: { type: "Polygon" as const, coordinates: [circlePolygon(center, AREA_RADIUS_M)] },
    })),
  });
  const areaPoints = () => ({
    type: "FeatureCollection" as const,
    features: areaCells().map(({ pin, center, active }) => ({
      type: "Feature" as const,
      properties: { id: pin.id, color: AREA_COLORS[pin.kind], active: active ? 1 : 0 },
      geometry: { type: "Point" as const, coordinates: [center.lng, center.lat] },
    })),
  });
  // Preenchimento leve: os nomes das ruas continuam legíveis (antes 0.22, e áreas na mesma
  // célula somavam). A área de privacidade em si não muda; só o quanto ela pinta o mapa.
  const activeOpacity: ExpressionSpecification = ["case", ["==", ["get", "active"], 1], 0.2, 0.08];
  if (mode === "areas") {
    map.addSource(AREAS_ID, { type: "geojson", data: areaData() });
    // Afastado (bairro/cidade), 100 m teriam ~5 px: um halo de no mínimo 22 px
    // mantém a área visível; a partir do zoom ~15 o halo cresce em metros exatos
    // (base 2 por nível) e some, dando lugar ao círculo tracejado real.
    map.addSource(`${AREAS_ID}-pts`, { type: "geojson", data: areaPoints() });
    map.addLayer({
      id: `${AREAS_ID}-halo`,
      type: "circle",
      source: `${AREAS_ID}-pts`,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, 22, 14.95, 22, 20, 730],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14.6, activeOpacity, 15.4, 0],
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 1.25,
        "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 14.6, 0.55, 15.4, 0],
      },
    });
    map.addLayer({
      id: `${AREAS_ID}-fill`,
      type: "fill",
      source: AREAS_ID,
      paint: { "fill-color": ["get", "color"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14.6, 0, 15.4, activeOpacity] },
    });
    map.addLayer({
      id: `${AREAS_ID}-line`,
      type: "line",
      source: AREAS_ID,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.5,
        "line-dasharray": [2.5, 2.5],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 14.6, 0, 15.4, 0.7],
      },
    });
    // Tocar em qualquer parte do círculo (ou do halo) abre o caso, não só no ponto central.
    // A área é da célula (pode ter vários casos): abre o ponto mais perto do toque. Toque
    // num ponto já foi tratado pelo próprio marcador.
    for (const layer of [`${AREAS_ID}-fill`, `${AREAS_ID}-halo`]) {
      map.on("click", layer, (e) => {
        if ((e.originalEvent.target as Element | null)?.closest?.(".maplibregl-marker")) return;
        const id = e.features?.[0]?.properties?.id;
        const cellPin = areaPins.find((p) => p.id === id);
        if (!cellPin) return;
        const cell = cellPin.area ?? cellPin.position;
        const sameCell = areaPins.filter((p) => p.kind === cellPin.kind && (p.area ?? p.position).lat === cell.lat && (p.area ?? p.position).lng === cell.lng);
        const at = e.lngLat;
        const nearest = sameCell.reduce((best, p) =>
          Math.hypot(p.position.lat - at.lat, p.position.lng - at.lng) < Math.hypot(best.position.lat - at.lat, best.position.lng - at.lng) ? p : best,
        );
        pinClick.forEach((cb) => cb(nearest.id));
      });
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
  }
  const refreshAreas = () => {
    (map.getSource(AREAS_ID) as { setData?: (d: unknown) => void } | undefined)?.setData?.(areaData());
    (map.getSource(`${AREAS_ID}-pts`) as { setData?: (d: unknown) => void } | undefined)?.setData?.(areaPoints());
  };

  const handle: AreaMapHandle = {
    setCenter(p: LatLng, zoom?: number) {
      map.easeTo({ center: [p.lng, p.lat], ...(zoom ? { zoom } : {}), duration: 600 });
    },

    zoomBy(delta: number) {
      map.easeTo({ zoom: map.getZoom() + delta, duration: 300 });
    },

    setActive(id: string | null) {
      activeId = id;
      markers.forEach((m) => m.getElement().toggleAttribute("data-active", m.getElement().dataset.pinId === id));
      refreshAreas();
    },

    setPins(pins: MapPin[]) {
      markers.forEach((m) => m.remove());
      if (mode === "areas") {
        areaPins = pins;
        refreshAreas();
      }
      markers = pins.map((pin) => {
        const node = mode === "areas" ? areaDotElement(pin.kind, pin.label, pin.id) : pinElement(pin.kind, pin.label);
        if (mode === "areas" && pin.id === activeId) node.setAttribute("data-active", "");
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

    fitTo(points: LatLng[], maxZoom = 16) {
      if (points.length === 0) return;
      if (points.length === 1) {
        map.jumpTo({ center: [points[0]!.lng, points[0]!.lat], zoom: maxZoom });
        return;
      }
      const bounds = new maplibre.LngLatBounds();
      points.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 48, maxZoom, duration: 0 });
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
}
