import Link from "next/link";
import { Cake, MapPin, PawPrint } from "lucide-react";
import { ageLabel, SIZE_LABELS, type PublicAdoption } from "@mel/core";
import "./adoption.css";

const SEX_SYMBOL = {
  male: { sign: "♂", label: "macho", className: "text-status-sighting-accent" },
  female: { sign: "♀", label: "fêmea", className: "text-coral-400" },
} as const;

/**
 * Cartão de adoção (Conceito B): foto, selo ADOÇÃO, nome + símbolo do sexo,
 * região aproximada, idade · porte e "Ver detalhes". O cartão inteiro é o link.
 */
export function AdoptionCard({ a }: { a: PublicAdoption }) {
  const sex = a.sex === "male" || a.sex === "female" ? SEX_SYMBOL[a.sex] : null;
  const traits = [ageLabel(a.ageMonths), a.size && `porte ${SIZE_LABELS[a.size].label.toLowerCase()}`].filter(Boolean).join(" · ");
  return (
    <article
      data-testid="adoption-card"
      className="mel-adopt-card relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm hover:shadow-md"
    >
      <div className="relative aspect-[4/3.3] overflow-hidden bg-surface-muted">
        {a.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio
          <img src={a.photoUrls[0]} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-text-muted">
            <PawPrint aria-hidden="true" className="size-10" strokeWidth={1.5} />
          </span>
        )}
        <span className="absolute bottom-3 left-3 inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-[11.5px] font-extrabold tracking-[.06em] text-primary-foreground uppercase">
          {a.status === "IN_PROCESS" ? "Em processo" : "Adoção"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3.5 pb-4">
        <h3 className="flex items-center gap-1.5 text-xl font-extrabold">
          {/* O link cobre o cartão todo; o nome é o texto acessível. */}
          <Link href={`/adocao/${a.code}`} className="after:absolute after:inset-0 after:z-[1] after:rounded-card focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-[-3px] focus-visible:after:outline-focus">
            {a.name}
          </Link>
          {sex && (
            <span className={sex.className} aria-label={sex.label} title={sex.label}>
              {sex.sign}
            </span>
          )}
        </h3>
        {a.areaLabel && (
          <p className="flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
            <span className="truncate">{a.areaLabel}</span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Cake aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
          {traits}
        </p>
        <span
          aria-hidden="true"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground shadow-primary"
        >
          Ver detalhes
        </span>
      </div>
    </article>
  );
}
