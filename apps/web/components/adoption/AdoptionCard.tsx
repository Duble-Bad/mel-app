import Link from "next/link";
import { MapPin, PawPrint } from "lucide-react";
import { ageLabel, SEX_LABELS, SIZE_LABELS, type PublicAdoption } from "@mel/core";
import { StatusBadge } from "@/components/ui/StatusBadge";

/** Cartão de adoção (DS §18): foto 1:1 dominante, selo, nome, traços e região. */
export function AdoptionCard({ a }: { a: PublicAdoption }) {
  const traits = [ageLabel(a.ageMonths), a.size && SIZE_LABELS[a.size].label, a.sex !== "unknown" && SEX_LABELS[a.sex]].filter(Boolean);
  return (
    <Link
      href={`/adocao/${a.code}`}
      data-testid="adoption-card"
      className="group flex flex-col overflow-hidden rounded-card border border-border/70 bg-surface shadow-sm transition-[transform,box-shadow] duration-200 ease-mel hover:shadow-md active:scale-[.99]"
    >
      <div className="relative aspect-square bg-surface-muted">
        {a.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio
          <img src={a.photoUrls[0]} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-text-muted">
            <PawPrint aria-hidden="true" className="size-10" strokeWidth={1.5} />
          </span>
        )}
        <span className="absolute top-3 left-3">
          <StatusBadge status="adoption" solid>
            {a.status === "IN_PROCESS" ? "Em processo" : "Adoção"}
          </StatusBadge>
        </span>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <h3 className="text-lg font-bold">{a.name}</h3>
        <p className="text-sm text-text-secondary">{traits.join(" · ")}</p>
        {a.areaLabel && (
          <p className="flex items-center gap-1.5 text-sm">
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-brand" strokeWidth={2} />
            {a.areaLabel}
          </p>
        )}
        <span className="mt-1 text-sm font-semibold text-link group-hover:underline">Conhecer {a.name}</span>
      </div>
    </Link>
  );
}
