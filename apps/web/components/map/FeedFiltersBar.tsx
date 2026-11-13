"use client";

import { usePathname, useRouter } from "next/navigation";
import { CalendarClock, ChevronDown, Loader2, LocateFixed, MapPin, PawPrint, Radar, Ruler, X, type LucideIcon } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import {
  DEFAULT_CENTER,
  PERIODS,
  PET_SIZES,
  RADII_KM,
  RADIUS_ALL,
  RADIUS_ALL_LABEL,
  SIZE_LABELS,
  type Period,
  type RadiusKm,
  type Species,
  userErrorMessage,
} from "@mel/core";
import { getCurrentPosition } from "@/lib/geo/client";
import { FilterChip } from "@/components/ui/FilterChip";
import { FEED_KINDS, feedQuery, type FeedState } from "./feed";
import { PlaceSearch } from "./PlaceSearch";

const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "dog", label: "Cães" },
  { value: "cat", label: "Gatos" },
  { value: "other", label: "Outros" },
];
// Curtos para caber em duas colunas no celular; o ícone e o rótulo acessível ("Período") dão o contexto.
const PERIOD_OPTIONS: Record<Period, string> = { "24h": "24 horas", "7d": "7 dias", "30d": "30 dias", todos: "Qualquer data" };

const scroller = "-mx-[var(--mel-page-gutter)] flex gap-2 overflow-x-auto px-[var(--mel-page-gutter)] pb-1 [scrollbar-width:none] sm:flex-wrap";

/**
 * Seleção compacta com ícone à esquerda e seta própria (a nativa cortava o texto no Chrome do
 * Windows). Mesma altura e cantos das pílulas e da busca, para a barra ficar numa linha só.
 */
function FilterSelect({
  id,
  label,
  Icon,
  value,
  active,
  onChange,
  children,
}: {
  id: string;
  label: string;
  Icon: LucideIcon;
  value: string;
  /** Diferente do padrão: borda dourada, como uma pílula marcada. */
  active: boolean;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <span className="relative flex">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon aria-hidden="true" className={`pointer-events-none absolute top-1/2 left-3 sm:left-3.5 size-4 -translate-y-1/2 ${active ? "text-primary" : "text-text-secondary"}`} strokeWidth={2.25} />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full appearance-none truncate rounded-full border pr-8 pl-9 text-[13px] font-semibold sm:pr-9 sm:pl-10 sm:text-sm text-text-primary shadow-xs transition-colors hover:bg-surface-muted focus-visible:border-primary focus-visible:outline-none ${active ? "border-primary bg-primary/12" : "border-border-strong bg-surface-elevated"}`}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 sm:right-3.5 size-4 -translate-y-1/2 text-text-secondary" strokeWidth={2.25} />
    </span>
  );
}

/**
 * Filtros do mapa e do mural, em três grupos:
 *  1. O quê — tipo do caso em pílulas (um por vez).
 *  2. Onde — cidade/bairro/CEP, "Perto de mim" e o lugar escolhido (com X para voltar ao padrão).
 *  3. Alcance — distância (até 50 km ou toda a rede), período, espécie e, no mural, porte, em
 *     seleções compactas (antes eram 14 pílulas numa linha que passava da tela).
 * Tudo fica no endereço: dá para compartilhar o link já filtrado.
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

  const ids = `feed-${variant}`;
  return (
    <div className="flex animate-enter flex-col gap-3" aria-busy={pending || undefined}>
      {/* 1. O quê */}
      <div className={scroller} role="group" aria-label="Tipo de caso">
        {FEED_KINDS.map((k) => (
          <FilterChip key={k.value} pressed={current.feed === k.value} onClick={() => apply({ feed: k.value })}>
            {k.label}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        {/* 2. Onde */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Onde procurar">
          <PlaceSearch near={f.center} className="w-full sm:w-72 lg:w-60" onPick={(r) => apply({ filters: { center: r.position, hasCenter: true, place: r.label } })} />
          <FilterChip pressed={f.hasCenter && !f.place} onClick={locate} disabled={locating} small>
            <LocateFixed aria-hidden="true" className="size-4" strokeWidth={2} />
            {locating ? "Localizando…" : "Perto de mim"}
          </FilterChip>
          {f.place && (
            <span className="inline-flex h-10 max-w-full items-center gap-1.5 rounded-full border border-primary bg-primary/15 pr-1 pl-3 text-sm font-semibold text-text-primary">
              <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2.25} />
              <span className="max-w-[16rem] truncate">{f.place}</span>
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

        <span aria-hidden="true" className="hidden h-6 w-px bg-border xl:block" />

        {/* 3. Alcance: distância, período, espécie (e porte no mural) */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center" role="group" aria-label="Alcance da busca">
          <FilterSelect
            id={`${ids}-raio`}
            label="Distância"
            Icon={Radar}
            value={String(f.radiusKm)}
            active={f.radiusKm !== 5}
            onChange={(v) => apply({ filters: { radiusKm: Number(v) as RadiusKm } })}
          >
            {RADII_KM.map((r) => (
              <option key={r} value={r}>
                Até {r} km
              </option>
            ))}
            <option value={RADIUS_ALL}>{RADIUS_ALL_LABEL}</option>
          </FilterSelect>
          <FilterSelect
            id={`${ids}-periodo`}
            label="Período"
            Icon={CalendarClock}
            value={f.period}
            active={f.period !== "30d"}
            onChange={(v) => apply({ filters: { period: v as Period } })}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_OPTIONS[p]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            id={`${ids}-especie`}
            label="Espécie"
            Icon={PawPrint}
            value={f.species.length === 1 ? f.species[0]! : ""}
            active={f.species.length > 0}
            onChange={(v) => apply({ filters: { species: v ? [v as Species] : [] } })}
          >
            <option value="">Todos os pets</option>
            {SPECIES_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </FilterSelect>
          {variant === "mural" && (
            <FilterSelect
              id={`${ids}-porte`}
              label="Porte"
              Icon={Ruler}
              value={current.size ?? ""}
              active={!!current.size}
              onChange={(v) => apply({ size: (v || null) as FeedState["size"] })}
            >
              <option value="">Qualquer porte</option>
              {PET_SIZES.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s].label}
                </option>
              ))}
            </FilterSelect>
          )}
          {pending && (
            <span role="status" className="col-span-2 inline-flex items-center gap-1.5 text-sm text-text-secondary">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Atualizando…
            </span>
          )}
        </div>
        {trailing && <div className="shrink-0 lg:ml-auto">{trailing}</div>}
      </div>

      {geoError && (
        <p role="alert" className="text-sm font-medium text-danger">
          {geoError}
        </p>
      )}
    </div>
  );
}
