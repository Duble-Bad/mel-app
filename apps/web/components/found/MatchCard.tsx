"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, MessageCircle, PawPrint } from "lucide-react";
import { useState } from "react";
import { describeMatchReasons, matchLabel, type MatchView, userErrorMessage } from "@mel/core";
import { dismissMatch, openConversationFromMatch } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Button, ButtonLink } from "@/components/ui/Button";

function Photo({ url, alt, label }: { url: string | null; alt: string; label: string }) {
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-1.5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada no upload
        <img src={url} alt={alt} loading="lazy" className="aspect-square w-full rounded-lg bg-surface-muted object-cover" />
      ) : (
        <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-surface-muted text-text-muted">
          <PawPrint aria-hidden="true" className="size-8" strokeWidth={1.5} />
          <span className="sr-only">{alt} (sem foto)</span>
        </span>
      )}
      <figcaption className="text-center text-caption font-semibold tracking-[.06em] text-text-secondary uppercase">{label}</figcaption>
    </figure>
  );
}

/**
 * Possível correspondência do Radar MEL: as duas fotos lado a lado, os motivos
 * e as ações de cada lado. Nunca afirma que é o mesmo animal.
 */
export function MatchCard({ match: m }: { match: MatchView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"chat" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const owner = m.role === "owner";

  async function openChat() {
    setBusy("chat");
    setError(null);
    try {
      router.push(`/conversas/${await openConversationFromMatch(getBrowserClient(), m.id)}`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos abrir a conversa. Tente de novo."));
      setBusy(null);
    }
  }

  async function dismiss() {
    setBusy("dismiss");
    setError(null);
    try {
      await dismissMatch(getBrowserClient(), m.id);
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos atualizar. Tente de novo."));
      setBusy(null);
    }
  }

  return (
    <article data-testid="match-card" className="flex flex-col gap-4 rounded-card border border-border/70 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary-soft-foreground">
          {matchLabel(m.score)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Photo url={m.lost.photoUrl} alt={`Foto de ${m.lost.petName}, perdido`} label={`${m.lost.petName} · perdido`} />
        <ArrowLeftRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" strokeWidth={1.75} />
        <Photo url={m.found.photoUrl} alt="Foto do animal encontrado" label="Encontrado" />
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label="Por que parece">
        {describeMatchReasons(m.reasons).map((r) => (
          <li key={r} className="rounded-full bg-surface-muted px-2.5 py-1 text-sm text-text-secondary">
            {r}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        {owner ? (
          <>
            <Button size="md" onClick={openChat} loading={busy === "chat"} loadingText="Abrindo…">
              <MessageCircle aria-hidden="true" className="size-4" strokeWidth={2} />
              Falar com quem encontrou
            </Button>
            <ButtonLink href={`/encontrado/${m.found.code}`} variant="secondary" size="md">
              Ver o animal encontrado
            </ButtonLink>
          </>
        ) : (
          <>
            {m.lost.contactChat && m.lost.status === "ACTIVE" && (
              <ButtonLink href={`/alerta/${m.lost.code}/conversar`} size="md">
                <MessageCircle aria-hidden="true" className="size-4" strokeWidth={2} />
                Falar com o tutor
              </ButtonLink>
            )}
            <ButtonLink href={`/alerta/${m.lost.code}`} variant="secondary" size="md">
              Ver o alerta de {m.lost.petName}
            </ButtonLink>
          </>
        )}
        <Button variant="ghost" size="md" onClick={dismiss} loading={busy === "dismiss"} loadingText="Atualizando…">
          {owner ? "Não é o meu pet" : "Não é este animal"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {!owner && (
        <p className="text-sm text-text-secondary">
          Antes de devolver, peça ao tutor o detalhe que você anotou.{" "}
          <Link href={`/encontrado/${m.found.code}#conferir`} className="font-semibold text-link underline-offset-4 hover:underline">
            Ver meu detalhe
          </Link>
        </p>
      )}
    </article>
  );
}
