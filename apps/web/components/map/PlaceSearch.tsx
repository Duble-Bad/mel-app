"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { GeocodeResult, LatLng } from "@mel/core";
import { getGeocoder } from "@/lib/geo/client";
import { popoverBox, popoverScroll } from "@/components/ui/SelectMenu";

/**
 * Busca por cidade ou bairro (mapa e mural): centraliza a busca no lugar escolhido, sem precisar
 * do GPS. Usa o mesmo geocodificador do app (MapTiler; também entende CEP). Espera curta entre
 * teclas para economizar cota; teclado: ↑/↓ escolhem, Enter confirma, Esc fecha.
 */
// Logradouros ("Rua Ferraz de Vasconcelos…") vão para o fim: aqui se procura cidade ou bairro.
const STREET = /^(rua|r\.|avenida|av\.?|travessa|tv\.|alameda|al\.|estrada|estr\.|rodovia|rod\.|pra[çc]a|largo|viela|via|passagem)\s/i;

/** Cidades e bairros primeiro, ruas depois; sem repetidos (mesmo nome com outra caixa ou espaço). */
function rankPlaces(found: GeocodeResult[]): GeocodeResult[] {
  const seen = new Set<string>();
  return found
    .map((r, i) => ({ r, i, street: STREET.test(r.label.trim()) }))
    .sort((a, b) => Number(a.street) - Number(b.street) || a.i - b.i)
    .map(({ r }) => r)
    .filter((r) => {
      const key = r.label.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function PlaceSearch({ near, onPick, className = "" }: { near: LatLng; onPick: (r: GeocodeResult) => void; className?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const found = await getGeocoder().search(q, nearRef.current);
        if (!cancelled) {
          setResults(rankPlaces(found).slice(0, 6));
          setActive(-1);
        }
      } catch (err) {
        console.error("[PlaceSearch] busca falhou", err);
        if (!cancelled) {
          setResults(null);
          setError("A busca não respondeu. Tente de novo.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    if (!results) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [results]);

  const choose = (r: GeocodeResult) => {
    setQuery("");
    setResults(null);
    setError(null);
    onPick(r);
  };

  const open = results !== null;
  return (
    <div ref={box} className={`relative ${className}`}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Buscar cidade ou bairro
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-secondary" strokeWidth={2.25} />
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Cidade, bairro ou CEP"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim().length < 3) setResults(null);
        }}
        onKeyDown={(e) => {
          if (!results?.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(results[Math.max(0, active)]!);
          } else if (e.key === "Escape") {
            setResults(null);
          }
        }}
        className="h-10 w-full rounded-full border border-border-strong bg-surface-elevated pr-9 pl-10 text-sm font-semibold text-text-primary shadow-xs transition-colors placeholder:font-medium placeholder:text-text-muted hover:bg-surface-muted focus-visible:border-primary focus-visible:outline-none"
      />
      {searching && <Loader2 aria-hidden="true" className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-text-secondary" />}
      {open && (
        <div className={`${popoverBox} right-0 left-0 sm:right-auto sm:w-80`}>
        <ul id={listId} role="listbox" aria-label="Lugares encontrados" className={popoverScroll}>
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-text-secondary">Nenhum lugar encontrado.</li>
          ) : (
            results.map((r, i) => (
              <li
                key={`${r.label}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onPointerEnter={() => setActive(i)}
                className={`flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${i === active ? "bg-surface-muted" : ""}`}
              >
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
                <span className="min-w-0">{r.label}</span>
              </li>
            ))
          )}
        </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
