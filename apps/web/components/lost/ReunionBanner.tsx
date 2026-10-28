import { CircleCheck, Heart, MapPin, Users } from "lucide-react";
import { formatDateTimeBr, FOUND_HOW_PUBLIC, helpersLine, type PublicLostCase } from "@mel/core";

/**
 * Alerta encerrado com reencontro: "MEL ESTÁ EM CASA". Celebração calma
 * (sem confete): selo, agradecimento à comunidade e a história, se houver.
 * `celebrate`: o tutor acabou de confirmar (check com animação discreta).
 */
export function ReunionBanner({ c, celebrate }: { c: PublicLostCase; celebrate: boolean }) {
  const helpers = helpersLine(c.helpersCount);
  return (
    <section
      aria-labelledby="em-casa"
      className="flex animate-enter flex-col gap-4 rounded-card border border-status-found/20 bg-status-found-soft p-5"
    >
      <div className="flex items-center gap-3">
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-full bg-status-found-solid text-text-inverse ${celebrate ? "animate-pop" : ""}`}>
          {celebrate ? (
            <CircleCheck aria-hidden="true" className="size-6" strokeWidth={2} />
          ) : (
            <Heart aria-hidden="true" className="size-5" fill="currentColor" strokeWidth={0} />
          )}
        </span>
        <div className="min-w-0">
          <h2 id="em-casa" className="text-2xl font-bold tracking-[-0.02em] text-status-found uppercase">
            {c.pet.name} está em casa
          </h2>
          {c.foundAt && <p className="text-sm text-text-secondary">Reencontro em {formatDateTimeBr(c.foundAt)}</p>}
        </div>
      </div>

      {celebrate && (
        <p role="status" className="font-semibold">
          Reencontro confirmado. Avisamos quem ajudou na busca.
        </p>
      )}
      <p className="text-body-lg">Obrigado a todos que fizeram parte dessa busca.</p>

      {(c.foundHow || c.foundAreaLabel || helpers) && (
        <ul className="flex flex-col gap-2 text-text-primary">
          {c.foundHow && (
            <li className="flex items-start gap-2">
              <Heart aria-hidden="true" className="mt-1 size-4 shrink-0 text-status-found" strokeWidth={2} />
              {c.pet.name} {FOUND_HOW_PUBLIC[c.foundHow]}.
            </li>
          )}
          {c.foundAreaLabel && (
            <li className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-status-found" strokeWidth={2} />
              Estava perto de {c.foundAreaLabel}
            </li>
          )}
          {helpers && (
            <li className="flex items-start gap-2">
              <Users aria-hidden="true" className="mt-1 size-4 shrink-0 text-status-found" strokeWidth={2} />
              {helpers}
            </li>
          )}
        </ul>
      )}

      {c.reunionStory && (
        <blockquote className="rounded-md border-l-4 border-status-found bg-surface p-4 whitespace-pre-line">
          {c.reunionStory}
        </blockquote>
      )}
    </section>
  );
}
