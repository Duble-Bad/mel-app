"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { type BrState, describeAccuracy, type GeocodeResult, type LatLng, type MapHandle, type Picker, userErrorMessage } from "@mel/core";
import { getCurrentPosition, getGeocoder } from "@/lib/geo/client";
import { mapLibreProvider } from "@/lib/map/maplibre";
import { Button } from "@/components/ui/Button";

export interface PickedLocation {
  position: LatLng;
  /** Endereço aproximado do ponto ("Rua X, Bairro, Cidade – UF"), quando conhecido. */
  label?: string;
  neighborhood?: string;
  city?: string;
  state?: BrState;
  source: "gps" | "search" | "map";
}

interface LocationPickerProps {
  value: PickedLocation | null;
  onChange: (value: PickedLocation) => void;
  /** Centro inicial quando ainda não há local marcado (ex.: cidade do usuário). */
  defaultCenter?: LatLng;
  /** Aviso de privacidade exibido junto ao mapa. */
  privacyNote?: ReactNode;
}

// Centro de São Paulo: ponto de partida genérico quando nada mais é conhecido.
const FALLBACK_CENTER: LatLng = { lat: -23.5505, lng: -46.6333 };

/**
 * "Onde foi?" — GPS em um toque, busca de endereço, pino arrastável e toque no
 * mapa. Funciona mesmo se o mapa não carregar (GPS e busca continuam valendo).
 */
export function LocationPicker({ value, onChange, defaultCenter, privacyNote }: LocationPickerProps) {
  const searchId = useId();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const pickerRef = useRef<Picker | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsInfo, setGpsInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addressFailed, setAddressFailed] = useState(false);

  const visibleResults = query.trim().length >= 3 ? results : null;

  /** Atualiza o local e, sem bloquear, descobre o endereço aproximado. */
  const commit = useCallback(async (next: PickedLocation) => {
    onChangeRef.current(next);
    setAddressFailed(false);
    if (next.label) return;
    try {
      const address = await getGeocoder().reverse(next.position);
      // Só aplica se o ponto ainda for o mesmo (a pessoa pode ter mexido de novo).
      const current = valueRef.current?.position;
      if (address && current && current.lat === next.position.lat && current.lng === next.position.lng) {
        onChangeRef.current({
          ...next,
          label: address.label,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
        });
      } else if (!address) {
        setAddressFailed(true);
      }
    } catch (err) {
      console.warn("[LocationPicker] endereço não identificado", err);
      setAddressFailed(true);
    }
  }, []);

  // Monta o mapa uma vez.
  useEffect(() => {
    if (!mapEl.current) return;
    let cancelled = false;
    const start = valueRef.current?.position ?? defaultCenter ?? FALLBACK_CENTER;
    mapLibreProvider
      .mount(mapEl.current, { center: start, zoom: valueRef.current ? 16 : 12 })
      .then((map) => {
        if (cancelled) return map.destroy();
        mapRef.current = map;
        pickerRef.current = map.enablePicker(start, (position) => {
          setError(null);
          setGpsInfo(null);
          void commit({ position, source: "map" });
        });
        setMapStatus("ready");
      })
      .catch((err) => {
        console.error("[LocationPicker] mapa indisponível", err);
        if (!cancelled) setMapStatus("error");
      });
    return () => {
      cancelled = true;
      pickerRef.current?.remove();
      mapRef.current?.destroy();
      mapRef.current = null;
      pickerRef.current = null;
    };
    // O mapa é criado uma única vez; mudanças de local usam a API do mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveMapTo(position: LatLng) {
    pickerRef.current?.set(position);
    mapRef.current?.setCenter(position, 16);
  }

  async function useGps() {
    setError(null);
    setGpsInfo(null);
    setGpsPending(true);
    try {
      const { position, accuracyMeters } = await getCurrentPosition();
      moveMapTo(position);
      setGpsInfo(describeAccuracy(accuracyMeters));
      await commit({ position, source: "gps" });
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos usar sua localização."));
    } finally {
      setGpsPending(false);
    }
  }

  // Busca com espera curta entre teclas (economiza dados e cota da API).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await getGeocoder().search(q, valueRef.current?.position ?? defaultCenter);
        if (!cancelled) setResults(found);
      } catch (err) {
        console.error("[LocationPicker] busca falhou", err);
        if (!cancelled) {
          setResults(null);
          setError("A busca de endereço não respondeu. Tente de novo ou marque no mapa.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, defaultCenter]);

  function chooseResult(result: GeocodeResult) {
    setQuery("");
    setResults(null);
    setError(null);
    setGpsInfo(null);
    moveMapTo(result.position);
    void commit({ ...result, source: "search" });
  }

  return (
    <div
      className="flex flex-col gap-3"
      data-testid="location-picker"
      data-lat={value?.position.lat ?? ""}
      data-lng={value?.position.lng ?? ""}
    >
      <Button variant="secondary" onClick={useGps} loading={gpsPending} loadingText="Procurando você…">
        <span aria-hidden="true">📍</span> Usar minha localização atual
      </Button>

      <div className="relative flex flex-col gap-1.5">
        <label htmlFor={searchId} className="font-semibold">
          Ou busque um endereço ou lugar
        </label>
        <input
          id={searchId}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Ex.: Rua das Flores, 100 ou Praça da Sé"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={`${searchId}-status`}
          className="block min-h-12 w-full rounded-md border-2 border-border-strong bg-surface px-4 text-base focus:border-focus focus:outline-none"
        />
        <p id={`${searchId}-status`} role="status" className="sr-only">
          {searching ? "Buscando…" : visibleResults ? `${visibleResults.length} resultado(s)` : ""}
        </p>
        {visibleResults && (
          <ul className="flex flex-col overflow-hidden rounded-md border-2 border-border-strong bg-surface" aria-label="Resultados da busca">
            {visibleResults.length === 0 && <li className="px-4 py-3 text-text-secondary">Nada encontrado. Tente outro endereço ou marque no mapa.</li>}
            {visibleResults.map((r) => (
              <li key={`${r.position.lat},${r.position.lng}`} className="border-b border-border last:border-0">
                <button type="button" onClick={() => chooseResult(r)} className="min-h-12 w-full px-4 py-2 text-left hover:bg-surface-muted">
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg border-2 border-border">
        <div
          ref={mapEl}
          className="h-72 w-full bg-surface-muted"
          role="application"
          aria-label="Mapa. Toque no mapa ou arraste o pino até o local."
          data-testid="location-map"
          data-map-status={mapStatus}
        />
        {mapStatus === "loading" && (
          <p role="status" className="absolute inset-0 flex items-center justify-center bg-surface-muted text-text-secondary">
            Carregando mapa…
          </p>
        )}
        {mapStatus === "error" && (
          <div role="alert" className="absolute inset-0 flex items-center justify-center bg-surface-muted p-4 text-center">
            Não conseguimos mostrar o mapa agora. Você ainda pode usar sua localização ou buscar o endereço.
          </div>
        )}
        {mapStatus === "ready" && !value && (
          <p className="pointer-events-none absolute top-2 left-2 rounded-sm bg-surface/90 px-2 py-1 text-sm font-semibold">
            Toque no mapa ou arraste o pino
          </p>
        )}
      </div>

      <div aria-live="polite" className="flex flex-col gap-1">
        {value ? (
          <p data-testid="picked-label">
            <span className="font-semibold">Local marcado:</span>{" "}
            {value.label
              ? `perto de ${value.label}`
              : addressFailed
                ? "não identificamos o endereço deste ponto — confira o pino no mapa."
                : "identificando o endereço…"}
            {gpsInfo && <span className="block text-sm text-text-secondary">GPS: {gpsInfo}</span>}
          </p>
        ) : (
          <p className="text-text-secondary">Nenhum local marcado ainda.</p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {privacyNote && <p className="text-sm text-text-secondary">{privacyNote}</p>}
      </div>
    </div>
  );
}
