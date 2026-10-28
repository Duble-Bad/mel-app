"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from "@/lib/theme/theme";

// O estado do tema vive no <html> (data-theme / data-theme-pref), escrito pelo
// script do <head> antes da pintura; este módulo só lê e atualiza esse estado.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const root = () => document.documentElement;
const readPreference = (): ThemePreference => (root().dataset.themePref as ThemePreference | undefined) ?? "system";
const readResolved = (): ResolvedTheme => (root().dataset.theme === "dark" ? "dark" : "light");
const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function apply(preference: ThemePreference) {
  const resolved: ResolvedTheme = preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
  root().dataset.themePref = preference;
  root().dataset.theme = resolved;
  listeners.forEach((fn) => fn());
}

interface ThemeContextValue {
  /** O que a pessoa escolheu. */
  theme: ThemePreference;
  /** O que está na tela agora (system → light/dark). Use para mapa, imagens geradas etc. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Fonte única do tema. Hoje persiste no aparelho (localStorage); para
 * sincronizar com o perfil depois do login, chame a gravação no perfil em
 * `setTheme` e aplique a preferência do perfil ao entrar — os componentes
 * não mudam.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // No servidor não há preferência: "system"/"light" até hidratar (o script do <head> já pintou certo).
  const theme = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const resolvedTheme = useSyncExternalStore(subscribe, readResolved, () => "light" as const);

  // "Sistema": acompanha a troca de tema do aparelho em tempo real.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPreference() === "system") apply("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Navegação privada/armazenamento bloqueado: vale só nesta visita.
    }
    // Transição curta só das cores (globals.css), e só durante a troca.
    root().classList.add("theme-switching");
    apply(next);
    window.setTimeout(() => root().classList.remove("theme-switching"), 260);
  }, []);

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa de <ThemeProvider> (app/layout.tsx).");
  return ctx;
}
