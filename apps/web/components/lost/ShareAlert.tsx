"use client";

import Link from "next/link";
import { useState } from "react";
import { shareText, whatsappShareUrl, type PublicLostCase } from "@mel/core";

/** Compartilhar: WhatsApp, menu nativo do celular (Instagram etc.) e copiar link. */
export function ShareAlert({ lostCase, path }: { lostCase: Pick<PublicLostCase, "pet" | "areaLabel" | "lostAt">; path: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = () => `${window.location.origin}${path}`;

  function whatsapp() {
    window.open(whatsappShareUrl(shareText(lostCase, url())), "_blank", "noopener");
  }

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Não conseguimos copiar. Selecione o endereço na barra do navegador.");
    }
  }

  async function moreOptions() {
    setError(null);
    // Menu nativo do celular (inclui Instagram, Telegram…). Sem ele, copia o link.
    if (!("share" in navigator)) return copy();
    try {
      await navigator.share({ title: `Procura-se: ${lostCase.pet.name}`, text: shareText(lostCase, url()), url: url() });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("Não conseguimos abrir o compartilhamento. Use Copiar link.");
    }
  }

  const btn =
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-border-strong bg-surface px-4 font-semibold hover:bg-surface-muted";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={whatsapp}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-status-found px-4 text-lg font-bold text-text-inverse"
      >
        <span aria-hidden="true">💬</span> Compartilhar no WhatsApp
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={moreOptions} className={btn}>
          <span aria-hidden="true">↗</span> Mais opções
        </button>
        <button type="button" onClick={copy} className={btn}>
          <span aria-hidden="true">🔗</span> {copied ? "Link copiado!" : "Copiar link"}
        </button>
      </div>
      <Link href={`${path}/cartaz`} className={btn}>
        <span aria-hidden="true">🖼️</span> Cartaz e QR Code (baixar ou imprimir)
      </Link>
      <p role="status" className="sr-only">
        {copied ? "Link copiado" : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
