"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/map.css";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Clock, LoaderCircle, LocateFixed, MapPin, Minus, Plus, Search, SearchX, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { distanceMeters, formatDistance, PERIOD_LABELS, PUBLIC_KINDS, type PublicCaseItem, type RadiusKm, type SearchFilters, userErrorMessage } from "@mel/core";
import { listAdoptions, searchAdoptionsOnMap, searchPublicCases } from "@mel/data";
import { getCurrentPosition } from "@/lib/geo/client";
import { type AreaMapHandle, mapLibreAreasProvider } from "@/lib/map/maplibre";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useTheme } from "@/components/theme/ThemeProvider";
import { adoptionEntry, adoptionMapEntry, caseEntry, FEED_KINDS, feedQuery, type FeedEntry, type FeedState, includesAdoption, includesCases, KIND_BADGE, kindsFor } from "./feed";
import { FeedFiltersBar } from "./FeedFiltersBar";
import { casePoint, spreadPins, ZOOM_BY_RADIUS } from "./pins";
import { MapDrawer } from "./MapDrawer";
import { PetPhoto } from "@/components/ui/PetPhoto";

const CASE_LEGEND = ["lost", "found", "sighting"] as const;

type Load =
  | { status: "loading" }
  | { status: "ok"; cases: PublicCaseItem[]; total: number; entries: FeedEntry[]; adoptions: number; adoptionPins: FeedEntry[] }
  | { status: "error" };

/**
 * Mapa da rede (Conceito B): filtros no topo, lista compacta à esquerda e mapa
 * com áreas aproximadas (~100 m) à direita; no celular, alternador Lista/Mapa.
 * Tocar numa área ou num cartão abre a gaveta com os dados públicos do caso.
 */
export function MapExplorer({ state, showAdoptionOnMap = false }: { state: FeedState; showAdoptionOnMap?: boolean }) {
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
  // Em "Todos", tipos sem nenhum caso no raio/período: diz isso claramente (antes parecia
  // que Perdido e Visto tinham sumido do mapa, quando só estavam fora dos 5 km padrão).
  const missingKinds = load.status === "ok" && feed === "all" && load.total > 0 ? PUBLIC_KINDS.filter((k) => !load.cases.some((c) => c.kind === k)) : [];
  const wider = ([3, 5, 10] as RadiusKm[]).find((r) => r > filters.radiusKm);
  const noCasesOnMap = load.status === "ok" && load.cases.length === 0 && load.adoptionPins.length === 0;
  // Legenda só com o que pode aparecer no mapa (adoção só com a configuração ligada).
  const legend = showAdoptionOnMap ? [...CASE_LEGEND, "adoption" as const] : CASE_LEGEND;
  const keyRef = useRef(filtersKey);
  // Centro e raio atuais para o "Buscar nesta área" (o onMove é registrado uma vez só).
  const areaRef = useRef({ center: filters.center, radiusKm: filters.radiusKm });
  useEffect(() => {
    keyRef.current = filtersKey;
    areaRef.current = { center: filters.center, radiusKm: filters.radiusKm };
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
            const { center, radiusKm } = areaRef.current;
            setMovedTo(distanceMeters(c, center) > radiusKm * 300 ? c : null);
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
    // Centro/raio novos não remontam: o efeito abaixo move o mapa já montado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  // "Perto de mim" e "Buscar nesta área": move o mapa sem recriá-lo (mantém a aba
  // Mapa, o zoom e os filtros). Só o raio novo reajusta o zoom.
  const lastArea = useRef({ lat: filters.center.lat, lng: filters.center.lng, radiusKm: filters.radiusKm });
  useEffect(() => {
    const prev = lastArea.current;
    const { lat, lng } = filters.center;
    if (prev.lat === lat && prev.lng === lng && prev.radiusKm === filters.radiusKm) return;
    lastArea.current = { lat, lng, radiusKm: filters.radiusKm };
    setMovedTo(null);
    handle.current?.setCenter({ lat, lng }, prev.radiusKm === filters.radiusKm ? undefined : (ZOOM_BY_RADIUS[filters.radiusKm] ?? 13));
  }, [filters.center, filters.radiusKm]);

  // Busca casos (e adoção, em "Todos"/"Adoção") sempre que os filtros mudam.
  useEffect(() => {
    let cancelled = false;
    const key = filtersKey;
    const client = getBrowserClient();
    const cases = includesCases(feed)
      ? searchPublicCases(client, { ...filters, kinds: kindsFor(feed) }, { pageSize: 100 })
      : Promise.resolve({ items: [] as PublicCaseItem[], total: 0 });
    // Adoção: com a configuração do administrador ligada, anúncios da região no mapa (ponto
    // público aproximado); desligada, só na lista. Falhar aqui não derruba o mapa.
    const adoptions: Promise<{ entries: FeedEntry[]; total: number; onMap: boolean }> = !includesAdoption(feed)
      ? Promise.resolve({ entries: [], total: 0, onMap: false })
      : (showAdoptionOnMap
          ? searchAdoptionsOnMap(client, { center: filters.center, radiusKm: filters.radiusKm, species: filters.species }).then((items) => ({
              entries: items.map(adoptionMapEntry),
              total: items.length,
              onMap: true,
            }))
          : listAdoptions(client, { species: filters.species, pageSize: feed === "adoption" ? 60 : 12 }).then((a) => ({
              entries: a.items.map(adoptionEntry),
              total: a.total,
              onMap: false,
            }))
        ).catch((err) => {
          console.error("[mapa] adoção falhou", err);
          return { entries: [], total: 0, onMap: false };
        });
    Promise.all([cases, adoptions])
      .then(([c, a]) => {
        if (cancelled) return;
        const entries = [...c.items.map(caseEntry), ...a.entries];
        setResult({ key, load: { status: "ok", cases: c.items, total: c.total, entries, adoptions: a.total, adoptionPins: a.onMap ? a.entries : [] } });
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
    if (mapState !== "ready") return;
    const ok = result?.load.status === "ok" ? result.load : null;
    // Casos e (com a configuração ligada) anúncios de adoção, todos pelo ponto público aproximado.
    const adoptionPoints = (ok?.adoptionPins ?? []).flatMap((e) => (e.position ? [{ id: e.id, kind: "adoption" as const, position: e.position, label: e.title }] : []));
    handle.current?.setPins(spreadPins([...(ok?.cases ?? []).map(casePoint), ...adoptionPoints]));
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

      {missingKinds.length > 0 && (
        <p role="status" data-testid="map-missing-kinds" className="-mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
          <span>
            Sem {joinPt(missingKinds.map((k) => FEED_KINDS.find((o) => o.value === k)!.label))} até {filters.radiusKm} km
            {filters.period === "todos" ? "" : ` nos últimos ${PERIOD_LABELS[filters.period]}`}.
          </span>
          {wider && (
            <button type="button" onClick={() => go({ radiusKm: wider })} className="font-semibold text-link underline underline-offset-4">
              Ampliar para {wider} km
            </button>
          )}
        </p>
      )}

      {/* Avisos do GPS fora da lista: na aba Mapa (celular) a lista fica escondida. */}
      {geoError ? (
        <p role="alert" className="-mt-3 text-sm font-medium text-danger">
          {geoError}
        </p>
      ) : (
        filters.hasCenter && (
          <p role="status" data-testid="map-near-me" className="-mt-3 flex items-center gap-1.5 text-sm text-text-secondary">
            <LocateFixed aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
            Mostrando casos perto da sua localização aproximada.
          </p>
        )
      )}

      <div className="mel-mapa animate-enter" data-view={view}>
        <section aria-labelledby="lista-casos" className="mel-mapa__list flex min-w-0 flex-col gap-2.5">
          <h2 id="lista-casos" className="sr-only">
            Lista de casos
          </h2>
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
          {load.status === "ok" && load.adoptions > 0 && !showAdoptionOnMap && (
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

          {noCasesOnMap && mapState === "ready" && (
            <p role="status" data-testid="map-empty" className="mel-map-chip absolute top-1/2 left-1/2 z-[2] w-max max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-center text-sm">
              {feed === "adoption" && !showAdoptionOnMap ? (
                "Anúncios de adoção aparecem só na lista."
              ) : (
                <>
                  Nenhum caso no mapa com esses filtros.
                  {wider ? ` Tente ampliar para ${wider} km.` : " Tente outro período."}
                </>
              )}
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

          <div className="mel-map-chip mel-map-legend" aria-hidden="true" data-testid="map-legend">
            {legend.map((k) => (
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

/** "Perdidos", "Perdidos e Vistos", "Perdidos, Encontrados e Vistos". */
function joinPt(items: string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
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
      <PetPhoto src={e.photoUrl} alt="" loading="lazy" className="mel-case__thumb" fallbackClassName="mel-case__thumb flex items-center justify-center" iconClassName="size-8" />
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
