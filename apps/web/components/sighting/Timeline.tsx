"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { describeSighting, formatDateTimeBr, timeAgo, type TimelineSighting } from "@mel/core";
import { openConversationFromSighting, setSightingHidden } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";

interface TimelineProps {
  petName: string;
  lastSeen: { at: string; areaLabel: string | null } | null;
  sightings: TimelineSighting[];
  isOwner: boolean;
}

/** Linha do tempo: último local conhecido + avistamentos em ordem cronológica. */
export function Timeline({ petName, lastSeen, sightings, isOwner }: TimelineProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(s: TimelineSighting) {
    setPending(s.id);
    setError(null);
    try {
      await setSightingHidden(getBrowserClient(), s.id, !s.hidden);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos atualizar. Tente de novo.");
    } finally {
      setPending(null);
    }
  }

  async function reply(s: TimelineSighting) {
    setPending(s.id);
    setError(null);
    try {
      router.push(`/conversas/${await openConversationFromSighting(getBrowserClient(), s.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos abrir a conversa. Tente de novo.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {sightings.length === 0 && (
        <p className="rounded-md bg-surface-muted p-3 text-text-secondary">
          Ainda não há avistamentos. {isOwner ? "Compartilhe o alerta para alcançar mais gente." : `Viu ${petName}? Conte pra gente.`}
        </p>
      )}
      <ol className="flex flex-col gap-4 border-l-2 border-status-sighting pl-4">
        {lastSeen && (
          <li className="relative">
            <span aria-hidden="true" className="absolute top-1.5 -left-[1.4rem] size-3 rounded-full bg-status-lost" />
            <p className="text-sm text-text-secondary">{formatDateTimeBr(lastSeen.at)}</p>
            <p className="font-semibold">
              {petName} visto(a) pela última vez{lastSeen.areaLabel ? ` perto de ${lastSeen.areaLabel}` : ""}.
            </p>
          </li>
        )}
        {sightings.map((s, i) => (
          <li key={s.id} className={`relative ${s.hidden ? "opacity-60" : ""}`} data-testid="timeline-sighting">
            <span aria-hidden="true" className="absolute top-1.5 -left-[1.4rem] size-3 rounded-full bg-status-sighting" />
            <p className="text-sm text-text-secondary">
              {formatDateTimeBr(s.seenAt)} · {timeAgo(s.seenAt)}
            </p>
            <p className="font-semibold">
              <span className="sr-only">Avistamento {i + 1}: </span>
              {describeSighting(s)}
              {s.placeLabel ? ` · perto de ${s.placeLabel}` : ""}
            </p>
            {s.notes && <p className="whitespace-pre-line">{s.notes}</p>}
            {s.photoUrl && (
              <a href={s.photoUrl} target="_blank" rel="noreferrer" className="mt-1 block w-32 overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio */}
                <img src={s.photoUrl} alt={`Foto do avistamento ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
            )}
            {s.hidden && <p className="text-sm font-semibold">Oculto — só você vê.</p>}
            {isOwner && (
              <div className="mt-1 flex flex-wrap gap-x-5">
                {s.canReply && !s.hidden && (
                  <button
                    type="button"
                    disabled={pending === s.id}
                    onClick={() => reply(s)}
                    className="min-h-11 text-sm font-semibold text-brand-primary underline-offset-4 hover:underline"
                  >
                    💬 Responder a quem viu
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending === s.id}
                  onClick={() => toggle(s)}
                  className="min-h-11 text-sm font-semibold text-brand-primary underline-offset-4 hover:underline"
                >
                  {s.hidden ? "Mostrar de novo" : "Ocultar (ex.: spam ou engano)"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
