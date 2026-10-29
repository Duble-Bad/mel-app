import Link from "next/link";
import { BadgeCheck, MapPin, Store } from "lucide-react";
import { BUSINESS_CATEGORY_LABELS, formatDistance, type PublicBusiness } from "@mel/core";

/** Cartão do diretório de parceiros. "Patrocinado" sempre visível quando há oferta patrocinada. */
export function BusinessCard({ b }: { b: PublicBusiness }) {
  const sponsored = b.offers.some((o) => o.isSponsored);
  return (
    <Link
      href={`/parceiros/${b.code}`}
      data-testid="business-card"
      className="flex gap-4 rounded-card border border-border/70 bg-surface p-4 shadow-sm transition-[transform,box-shadow] duration-200 ease-mel hover:shadow-md active:scale-[.99]"
    >
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft text-primary-soft-foreground">
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo reduzido no envio
          <img src={b.logoUrl} alt="" className="size-full object-cover" />
        ) : (
          <Store aria-hidden="true" className="size-7" strokeWidth={1.75} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-lg font-bold">{b.name}</span>
          {sponsored && <span className="rounded-full border border-border px-2 py-0.5 text-caption font-semibold text-text-secondary">Patrocinado</span>}
        </span>
        <span className="text-sm text-text-secondary">{BUSINESS_CATEGORY_LABELS[b.category]}</span>
        <span className="flex items-start gap-1.5 text-sm">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} />
          <span className="min-w-0">
            {b.addressLabel}
            {b.distanceM != null && <span className="text-text-secondary"> · a {formatDistance(b.distanceM)}</span>}
          </span>
        </span>
        {b.helpsLost && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-status-found">
            <BadgeCheck aria-hidden="true" className="size-4" strokeWidth={2} /> Ajuda com pets perdidos
          </span>
        )}
      </span>
    </Link>
  );
}
