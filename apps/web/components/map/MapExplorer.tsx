"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, LocateFixed, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { distanceMeters, itemTitle, toSearchParams, type MapHandle, type PublicCaseItem, type SearchFilters } from "@mel/core";
import { searchPublicCases } from "@mel/data";
import { getCurrentPosition } from "@/lib/geo/client";
import { mapLibreProvider } from "@/lib/map/maplibre";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useTheme } from "@/components/theme/ThemeProvider";
import { CaseCard } from "./CaseCard";

const ZOOM_BY_RADIUS: Record<number, number> = { 1: 15, 3: 13.5, 5: 12.8, 10: 11.8 };

type Load = { status: "loading" } | { status: "ok"; items: PublicCaseItem[]; total: number } | { status: "error" };

/** Mapa público: pinos por tipo, cartão ao tocar, "minha localização" e "buscar nesta área". */
export function MapExplorer({ filters }: { filters: SearchFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const el = useRef<HTMLDivElement>(null);
  const handle = useRef<MapHandle | null>(null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");
  // Resultado guardado com a chave dos filtros: chave diferente = ainda carregando.
  const [result, setResult] = useState<{ key: string; load: Load } | null>(null);
  const [picked, setPicked] = useState<{ key: string; item: PublicCaseItem } | null>(null);
  const [movedTo, setMovedTo] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const go = (patch: Partial<SearchFilters>) => router.replace(`${pathname}${toSearchParams({ ...filters, page: 1, ...patch })}`, { scroll: false });
  const filtersKey = toSearchParams(filters);
  const load: Load = result?.key === filtersKey ? result.load : { status: "loading" };
  const items = load.status === "ok" ? load.items : [];
  const selected = picked?.key === filtersKey ? picked.item : null;
  const itemsRef = useRef(items);
  const keyRef = useRef(filtersKey);
  useEffect(() => {
    itemsRef.current = items;
    keyRef.current = filtersKey;
  });

  // Monta o mapa (de novo quando o tema muda: estilo claro/escuro).
  useEffect(() => {
    if (!el.current) return;
    let cancelled = false;
    const unsubs: (() => void)[] = [];
    mapLibreProvider
      .mount(el.current, { center: filters.center, zoom: ZOOM_BY_RADIUS[filters.radiusKm] ?? 13, theme: resolvedTheme })
      .then((h) => {
        if (cancelled) return h.destroy();
        handle.current = h;
        setMapState("ready");
        unsubs.push(
          h.onPinClick((id) => {
            const item = itemsRef.current.find((i) => `${i.kind}-${i.code}` === id);
            setPicked(item ? { key: keyRef.current, item } : null);
          }),
        );
        unsubs.push(
          h.onMove((b) => {
            const c = { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
            setMovedTo(distanceMeters(c, filters.center) > filters.radiusKm * 300 ? c : null);
          }),
        );
        h.setPins(toPins(itemsRef.current));
      })
      .catch((err) => {
        console.error("[mapa] não carregou", err);
        if (!cancelled) setMapState("error");
      });
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      handle.current?.destroy();
      handle.current = null;
    };
    // filters.center/radius mudam o endereço e remontam via key no componente pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  // Busca os casos sempre que os filtros mudam.
  useEffect(() => {
    let cancelled = false;
    const key = filtersKey;
    searchPublicCases(getBrowserClient(), filters, { pageSize: 100 })
      .then((r) => {
        if (cancelled) return;
        setResult({ key, load: { status: "ok", items: r.items, total: r.total } });
        handle.current?.setPins(toPins(r.items));
      })
      .catch((err) => {
        console.error("[mapa] busca falhou", err);
        if (!cancelled) setResult({ key, load: { status: "error" } });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  async function locate() {
    setLocating(true);
    setGeoError(null);
    try {
      const { position } = await getCurrentPosition();
      go({ center: position, hasCenter: true });
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Não conseguimos pegar sua localização.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="relative h-[58dvh] min-h-80 overflow-hidden rounded-card border border-border bg-surface-muted lg:sticky lg:top-4 lg:order-2 lg:h-[calc(100dvh-180px)] lg:flex-1">
        {/* O CSS do MapLibre põe position:relative no elemento do mapa: ele precisa de um contêiner com tamanho. */}
        <div className="absolute inset-0">
          <div ref={el} className="size-full" role="region" aria-label="Mapa de casos perto do local escolhido" />
        </div>
        {mapState === "loading" && (
          <p role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-text-secondary">
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-brand" /> Carregando mapa…
          </p>
        )}
        {mapState === "error" && (
          <p role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-text-secondary">
            Não conseguimos mostrar o mapa agora. A lista ao lado continua funcionando.
          </p>
        )}

        {movedTo && (
          <button
            type="button"
            onClick={() => go({ center: movedTo, hasCenter: true })}
            className="absolute top-3 left-1/2 inline-flex min-h-11 -translate-x-1/2 animate-pop items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 text-sm font-semibold shadow-md"
          >
            <Search aria-hidden="true" className="size-4" strokeWidth={2} /> Buscar nesta área
          </button>
        )}

        <button
          type="button"
          onClick={locate}
          disabled={locating}
          aria-label="Minha localização"
          className="absolute right-3 bottom-3 inline-flex size-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-primary shadow-md transition-transform active:scale-95 disabled:opacity-60"
        >
          {locating ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <LocateFixed aria-hidden="true" className="size-5" strokeWidth={2} />}
        </button>

        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-10 animate-sheet-up pr-14 lg:right-auto lg:w-96 lg:pr-0" data-testid="map-selected">
            <div className="relative">
              <CaseCard item={selected} compact />
              <button
                type="button"
                onClick={() => setPicked(null)}
                aria-label="Fechar"
                className="absolute top-1.5 right-1.5 inline-flex size-9 items-center justify-center rounded-full bg-surface/90 text-text-secondary hover:text-text-primary"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      <section aria-label="Lista de casos" className="flex flex-col gap-3 lg:order-1 lg:w-[400px] lg:shrink-0">
        {geoError && (
          <p role="alert" className="text-sm font-medium text-danger">
            {geoError}
          </p>
        )}
        <p className="text-sm text-text-secondary" aria-live="polite" data-testid="map-count">
          {load.status === "loading"
            ? "Procurando…"
            : load.status === "error"
              ? "Não conseguimos buscar agora. Tente de novo em instantes."
              : load.total === 0
                ? "Nenhum caso com esses filtros nesta área. Tente aumentar o raio."
                : `${load.total === 1 ? "1 caso" : `${load.total} casos`} em até ${filters.radiusKm} km`}
        </p>
        <ul className="flex flex-col gap-3">
          {items.slice(0, 30).map((i) => (
            <li key={`${i.kind}-${i.code}`}>
              <CaseCard item={i} compact />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Casos na mesma célula aproximada (grade de 250 m) cairiam no mesmo ponto e
 * só o de cima seria clicável: abre-os num círculo (~120 m, dentro da célula), só na tela.
 */
function toPins(items: PublicCaseItem[]) {
  const groups = new Map<string, PublicCaseItem[]>();
  for (const i of items) {
    const k = `${i.position.lat},${i.position.lng}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  return [...groups.values()].flatMap((group) =>
    group.map((i, n) => {
      const angle = (2 * Math.PI * n) / group.length;
      const r = group.length > 1 ? 0.0011 : 0;
      return {
        id: `${i.kind}-${i.code}`,
        kind: i.kind,
        position: { lat: i.position.lat + r * Math.sin(angle), lng: i.position.lng + r * Math.cos(angle) },
        label: itemTitle(i),
      };
    }),
  );
}
