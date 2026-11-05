"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/map.css";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Clock, LoaderCircle, LocateFixed, MapPin, Minus, PawPrint, Plus, Search, SearchX, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { distanceMeters, formatDistance, itemTitle, type PublicCaseItem, type SearchFilters, userErrorMessage } from "@mel/core";
import { listAdoptions, searchPublicCases } from "@mel/data";
import { getCurrentPosition } from "@/lib/geo/client";
import { type AreaMapHandle, mapLibreAreasProvider } from "@/lib/map/maplibre";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useTheme } from "@/components/theme/ThemeProvider";
import { adoptionEntry, caseEntry, feedQuery, type FeedEntry, type FeedState, includesAdoption, includesCases, KIND_BADGE, kindsFor } from "./feed";
import { FeedFiltersBar } from "./FeedFiltersBar";
import { MapDrawer } from "./MapDrawer";

const ZOOM_BY_RADIUS: Record<number, number> = { 1: 15, 3: 13.5, 5: 12.8, 10: 11.8 };
const LEGEND = ["lost", "found", "sighting", "adoption"] as const;

type Load =
  | { status: "loading" }
  | { status: "ok"; cases: PublicCaseItem[]; total: number; entries: FeedEntry[]; adoptions: number }
  | { status: "error" };

/**
 * Mapa da rede (Conceito B): filtros no topo, lista compacta à esquerda e mapa
 * com áreas aproximadas (~100 m) à direita; no celular, alternador Lista/Mapa.
 * Tocar numa área ou num cartão abre a gaveta com os dados públicos do caso.
 */
export function MapExplorer({ state }: { state: FeedState }) {
  const { filters, feed } = state;
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const el = useRef<HTMLDivElement>(null);
  const handle = useRef<AreaMapHandle | null>(null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");
  // Cada montagem (troca de tema) ganha um número: os pinos são redesenhados no mapa novo.
  const [mapVersion, setMapVersion] = useState(0);
  // Resultado guardado com a chave dos filtros: chave diferente = ainda carregando.
  const [result, setResult] = useState<{ key: string; load: Load } | null>(null);
  const [picked, setPicked] = useState<{ key: string; id: string } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const [movedTo, setMovedTo] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const go = (patch: Partial<SearchFilters>) =>
    router.replace(`${pathname}${feedQuery({ ...state, filters: { ...filters, page: 1, ...patch } })}`, { scroll: false });
  const filtersKey = feedQuery(state);
  const load: Load = result?.key === filtersKey ? result.load : { status: "loading" };
  const entries = load.status === "ok" ? load.entries : [];
  const selected = (picked?.key === filtersKey && entries.find((e) => e.id === picked.id)) || null;
  const keyRef = useRef(filtersKey);
  useEffect(() => {
    keyRef.current = filtersKey;
  });

  // Monta o mapa (de novo quando o tema muda: estilo claro/escuro).
  useEffect(() => {
    if (!el.current) return;
    let cancelled = false;
    const unsubs: (() => void)[] = [];
    mapLibreAreasProvider
      .mount(el.current, { center: filters.center, zoom: ZOOM_BY_RADIUS[filters.radiusKm] ?? 13, theme: resolvedTheme })
      .then((h) => {
        if (cancelled) return h.destroy();
        handle.current = h;
        setMapState("ready");
        setMapVersion((v) => v + 1);
        unsubs.push(h.onPinClick((id) => setPicked({ key: keyRef.current, id })));
        unsubs.push(
          h.onMove((b) => {
            const c = { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
            setMovedTo(distanceMeters(c, filters.center) > filters.radiusKm * 300 ? c : null);
          }),
        );
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

  // Busca casos (e adoção, em "Todos"/"Adoção") sempre que os filtros mudam.
  useEffect(() => {
    let cancelled = false;
    const key = filtersKey;
    const client = getBrowserClient();
    const cases = includesCases(feed)
      ? searchPublicCases(client, { ...filters, kinds: kindsFor(feed) }, { pageSize: 100 })
      : Promise.resolve({ items: [] as PublicCaseItem[], total: 0 });
    // Adoção não tem ponto público: entra só na lista. Falhar aqui não derruba o mapa.
    const adoptions = includesAdoption(feed)
      ? listAdoptions(client, { species: filters.species, pageSize: feed === "adoption" ? 60 : 12 }).catch((err) => {
          console.error("[mapa] adoção falhou", err);
          return { items: [], total: 0 };
        })
      : Promise.resolve({ items: [], total: 0 });
    Promise.all([cases, adoptions])
      .then(([c, a]) => {
        if (cancelled) return;
        const entries = [...c.items.map(caseEntry), ...a.items.map(adoptionEntry)];
        setResult({ key, load: { status: "ok", cases: c.items, total: c.total, entries, adoptions: a.total } });
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

  // Áreas: desenha quando o mapa está pronto E há resultado, em qualquer ordem
  // (a busca pode terminar antes ou depois de o mapa carregar).
  useEffect(() => {
    if (mapState === "ready") handle.current?.setPins(toPins(result?.load.status === "ok" ? result.load.cases : []));
  }, [mapState, mapVersion, result]);

  // Realce: a área do cartão sob o mouse ou a do caso aberto.
  const activeId = selected?.id ?? hovered;
  useEffect(() => {
    if (mapState === "ready") handle.current?.setActive(activeId);
  }, [mapState, mapVersion, activeId, result]);

  async function locate() {
    setLocating(true);
    setGeoError(null);
    try {
      const { position } = await getCurrentPosition();
      go({ center: position, hasCenter: true });
    } catch (err) {
      setGeoError(userErrorMessage(err, "Não conseguimos pegar sua localização."));
    } finally {
      setLocating(false);
    }
  }

  const toggle = (
    <div className="mel-view-toggle" role="group" aria-label="Visualização">
      <button type="button" aria-pressed={view === "lista"} onClick={() => setView("lista")}>
        Lista
      </button>
      <button type="button" aria-pressed={view === "mapa"} onClick={() => setView("mapa")}>
        Mapa
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <FeedFiltersBar state={state} variant="map" />

      <div className="-mb-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary" aria-live="polite" data-testid="map-count">
          {countText(load, feed, filters.radiusKm)}
        </p>
        {toggle}
      </div>

      <div className="mel-mapa animate-enter" data-view={view}>
        <section aria-labelledby="lista-casos" className="mel-mapa__list flex min-w-0 flex-col gap-2.5">
          <h2 id="lista-casos" className="sr-only">
            Lista de casos
          </h2>
          {geoError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {geoError}
            </p>
          )}
          {load.status === "loading" ? (
            <ListSkeleton />
          ) : load.status === "ok" && entries.length === 0 ? (
            <div className="grid justify-items-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-border-strong px-6 py-9 text-center text-text-secondary">
              <SearchX aria-hidden="true" className="size-11 text-primary" strokeWidth={1.75} />
              <h3 className="text-xl font-bold text-text-primary">Nada por aqui com esses filtros</h3>
              <p>Isso pode ser uma boa notícia. Amplie o período, aumente o raio ou mude o tipo.</p>
            </div>
          ) : (
            <ul key={filtersKey} className="mel-stagger grid gap-2.5">
              {entries.slice(0, 40).map((e) => (
                <li key={e.id}>
                  <CaseRow entry={e} active={activeId === e.id} onOpen={() => setPicked({ key: filtersKey, id: e.id })} onHover={setHovered} />
                </li>
              ))}
            </ul>
          )}
          {load.status === "ok" && load.adoptions > 0 && (
            <p className="text-xs text-text-muted">Anúncios de adoção aparecem só na lista: eles não marcam local no mapa.</p>
          )}
        </section>

        <div className="mel-mapa__map">
          {/* O CSS do MapLibre põe position:relative no elemento do mapa: ele precisa de um contêiner com tamanho. */}
          <div className="absolute inset-0">
            <div ref={el} className="size-full" role="region" aria-label="Mapa de casos perto do local escolhido" data-map-status={mapState} />
          </div>
          {mapState === "loading" && (
            <p role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[#dbe1ea]">
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" /> Carregando mapa…
            </p>
          )}
          {mapState === "error" && (
            <p role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-[#dbe1ea]">
              Não conseguimos mostrar o mapa agora. A lista continua funcionando.
            </p>
          )}

          <p className="mel-map-chip mel-map-note">
            <ShieldCheck aria-hidden="true" strokeWidth={2} />
            Localização aproximada (~100 m) para proteger tutores
          </p>

          {movedTo && (
            <button
              type="button"
              onClick={() => go({ center: movedTo, hasCenter: true })}
              className="absolute top-16 left-1/2 z-[3] inline-flex min-h-11 -translate-x-1/2 animate-pop items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground shadow-primary"
            >
              <Search aria-hidden="true" className="size-4" strokeWidth={2} /> Buscar nesta área
            </button>
          )}

          <div className="mel-map-controls">
            <button type="button" aria-label="Aproximar" onClick={() => handle.current?.zoomBy(1)} disabled={mapState !== "ready"}>
              <Plus aria-hidden="true" strokeWidth={2} />
            </button>
            <button type="button" aria-label="Afastar" onClick={() => handle.current?.zoomBy(-1)} disabled={mapState !== "ready"}>
              <Minus aria-hidden="true" strokeWidth={2} />
            </button>
            <button type="button" aria-label="Minha localização" onClick={locate} disabled={locating}>
              {locating ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <LocateFixed aria-hidden="true" strokeWidth={2} />}
            </button>
          </div>

          <div className="mel-map-chip mel-map-legend" aria-hidden="true">
            {LEGEND.map((k) => (
              <span key={k} className={`mel-kind--${k}`}>
                <i />
                {KIND_BADGE[k]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {selected && <MapDrawer entry={selected} onClose={() => setPicked(null)} />}
    </div>
  );
}

function countText(load: Load, feed: FeedState["feed"], radiusKm: number): string {
  if (load.status === "loading") return "Procurando…";
  if (load.status === "error") return "Não conseguimos buscar agora. Tente de novo em instantes.";
  const pets = load.adoptions === 1 ? "1 pet para adoção" : `${load.adoptions} pets para adoção`;
  if (feed === "adoption") return pets;
  if (load.total === 0 && load.adoptions === 0) return "Nenhum caso com esses filtros nesta área. Tente aumentar o raio.";
  const cases = `${load.total === 1 ? "1 caso" : `${load.total} casos`} nesta região (até ${radiusKm} km)`;
  return load.adoptions > 0 ? `${cases} · ${pets}` : cases;
}

/** Cartão compacto da lista (Conceito B): miniatura, selo, nome, área, tempo e seta. Abre a gaveta. */
function CaseRow({ entry: e, active, onOpen, onHover }: { entry: FeedEntry; active: boolean; onOpen: () => void; onHover: (id: string | null) => void }) {
  return (
    <button
      type="button"
      data-testid="case-card"
      data-active={active || undefined}
      className={`mel-case mel-kind--${e.kind}`}
      onClick={onOpen}
      onMouseEnter={() => onHover(e.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(e.id)}
      onBlur={() => onHover(null)}
      aria-haspopup="dialog"
    >
      {e.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada no upload
        <img src={e.photoUrl} alt="" loading="lazy" className="mel-case__thumb" />
      ) : (
        <span className="mel-case__thumb flex items-center justify-center text-text-muted">
          <PawPrint aria-hidden="true" className="size-8" strokeWidth={1.5} />
        </span>
      )}
      <span className="block min-w-0">
        <span className="mel-badge">{KIND_BADGE[e.kind]}</span>
        <strong>{e.title}</strong>
        <span className="mel-meta">
          <MapPin aria-hidden="true" strokeWidth={2} />
          <span className="truncate">
            {e.areaLabel ?? "Região aproximada"}
            {e.distanceM != null && ` · a ${formatDistance(e.distanceM)}`}
          </span>
        </span>
        {e.when && (
          <span className="mel-meta">
            <Clock aria-hidden="true" strokeWidth={2} />
            <span className="truncate">{e.when}</span>
          </span>
        )}
      </span>
      <ChevronRight aria-hidden="true" strokeWidth={2.6} />
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-2.5" aria-hidden="true">
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="grid grid-cols-[96px_1fr] items-center gap-3.5 rounded-2xl border border-border bg-surface p-2.5">
          <div className="h-[84px] animate-pulse rounded-xl bg-surface-muted" />
          <div className="grid gap-2">
            <div className="h-5 w-20 animate-pulse rounded-full bg-surface-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-muted" />
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Casos na mesma célula aproximada (grade de 100 m) cairiam no mesmo ponto e
 * só o de cima seria clicável: abre-os num círculo (~45 m, dentro da célula), só na tela.
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
      const r = group.length > 1 ? 0.0004 : 0;
      return {
        id: `${i.kind}-${i.code}`,
        kind: i.kind,
        position: { lat: i.position.lat + r * Math.sin(angle), lng: i.position.lng + r * Math.cos(angle) },
        label: itemTitle(i),
      };
    }),
  );
}
