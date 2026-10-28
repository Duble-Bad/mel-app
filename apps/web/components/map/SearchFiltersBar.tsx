"use client";

import { usePathname, useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { useState, useTransition } from "react";
import {
  PERIOD_LABELS,
  PERIODS,
  PUBLIC_KIND_LABELS,
  PUBLIC_KINDS,
  RADII_KM,
  SPECIES_LABELS,
  toSearchParams,
  type PublicKind,
  type SearchFilters,
  type Species,
} from "@mel/core";
import { getCurrentPosition } from "@/lib/geo/client";
import { FilterChip } from "@/components/ui/FilterChip";

const SPECIES_FILTER: Species[] = ["dog", "cat", "other"];

/**
 * Filtros em pílulas (rolagem horizontal no celular). Mudam o endereço, que é
 * a fonte da verdade: dá para compartilhar o link já filtrado.
 */
export function SearchFiltersBar({ filters, fixedKinds }: { filters: SearchFilters; fixedKinds?: PublicKind[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  // Toques rápidos em sequência: cada um parte do último aplicado, não da última
  // resposta do servidor (que ainda pode não ter chegado) — senão um apaga o outro.
  const [queued, setQueued] = useState<SearchFilters | null>(null);
  const propsKey = toSearchParams(filters, fixedKinds);
  const current = queued && toSearchParams(queued, fixedKinds) !== propsKey ? queued : filters;

  const apply = (patch: Partial<SearchFilters>) => {
    const next = { ...current, page: 1, ...patch };
    setQueued(next);
    startTransition(() => router.replace(`${pathname}${toSearchParams(next, fixedKinds)}`, { scroll: false }));
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function locate() {
    setLocating(true);
    setGeoError(null);
    try {
      const { position } = await getCurrentPosition();
      apply({ center: position, hasCenter: true });
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Não conseguimos pegar sua localização.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5" aria-busy={pending || undefined}>
      <div className="-mx-[var(--mel-page-gutter)] flex gap-2 overflow-x-auto px-[var(--mel-page-gutter)] pb-1 [scrollbar-width:none]" role="group" aria-label="Filtros">
        <FilterChip pressed={current.hasCenter} onClick={locate} disabled={locating}>
          <LocateFixed aria-hidden="true" className="size-4" strokeWidth={2} />
          {locating ? "Localizando…" : "Perto de mim"}
        </FilterChip>
        {!fixedKinds &&
          PUBLIC_KINDS.map((k) => (
            <FilterChip
              key={k}
              pressed={current.kinds.includes(k) && current.kinds.length < PUBLIC_KINDS.length}
              onClick={() => {
                const only = current.kinds.length === PUBLIC_KINDS.length;
                const next = only ? [k] : toggle(current.kinds, k);
                apply({ kinds: next.length ? next : [...PUBLIC_KINDS] });
              }}
            >
              {PUBLIC_KIND_LABELS[k]}
            </FilterChip>
          ))}
        {SPECIES_FILTER.map((s) => (
          <FilterChip key={s} pressed={current.species.includes(s)} onClick={() => apply({ species: toggle(current.species, s) })}>
            {s === "other" ? "Outros" : `${SPECIES_LABELS[s]}s`}
          </FilterChip>
        ))}
      </div>
      <div className="-mx-[var(--mel-page-gutter)] flex gap-2 overflow-x-auto px-[var(--mel-page-gutter)] pb-1 [scrollbar-width:none]" role="group" aria-label="Período e distância">
        {PERIODS.map((p) => (
          <FilterChip key={p} pressed={current.period === p} onClick={() => apply({ period: p })}>
            {PERIOD_LABELS[p]}
          </FilterChip>
        ))}
        <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-border" />
        {RADII_KM.map((r) => (
          <FilterChip key={r} pressed={current.radiusKm === r} onClick={() => apply({ radiusKm: r })} aria-label={`Raio de ${r} km`}>
            {r} km
          </FilterChip>
        ))}
      </div>
      {geoError && (
        <p role="alert" className="text-sm font-medium text-danger">
          {geoError}
        </p>
      )}
    </div>
  );
}
