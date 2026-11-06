import Link from "next/link";
import { cache } from "react";
import { connection } from "next/server";
import { ChevronRight, MapPin, SearchX } from "lucide-react";
import { DEFAULT_CENTER_LABEL, itemHref, itemTitle, parseSearchParams, timeAgo, type PublicCaseItem, type PublicKind } from "@mel/core";
import { searchPublicCases } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { PetPhoto } from "@/components/ui/PetPhoto";
import { ZOOM_BY_RADIUS } from "@/components/map/pins";
import { HomeMapPreview } from "./HomeMapPreview";

const KIND: Record<PublicKind, { label: string; color: string }> = {
  lost: { label: "Perdido", color: "var(--color-status-lost-accent)" },
  found: { label: "Encontrado", color: "var(--color-status-found-accent)" },
  sighting: { label: "Visto", color: "var(--color-status-sighting-accent)" },
};

/**
 * Os mesmos casos públicos do /mapa (filtros padrão: parseSearchParams sem nada), já
 * aproximados pelo banco. `cache`: mapa e mural da home dividem a consulta na requisição.
 */
const mapCases = cache(async (): Promise<{ items: PublicCaseItem[]; total: number } | null> => {
  try {
    return await searchPublicCases(createPublicClient(), DEFAULT_MAP_FILTERS, { pageSize: 100 });
  } catch (error) {
    console.error("[home] casos do mapa falharam", error);
    return null;
  }
});
const DEFAULT_MAP_FILTERS = parseSearchParams({});

export async function RegionMapPanel() {
  await connection();
  const cases = await mapCases();
  if (!cases) return <p className="px-5 py-16 text-center text-text-secondary">Não conseguimos carregar o mapa agora. Atualize a página em instantes.</p>;
  if (cases.total === 0)
    return (
      <Link href="/mapa" className="flex min-h-[300px] flex-col items-center justify-center gap-2 px-6 py-12 text-center sm:min-h-[360px]">
        <SearchX aria-hidden="true" className="size-9 text-text-muted" strokeWidth={1.75} />
        <span className="font-bold">Nenhum caso no mapa por aqui agora</span>
        <span className="max-w-[36ch] text-sm text-text-secondary">Quando alguém publicar um perdido, encontrado ou avistamento, ele aparece no mapa.</span>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary">
          Abrir mapa <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.5} />
        </span>
      </Link>
    );
  return (
    <HomeMapPreview
      items={cases.items}
      total={cases.total}
      center={DEFAULT_MAP_FILTERS.center}
      zoom={ZOOM_BY_RADIUS[DEFAULT_MAP_FILTERS.radiusKm] ?? 12.8}
      areaLabel={DEFAULT_CENTER_LABEL}
    />
  );
}

export async function RegionListPanel() {
  await connection();
  const cases = await mapCases();
  // A busca ordena por distância; no mural da home interessa o mais novo.
  const items = cases && [...cases.items].sort((a, b) => b.at.localeCompare(a.at));
  if (!items) return <p className="px-5 py-10 text-center text-text-secondary">Não conseguimos carregar agora. Atualize a página em instantes.</p>;
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <SearchX aria-hidden="true" className="size-9 text-text-muted" strokeWidth={1.75} />
        <p className="font-bold">Nenhum caso recente por aqui</p>
        <p className="max-w-[36ch] text-sm text-text-secondary">Isso pode ser uma boa notícia. Quando alguém publicar um perdido, encontrado ou avistamento, ele aparece aqui.</p>
      </div>
    );
  const now = new Date();
  return (
    <ul>
      {items.slice(0, 4).map((item) => {
        const k = KIND[item.kind];
        return (
          <li key={`${item.kind}-${item.code}`} className="border-b border-border last:border-b-0">
            <Link href={itemHref(item)} className="group grid grid-cols-[64px_1fr_auto] items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-muted sm:px-5">
              <span className="size-16 overflow-hidden rounded-xl bg-surface-muted">
                <PetPhoto src={item.photoUrl} alt="" loading="lazy" className="size-full object-cover" iconClassName="size-7" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                {/* Tom escurecido: texto branco legível sobre a cor do status. */}
                <span
                  className="w-fit rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-[.06em] text-white uppercase"
                  style={{ background: `color-mix(in srgb, ${k.color} 78%, black)` }}
                >
                  {k.label}
                </span>
                <strong className="truncate text-[17px]">{itemTitle(item)}</strong>
                <span className="flex items-center gap-1 truncate text-[13px] text-text-secondary">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-primary" strokeWidth={2} />
                  <span className="truncate">
                    {item.areaLabel ?? "Área aproximada"} · {timeAgo(item.at, now)}
                  </span>
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 text-text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
