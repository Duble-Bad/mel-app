import "@/app/map.css";
import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { formatDistance, type PublicAdoption, type PublicCaseItem } from "@mel/core";
import { adoptionEntry, caseEntry, KIND_BADGE, type FeedEntry } from "./feed";
import { PetPhoto } from "@/components/ui/PetPhoto";

/**
 * Cartão do mural (Conceito B): foto dominante 4:3 com o selo do tipo sobre
 * ela, nome, traços, área aproximada, tempo e "Ver detalhes". O cartão inteiro é o link.
 * Estilo "moldura de luz" (conceito B): feixe dourado contornando a borda, aura e pegadas no hover.
 */
export function CaseCard({ item }: { item: PublicCaseItem }) {
  return <FeedCard entry={caseEntry(item)} testId="case-card" />;
}

/** Anúncio de adoção no mural (mesmo cartão, selo ADOÇÃO). */
export function AdoptionFeedCard({ adoption }: { adoption: PublicAdoption }) {
  return <FeedCard entry={adoptionEntry(adoption)} testId="adoption-card" />;
}

function FeedCard({ entry: e, testId }: { entry: FeedEntry; testId: string }) {
  // Casos: espécie, raça, porte e cor numa linha. Adoção já traz idade e porte na linha de tempo.
  const traits = e.kind === "adoption" ? [] : e.facts.map((f) => f.value);
  return (
    <Link href={e.href} data-testid={testId} className={`mel-pet mel-kind--${e.kind} focus-visible:outline-offset-2`}>
      {/* Moldura de luz (conceito B): feixe dourado que contorna o cartão; ver map.css. */}
      <span aria-hidden="true" className="mel-pet__beam" />
      <div className="mel-pet__media">
        <PetPhoto src={e.photoUrl} alt="" loading="lazy" decoding="async" width={600} height={450} />
        <span className="mel-badge">{KIND_BADGE[e.kind]}</span>
      </div>
      <div className="mel-pet__body">
        <h3>{e.title}</h3>
        {traits.length > 0 && <p className="truncate text-sm text-text-muted">{traits.join(" · ")}</p>}
        <p className="mel-meta">
          <MapPin aria-hidden="true" strokeWidth={2} />
          <span className="truncate">
            {e.areaLabel ?? "Região aproximada"}
            {e.distanceM != null && ` · a ${formatDistance(e.distanceM)}`}
          </span>
        </p>
        {e.when && (
          <p className="mel-meta">
            <Clock aria-hidden="true" strokeWidth={2} />
            <span className="truncate">{e.when}</span>
          </p>
        )}
        <span className="mel-pet__more">{e.kind === "lost" ? "Ver alerta" : "Ver detalhes"}</span>
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
    </Link>
  );
}
