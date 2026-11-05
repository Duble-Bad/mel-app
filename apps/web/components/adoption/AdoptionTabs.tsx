"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ADOPTION_TABS, type AdoptionTabId } from "./tabs";
import "./adoption.css";

/**
 * Abas da Adoção (padrão WAI-ARIA: setas trocam, só a aba ativa entra no Tab).
 * O conteúdo das três vem renderizado do servidor; a aba ativa fica na URL
 * (?aba=) para link direto e para o "voltar" do navegador.
 */
export function AdoptionTabs({ initial, panels }: { initial: AdoptionTabId; panels: Record<AdoptionTabId, ReactNode> }) {
  const [active, setActive] = useState<AdoptionTabId>(initial);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // "Quero adotar" no cabeçalho e o estado vazio apontam para #quero-adotar.
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (ADOPTION_TABS.some((t) => t.id === id)) setActive(id as AdoptionTabId);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function show(id: AdoptionTabId, focus = false) {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === "disponiveis") url.searchParams.delete("aba");
    else url.searchParams.set("aba", id);
    url.hash = "";
    window.history.replaceState(null, "", url);
    if (focus) refs.current[id]?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const i = ADOPTION_TABS.findIndex((t) => t.id === active);
    const n = ADOPTION_TABS.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i + n - 1) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    show(ADOPTION_TABS[next]!.id, true);
  }

  return (
    <>
      <div role="tablist" aria-label="Seções de adoção" className="mb-7 flex flex-wrap gap-2" onKeyDown={onKeyDown}>
        {ADOPTION_TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-controls={`painel-${t.id}`}
            aria-selected={active === t.id}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => show(t.id)}
            className="mel-adopt-tab min-h-11.5 rounded-full border border-border-strong bg-surface-muted/60 px-5 font-bold transition-[background-color,color,border-color] duration-200 hover:border-text-muted"
          >
            {t.label}
          </button>
        ))}
      </div>
      {ADOPTION_TABS.map((t) => (
        <section
          key={t.id}
          id={`painel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={active !== t.id}
          tabIndex={0}
          className="mel-adopt-panel scroll-mt-24 focus-visible:outline-none"
        >
          {panels[t.id]}
        </section>
      ))}
    </>
  );
}
