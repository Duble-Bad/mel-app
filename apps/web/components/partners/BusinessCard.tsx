import Link from "next/link";
import { BadgeCheck, HandHeart, MapPin, Store, UserRound } from "lucide-react";
import { BUSINESS_CATEGORY_LABELS, formatDistance, hasApproximateLocation, PARTNER_KIND_LABELS, type PublicBusiness } from "@mel/core";
import { visibleOffers } from "./flags";

const KIND_ICON = { company: Store, ngo: HandHeart, independent: UserRound } as const;

/**
 * Cartão do diretório de parceiros. "Patrocinado" só com a flag ligada
 * (desligada no piloto). ONG e protetor mostram só bairro/cidade.
 */
export function BusinessCard({ b }: { b: PublicBusiness }) {
  const sponsored = visibleOffers(b.offers).some((o) => o.isSponsored);
  const Icon = KIND_ICON[b.kind];
  const kindLabel = b.kind === "company" ? BUSINESS_CATEGORY_LABELS[b.category] : PARTNER_KIND_LABELS[b.kind];
  return (
    <Link
      href={`/parceiros/${b.code}`}
      data-testid="business-card"
      className="flex gap-4 rounded-card border border-border/70 bg-surface p-4 shadow-sm transition-[transform,box-shadow] duration-200 ease-mel hover:shadow-md active:scale-[.99] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft text-primary-soft-foreground">
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo reduzido no envio
          <img src={b.logoUrl} alt="" className="size-full object-cover" />
        ) : (
          <Icon aria-hidden="true" className="size-7" strokeWidth={1.75} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-lg font-bold">{b.name}</span>
          {sponsored && <span className="rounded-full border border-border px-2 py-0.5 text-caption font-semibold text-text-secondary">Patrocinado</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
          {kindLabel}
          {b.cnpjVerified && (
            <span className="inline-flex items-center gap-1 font-semibold text-status-found">
              <BadgeCheck aria-hidden="true" className="size-4" strokeWidth={2} /> CNPJ verificado
            </span>
          )}
        </span>
        <span className="flex items-start gap-1.5 text-sm">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} />
          <span className="min-w-0 break-words">
            {b.addressLabel}
            {hasApproximateLocation(b) && <span className="text-text-secondary"> (região aproximada)</span>}
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
