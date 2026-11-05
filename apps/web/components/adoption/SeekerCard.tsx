import { MapPin, PawPrint } from "lucide-react";
import { seekerPreferenceLabel, type PublicSeeker } from "@mel/core";

/** Pessoa na lista pública "Querem adotar": só primeiro nome, bairro e preferências (nada de contato). */
export function SeekerCard({ s }: { s: PublicSeeker }) {
  const initial = (s.firstName ?? "?").charAt(0).toUpperCase();
  return (
    <article className="flex h-full items-start gap-3.5 rounded-[18px] border border-border bg-surface p-5">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-extrabold text-primary">
        {initial}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-lg font-bold">{s.firstName ?? "Pessoa da MEL"} quer adotar</h3>
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <PawPrint aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
          {seekerPreferenceLabel(s)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
          <span className="truncate">{s.areaLabel}</span>
        </p>
      </div>
    </article>
  );
}
