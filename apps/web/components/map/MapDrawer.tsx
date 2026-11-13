"use client";

import Link from "next/link";
import { ArrowRight, Clock, Eye, Heart, MapPin, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { focusPosition, formatDistance, timeAgo } from "@mel/core";
import { KIND_BADGE, type FeedEntry } from "./feed";
import { PetPhoto } from "@/components/ui/PetPhoto";
import { PhotoGallery, type GalleryPhoto } from "@/components/media/PhotoGallery";

/**
 * Gaveta de detalhes do mapa (Conceito B): lateral no computador, folha que
 * sobe no celular. Mostra só o que já é público; a ação leva à página real do caso.
 * Fecha no X, no fundo escurecido e no Esc; o foco volta para quem abriu.
 */
export function MapDrawer({ entry: e, onClose }: { entry: FeedEntry; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      // Fotos em tela cheia abertas por cima: o Esc fecha só elas.
      if (document.querySelector("dialog[open]")) return;
      if (ev.key === "Escape") closeRef.current();
      // Foco preso na gaveta enquanto aberta (diálogo modal).
      if (ev.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (!firstEl || !lastEl) return;
        if (ev.shiftKey && (document.activeElement === firstEl || document.activeElement === panel.current)) {
          ev.preventDefault();
          lastEl.focus();
        } else if (!ev.shiftKey && document.activeElement === lastEl) {
          ev.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Os pinos do mapa são recriados a cada busca: só devolve o foco se quem abriu ainda existe.
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="mel-drawer">
      <div className="mel-drawer__scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={`mel-drawer__panel mel-kind--${e.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mapa-gaveta-titulo"
        tabIndex={-1}
        data-testid="map-selected"
      >
        <button type="button" className="mel-drawer__close" onClick={onClose} aria-label="Fechar">
          <X aria-hidden="true" className="size-[22px]" strokeWidth={2} />
        </button>
        <DrawerPhotos key={e.id} entry={e} />
        <div className="grid gap-4 p-[22px]">
          <span className="mel-badge">{KIND_BADGE[e.kind]}</span>
          <h2 id="mapa-gaveta-titulo" className="text-[30px] leading-tight font-extrabold tracking-[-0.02em]">
            {e.title}
          </h2>
          <div className="grid gap-1.5">
            <p className="mel-meta">
              <MapPin aria-hidden="true" strokeWidth={2} />
              <span>
                {e.areaLabel ?? "Região aproximada"} · área aproximada
                {e.distanceM != null && ` · a ${formatDistance(e.distanceM)} daqui`}
              </span>
            </p>
            {e.when && (
              <p className="mel-meta">
                <Clock aria-hidden="true" strokeWidth={2} />
                <span>
                  {e.when}
                  {e.kind === "adoption" && e.at && ` · publicado ${timeAgo(e.at)}`}
                </span>
              </p>
            )}
          </div>
          {e.note && (
            <p className="text-sm text-text-secondary" data-testid="map-selected-note">
              {e.note}
            </p>
          )}
          {e.facts.length > 0 && (
            <dl className="mel-facts">
              {e.facts.map((f) => (
                <div key={f.label} className="mel-fact">
                  <dt>
                    <span>{f.label}</span>
                  </dt>
                  <dd>
                    <strong>{f.value}</strong>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {e.description && <p className="line-clamp-4 text-text-secondary">{e.description}</p>}
          <DrawerActions entry={e} />
          <p className="flex gap-3 rounded-[14px] border border-status-sighting-accent/35 bg-status-sighting-accent/10 p-3.5 text-sm text-text-secondary">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-status-sighting-accent" strokeWidth={2} />
            <span>
              Por segurança, telefone e endereço nunca aparecem aqui. O contato acontece pela MEL e o local é mostrado só como área aproximada (~100 m).
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Foto da gaveta. Alerta com várias fotos vira carrossel (automático e manual, com miniaturas
 * embaixo): abre na capa já conhecida e busca as demais fotos públicas do alerta em segundo plano.
 * Encontrados, vistos e adoção seguem com a foto única.
 */
function DrawerPhotos({ entry: e }: { entry: FeedEntry }) {
  const cover = e.photoFullUrl ?? e.photoUrl;
  const code = e.kind === "lost" ? e.href.split("/").pop() : undefined;
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);

  useEffect(() => {
    if (!code) return;
    const ctrl = new AbortController();
    fetch(`/api/alertas/${encodeURIComponent(code)}/fotos`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { photos?: GalleryPhoto[] } | null) => {
        if (d?.photos && d.photos.length > 1) setPhotos(d.photos);
      })
      .catch(() => {}); // sem as outras fotos, fica a capa (nada a avisar)
    return () => ctrl.abort();
  }, [code]);

  if (photos) {
    return (
      <div className="mel-drawer__gallery">
        <PhotoGallery
          photos={photos}
          name={e.title}
          autoplay
          mainClassName="block aspect-[4/3] w-full bg-surface-muted object-cover max-lg:aspect-auto max-lg:h-[min(28dvh,240px)]"
          thumbsClassName="px-[22px] pt-1"
          thumbSize="size-14"
        />
      </div>
    );
  }
  return (
    <div className="mel-drawer__media">
      {/* Foto em tamanho normal (a miniatura ficava borrada aqui) com o foco que o tutor ajustou. */}
      <PetPhoto src={cover} alt={`Foto de ${e.title}`} iconClassName="size-14" style={{ objectPosition: focusPosition(e.photoFocus) }} />
    </div>
  );
}

const primary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground shadow-primary transition-transform duration-200 ease-mel hover:bg-primary-hover active:scale-[.98]";
const ghost =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border-strong px-5 font-bold text-text-primary transition-colors hover:bg-surface-muted";

function DrawerActions({ entry: e }: { entry: FeedEntry }) {
  if (e.kind === "lost") {
    const code = e.href.split("/").pop();
    return (
      <div className="grid gap-2.5">
        <Link href={e.href} className={primary}>
          Ver alerta <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2} />
        </Link>
        <Link href={`/avistamento/${code}`} className={ghost}>
          <Eye aria-hidden="true" className="size-5" strokeWidth={2} /> Vi este pet
        </Link>
      </div>
    );
  }
  if (e.kind === "adoption") {
    return (
      <Link href={e.href} className={primary}>
        <Heart aria-hidden="true" className="size-5" strokeWidth={2} /> Ver detalhes
      </Link>
    );
  }
  return (
    <Link href={e.href} className={primary}>
      Ver detalhes <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2} />
    </Link>
  );
}
