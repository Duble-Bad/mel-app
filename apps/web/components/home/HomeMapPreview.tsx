"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/map.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, LoaderCircle, ShieldCheck } from "lucide-react";
import type { LatLng, PublicCaseItem } from "@mel/core";
import { type AreaMapHandle, mapLibreAreasProvider } from "@/lib/map/maplibre";
import { useTheme } from "@/components/theme/ThemeProvider";
import { toPins } from "@/components/map/pins";

/**
 * Prévia do mapa REAL da home: o mesmo mapa (MapLibre + MapTiler), as mesmas áreas
 * aproximadas e os mesmos casos públicos do /mapa (filtros padrão). Para poupar o plano
 * gratuito do MapTiler, só carrega quando entra na tela e sem interação (sem arrastar,
 * sem zoom: nada de blocos extras). Tocar em qualquer ponto abre o /mapa.
 */
export function HomeMapPreview({ items, center, zoom, total, areaLabel }: { items: PublicCaseItem[]; center: LatLng; zoom: number; total: number; areaLabel: string }) {
  const { resolvedTheme } = useTheme();
  const box = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<"waiting" | "loading" | "ready" | "error">("waiting");

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !el.current) return;
    let cancelled = false;
    let handle: AreaMapHandle | null = null;
    setState("loading");
    mapLibreAreasProvider
      .mount(el.current, { center, zoom, interactive: false, theme: resolvedTheme })
      .then((h) => {
        if (cancelled) return h.destroy();
        handle = h;
        h.setPins(toPins(items));
        // Enquadra os casos reais (sem zoom de rua: área aproximada, poucos blocos).
        if (items.length) h.fitTo(items.map((i) => i.position), 14);
        setState("ready");
      })
      .catch((err) => {
        console.error("[home] mapa não carregou", err);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
    // Os casos chegam do servidor uma vez; o tema remonta o estilo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, resolvedTheme]);

  return (
    <div ref={box} className="relative h-full min-h-[300px] overflow-hidden sm:min-h-[360px]" data-testid="home-map" data-map-status={state} data-cases={items.length}>
      {/* O CSS do MapLibre põe position:relative no elemento do mapa: ele precisa de um contêiner com tamanho. */}
      <div className="absolute inset-0" aria-hidden="true">
        <div ref={el} className="size-full" />
      </div>
      {state !== "ready" && (
        <p role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-muted text-sm text-text-secondary">
          {state === "error" ? (
            "Não conseguimos mostrar o mapa agora."
          ) : (
            <>
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" /> Carregando mapa…
            </>
          )}
        </p>
      )}
      {/* O link cobre o mapa todo (sem interação): qualquer toque abre o mapa completo. */}
      <Link href="/mapa" aria-label={`Abrir o mapa da rede MEL: ${total === 1 ? "1 caso" : `${total} casos`} perto do ${areaLabel}`} className="group absolute inset-0 z-[2]">
        <span className="absolute top-3.5 left-3.5 flex max-w-[calc(100%-28px)] items-center gap-2 rounded-xl border border-border-strong bg-background/90 px-3 py-2 text-[13px] text-text-primary">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
          Áreas aproximadas (~100 m) para proteger tutores
        </span>
        <span className="absolute bottom-9 left-3.5 max-w-[calc(100%-190px)] rounded-xl border border-border-strong bg-background/90 px-3 py-2 text-[12.5px] leading-snug text-text-secondary">
          {total === 1 ? "1 caso" : `${total} casos`} no mapa perto do {areaLabel}
        </span>
        <span className="absolute right-3.5 bottom-9 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-primary transition-transform group-hover:translate-x-0.5">
          Abrir mapa <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.5} />
        </span>
      </Link>
    </div>
  );
}
