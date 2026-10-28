import Link from "next/link";
import { Clock, MapPin, PawPrint } from "lucide-react";
import { colorLabel, formatDistance, itemHref, itemTitle, SIZE_LABELS, SPECIES_LABELS, timeAgo, type PublicCaseItem } from "@mel/core";
import { StatusBadge } from "@/components/ui/StatusBadge";

const BADGE = {
  lost: { status: "lost", label: "Perdido" },
  found: { status: "found", label: "Encontrado" },
  sighting: { status: "sighting", label: "Visto solto" },
} as const;

/**
 * Cartão de caso (DS §19): foto dominante 4:3 com selo flutuante, título,
 * traços, região + distância, tempo e CTA. O cartão inteiro é o link.
 */
export function CaseCard({ item, compact = false }: { item: PublicCaseItem; compact?: boolean }) {
  const badge = BADGE[item.kind];
  const traits = [
    item.kind === "lost" ? SPECIES_LABELS[item.species] : null,
    item.breed,
    item.size && SIZE_LABELS[item.size].label,
    item.colorPrimary && colorLabel(item.colorPrimary),
  ].filter(Boolean);
  const verb = item.kind === "lost" ? "Sumiu" : item.kind === "sighting" ? "Visto" : "Encontrado";

  return (
    <Link
      href={itemHref(item)}
      data-testid="case-card"
      className={`group flex overflow-hidden rounded-card border border-border/70 bg-surface shadow-sm transition-[transform,box-shadow] duration-200 ease-mel hover:shadow-md active:scale-[.99] ${
        compact ? "flex-row" : "flex-col"
      }`}
    >
      <div className={`relative shrink-0 bg-surface-muted ${compact ? "w-28" : "aspect-[4/3] w-full"}`}>
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada no upload
          <img src={item.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-text-muted">
            <PawPrint aria-hidden="true" className="size-10" strokeWidth={1.5} />
          </span>
        )}
        {!compact && (
          <span className="absolute top-3 left-3">
            <StatusBadge status={badge.status} solid>
              {badge.label}
            </StatusBadge>
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
        {compact && (
          <span>
            <StatusBadge status={badge.status}>{badge.label}</StatusBadge>
          </span>
        )}
        <h3 className="truncate text-lg font-bold">{itemTitle(item)}</h3>
        {traits.length > 0 && <p className="truncate text-sm text-text-secondary">{traits.join(" · ")}</p>}
        <p className="flex items-start gap-1.5 text-sm">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} />
          <span className="min-w-0">
            {item.areaLabel ? <span className="font-medium">{item.areaLabel}</span> : "Região aproximada"}
            <span className="block text-text-secondary">a {formatDistance(item.distanceM)} daqui</span>
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Clock aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
          {verb} {timeAgo(item.at)}
        </p>
        {!compact && (
          <span className="mt-1 text-sm font-semibold text-link group-hover:underline">
            {item.kind === "lost" ? "Ver alerta" : "Ver detalhes"}
          </span>
        )}
      </div>
    </Link>
  );
}
