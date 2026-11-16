import Link from "next/link";
import { Cake, MapPin, PawPrint } from "lucide-react";
import { ageLabel, SIZE_LABELS, type PublicAdoption } from "@mel/core";
import "@/app/map.css";
import "./adoption.css";

const SEX_SYMBOL = {
  male: { sign: "♂", label: "macho", className: "text-status-sighting-accent" },
  female: { sign: "♀", label: "fêmea", className: "mel-adopt-female-sign" },
} as const;

/**
 * Cartão de adoção (Conceito B): foto, selo ADOÇÃO, nome + símbolo do sexo, região aproximada,
 * idade · porte e "Ver detalhes". Mesmo efeito dos cartões do Mural (moldura de luz girando, aura no
 * hover e pegadas no canto; ver map.css), na cor do sexo: macho (e sexo não informado) dourado,
 * fêmea rosa. O cartão inteiro é o link (camada por cima), com o nome do pet como texto acessível.
 */
export function AdoptionCard({ a }: { a: PublicAdoption }) {
  const sex = a.sex === "male" || a.sex === "female" ? SEX_SYMBOL[a.sex] : null;
  const traits = [ageLabel(a.ageMonths), a.size && `porte ${SIZE_LABELS[a.size].label.toLowerCase()}`].filter(Boolean).join(" · ");
  return (
    <article data-testid="adoption-card" className={`mel-pet mel-adopt-card mel-kind--adoption${a.sex === "female" ? " mel-adopt--female" : ""}`}>
      <span aria-hidden="true" className="mel-pet__beam" />
      <div className="mel-pet__media">
        {a.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio
          <img src={a.photoUrls[0]} alt="" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center text-text-muted">
            <PawPrint aria-hidden="true" className="size-10" strokeWidth={1.5} />
          </span>
        )}
        <span className="mel-badge">{a.status === "IN_PROCESS" ? "Em processo" : "Adoção"}</span>
      </div>
      <div className="mel-pet__body">
        <h3 className="flex items-center gap-1.5">
          <span className="truncate">{a.name}</span>
          {sex && (
            <span className={sex.className} aria-label={sex.label} title={sex.label}>
              {sex.sign}
            </span>
          )}
        </h3>
        {a.areaLabel && (
          <p className="mel-meta">
            <MapPin aria-hidden="true" strokeWidth={2} />
            <span className="truncate">{a.areaLabel}</span>
          </p>
        )}
        <p className="mel-meta">
          <Cake aria-hidden="true" strokeWidth={2} />
          <span className="truncate">{traits}</span>
        </p>
        <span aria-hidden="true" className="mel-pet__more">
          Ver detalhes
        </span>
        <span aria-hidden="true" className="mel-pet__paws">
          {[0, 1, 2].map((i) => (
            <svg key={i} viewBox="0 0 24 24" style={{ "--i": i } as React.CSSProperties}>
              <ellipse cx="5.5" cy="10" rx="2.2" ry="2.8" />
              <ellipse cx="9.5" cy="5.6" rx="2.2" ry="2.9" />
              <ellipse cx="14.5" cy="5.6" rx="2.2" ry="2.9" />
              <ellipse cx="18.5" cy="10" rx="2.2" ry="2.8" />
              <path d="M12 11.2c-3.3 0-6.4 4.3-6.4 6.9 0 1.9 1.4 2.9 3.2 2.9 1.4 0 2.1-.7 3.2-.7s1.8.7 3.2.7c1.8 0 3.2-1 3.2-2.9 0-2.6-3.1-6.9-6.4-6.9z" />
            </svg>
          ))}
        </span>
      </div>
      <Link href={`/adocao/${a.code}`} aria-label={a.name} className="mel-adopt-card__link" />
    </article>
  );
}
