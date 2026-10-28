"use client";

import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { THEME_PREFERENCES, type ThemePreference } from "@/lib/theme/theme";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTheme } from "./ThemeProvider";

const OPTIONS: Record<ThemePreference, { label: string; hint: string; icon: LucideIcon }> = {
  system: { label: "Sistema", hint: "Segue o tema do seu aparelho", icon: Monitor },
  light: { label: "Claro", hint: "Fundo claro e acolhedor", icon: Sun },
  dark: { label: "Escuro", hint: "Confortável à noite", icon: Moon },
};

/** Lista de opções (radio). `segmented` = três botões lado a lado (Configurações → Aparência). */
export function ThemeOptions({ layout = "list", onPicked }: { layout?: "list" | "segmented"; onPicked?: () => void }) {
  const { theme, setTheme } = useTheme();
  const pick = (t: ThemePreference) => {
    setTheme(t);
    onPicked?.();
  };

  if (layout === "segmented") {
    return (
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {THEME_PREFERENCES.map((t) => {
          const { label, icon: Icon } = OPTIONS[t];
          const selected = theme === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(t)}
              className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-[border-color,background-color,transform] duration-200 ease-mel active:scale-[.98] ${
                selected ? "border-focus bg-primary-soft text-primary-soft-foreground" : "border-border bg-surface text-text-secondary hover:border-border-strong"
              }`}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="flex flex-col gap-1">
      {THEME_PREFERENCES.map((t) => {
        const { label, hint, icon: Icon } = OPTIONS[t];
        const selected = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => pick(t)}
            className={`flex min-h-13 items-center gap-3 rounded-md px-3 text-left transition-colors duration-200 ${
              selected ? "bg-primary-soft" : "hover:bg-surface-muted"
            }`}
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-sm ${selected ? "text-primary-soft-foreground" : "text-text-secondary"}`}>
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{label}</span>
              <span className="text-sm text-text-secondary">{hint}</span>
            </span>
            {selected && <Check aria-hidden="true" className="size-5 shrink-0 text-primary-soft-foreground" strokeWidth={2} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Botão discreto de tema. Desktop: menu suspenso. Celular: bottom sheet.
 * Mostra o ícone da escolha atual (sol, lua ou monitor).
 */
export function ThemeSwitcher() {
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const Icon = OPTIONS[theme].icon;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    wrapper.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        aria-label={`Tema: ${OPTIONS[theme].label}`}
        aria-haspopup="dialog"
        aria-expanded={menuOpen || sheetOpen}
        onClick={() => {
          if (window.matchMedia("(min-width: 640px)").matches) setMenuOpen((o) => !o);
          else setSheetOpen(true);
        }}
        className="inline-flex size-11 items-center justify-center rounded-md text-text-secondary transition-colors duration-200 hover:bg-surface-muted hover:text-text-primary"
      >
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </button>
      {menuOpen && (
        <div
          role="dialog"
          aria-label="Aparência"
          className="absolute top-full right-0 z-30 mt-2 w-64 origin-top-right animate-pop rounded-lg border border-border bg-surface-elevated p-1.5 shadow-md"
        >
          <p className="px-3 pt-2 pb-1 text-caption font-semibold tracking-[.06em] text-text-secondary uppercase">Aparência</p>
          <ThemeOptions onPicked={() => setMenuOpen(false)} />
        </div>
      )}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Aparência" description="Escolha como a MEL aparece para você.">
        <ThemeOptions onPicked={() => setSheetOpen(false)} />
      </BottomSheet>
    </div>
  );
}
