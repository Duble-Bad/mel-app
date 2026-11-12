"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LocateFixed, MapPin, X } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { DEFAULT_CENTER, PERIOD_LABELS, PERIODS, PET_SIZES, RADII_KM, RADIUS_ALL, RADIUS_ALL_LABEL, SIZE_LABELS, type Species, userErrorMessage } from "@mel/core";
import { getCurrentPosition } from "@/lib/geo/client";
import { FilterChip } from "@/components/ui/FilterChip";
import { FEED_KINDS, feedQuery, type FeedState } from "./feed";
import { PlaceSearch } from "./PlaceSearch";

const SPECIES_CHIPS: { value: Species; label: string }[] = [
  { value: "dog", label: "Cachorros" },
  { value: "cat", label: "Gatos" },
  { value: "other", label: "Outros" },
];
const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "dog", label: "Cães" },
  { value: "cat", label: "Gatos" },
  { value: "other", label: "Outros" },
];

const scroller = "-mx-[var(--mel-page-gutter)] flex gap-2 overflow-x-auto px-[var(--mel-page-gutter)] pb-1 [scrollbar-width:none]";
// Mesma altura e cantos dos botões do topo do mural ("Para adoção", "Ver no mapa"). Sem a seta
// nativa (no Chrome do Windows ela ocupava o espaço do texto e cortava "porte"): o ícone é nosso.
const select =
  "min-h-12 w-full min-w-[9.5rem] appearance-none truncate rounded-md border border-border-strong bg-surface-elevated pr-8 pl-3 sm:pr-10 sm:pl-4 text-sm font-semibold text-text-primary shadow-xs transition-colors hover:bg-surface-muted focus-visible:border-primary";

/** Select do mural com a seta desenhada por cima (não intercepta o toque). */
function SelectBox({ children }: { children: ReactNode }) {
  return (
    <span className="relative flex">
      {children}
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 sm:right-3.5 text-text-secondary" strokeWidth={2.25} />
    </span>
  );
}

/**
 * Filtros do mapa e do mural (Conceito B): tipo em pílulas (um por vez),
 * onde procurar (cidade/bairro, "Perto de mim"), período, raio (até 50 km ou toda a rede) e espécie (pílulas no mapa, seleção no mural,
 * com porte). Tudo no endereço: dá para compartilhar o link já filtrado.
 */
export function FeedFiltersBar({ state, variant, trailing }: { state: FeedState; variant: "map" | "mural"; trailing?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  // Toques rápidos em sequência partem do último aplicado (a resposta do servidor pode não ter chegado).
  const [queued, setQueued] = useState<FeedState | null>(null);
  const current = queued && feedQuery(queued) !== feedQuery(state) ? queued : state;
  const f = current.filters;

  const apply = (patch: Partial<Omit<FeedState, "filters">> & { filters?: Partial<FeedState["filters"]> }) => {
    const next: FeedState = {
      feed: patch.feed ?? current.feed,
      size: patch.size === undefined ? current.size : patch.size,
      filters: { ...f, page: 1, ...patch.filters },
    };
    setQueued(next);
    startTransition(() => router.replace(`${pathname}${feedQuery(next)}`, { scroll: false }));
  };

  async function locate() {
    setLocating(true);
    setGeoError(null);
    try {
      const { position } = await getCurrentPosition();
      apply({ filters: { center: position, hasCenter: true, place: undefined } });
    } catch (err) {
      setGeoError(userErrorMessage(err, "Não conseguimos pegar sua localização."));
    } finally {
      setLocating(false);
    }
  }

  const nearMe = (
    <FilterChip pressed={f.hasCenter && !f.place} onClick={locate} disabled={locating} small>
      <LocateFixed aria-hidden="true" className="size-4" strokeWidth={2} />
      {locating ? "Localizando…" : "Perto de mim"}
    </FilterChip>
  );
  // Onde procurar: cidade/bairro (sem GPS), "Perto de mim" e o lugar escolhido (com X para voltar ao padrão).
  const locationRow = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Onde procurar">
      <PlaceSearch
        near={f.center}
        className="w-full sm:w-72"
        onPick={(r) => apply({ filters: { center: r.position, hasCenter: true, place: r.label } })}
      />
      {nearMe}
      {f.place && (
        <span className="inline-flex h-10 max-w-full items-center gap-1.5 rounded-full border border-primary bg-primary/15 pr-1 pl-3 text-sm font-semibold text-text-primary">
          <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2.25} />
          <span className="truncate">{f.place}</span>
          <button
            type="button"
            onClick={() => apply({ filters: { center: DEFAULT_CENTER, hasCenter: false, place: undefined } })}
            aria-label={`Remover ${f.place}`}
            className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={2.25} />
          </button>
        </span>
      )}
    </div>
  );
  const kindChips = (
    <div className={`${scroller} sm:flex-wrap`} role="group" aria-label="Tipo de caso">
      {FEED_KINDS.map((k) => (
        <FilterChip key={k.value} pressed={current.feed === k.value} onClick={() => apply({ feed: k.value })}>
          {k.label}
        </FilterChip>
      ))}
    </div>
  );
  const periodRadius = (
    <>
      {PERIODS.map((p) => (
        <FilterChip key={p} small pressed={f.period === p} onClick={() => apply({ filters: { period: p } })}>
          {PERIOD_LABELS[p]}
        </FilterChip>
      ))}
      <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-border" />
      {RADII_KM.map((r) => (
        <FilterChip key={r} small pressed={f.radiusKm === r} onClick={() => apply({ filters: { radiusKm: r } })} aria-label={`Raio de ${r} km`}>
          {r} km
        </FilterChip>
      ))}
      <FilterChip small pressed={f.radiusKm === RADIUS_ALL} onClick={() => apply({ filters: { radiusKm: RADIUS_ALL } })}>
        {RADIUS_ALL_LABEL}
      </FilterChip>
    </>
  );

  return (
    <div className="flex animate-enter flex-col gap-3" aria-busy={pending || undefined}>
      {variant === "map" ? (
        <>
          {kindChips}
          {locationRow}
          <div className="flex items-center gap-3">
            <div className={`${scroller} min-w-0 flex-1 lg:flex-wrap`} role="group" aria-label="Período, distância e espécie">
              {periodRadius}
              <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-border" />
              {SPECIES_CHIPS.map((s) => (
                <FilterChip
                  key={s.value}
                  small
                  pressed={f.species.includes(s.value)}
                  onClick={() => apply({ filters: { species: f.species.includes(s.value) ? f.species.filter((x) => x !== s.value) : [...f.species, s.value] } })}
                >
                  {s.label}
                </FilterChip>
              ))}
            </div>
            {trailing && <div className="shrink-0">{trailing}</div>}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {kindChips}
            <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:gap-2">
              <label className="sr-only" htmlFor="mural-especie">
                Espécie
              </label>
              <SelectBox>
                <select
                  id="mural-especie"
                  className={select}
                  value={f.species.length === 1 ? f.species[0] : ""}
                  onChange={(e) => apply({ filters: { species: e.target.value ? [e.target.value as Species] : [] } })}
                >
                  <option value="">Cães e gatos</option>
                  {SPECIES_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </SelectBox>
              <label className="sr-only" htmlFor="mural-porte">
                Porte
              </label>
              <SelectBox>
                <select
                  id="mural-porte"
                  className={select}
                  value={current.size ?? ""}
                  onChange={(e) => apply({ size: (e.target.value || null) as FeedState["size"] })}
                >
                  <option value="">Qualquer porte</option>
                  {PET_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {SIZE_LABELS[s].label}
                    </option>
                  ))}
                </select>
              </SelectBox>
            </div>
          </div>
          {locationRow}
          <div className={`${scroller} lg:flex-wrap`} role="group" aria-label="Período e distância">
            {periodRadius}
          </div>
        </>
      )}
      {geoError && (
        <p role="alert" className="text-sm font-medium text-danger">
          {geoError}
        </p>
      )}
    </div>
  );
}
