"use client";

import { Check } from "lucide-react";
import { useSyncExternalStore } from "react";
import { DEFAULT_TABBAR, TABBAR_STORAGE_KEY, TABBAR_STYLES, type TabBarStyle } from "@/lib/theme/tabbar";

// O estilo vive no <html> (data-tabbar), escrito pelo script do <head> antes da pintura; a barra
// (components/ui/motion/AppTabs) segue esse atributo só com CSS. Aqui: ler, gravar e avisar.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const read = (): TabBarStyle => (document.documentElement.dataset.tabbar === "orb" ? "orb" : DEFAULT_TABBAR);

/** Estilo da barra de abas escolhido neste aparelho (no servidor e até hidratar: o padrão). */
export function useTabBarStyle(): [TabBarStyle, (style: TabBarStyle) => void] {
  const style = useSyncExternalStore(subscribe, read, () => DEFAULT_TABBAR);
  const set = (next: TabBarStyle) => {
    try {
      localStorage.setItem(TABBAR_STORAGE_KEY, next);
    } catch {
      // Navegação privada/armazenamento bloqueado: vale só nesta visita.
    }
    document.documentElement.dataset.tabbar = next;
    listeners.forEach((fn) => fn());
  };
  return [style, set];
}

const OPTIONS: Record<TabBarStyle, { label: string; hint: string }> = {
  expand: { label: "Aba que se abre (padrão)", hint: "Só a seção atual mostra o nome" },
  orb: { label: "Círculo dourado", hint: "Um círculo elevado marca a seção atual" },
};

/** Miniatura de cada barra (desenho estático, só para reconhecer o estilo). */
function Preview({ style }: { style: TabBarStyle }) {
  const dot = "size-1.5 rounded-full bg-text-muted";
  if (style === "expand") {
    return (
      <span aria-hidden="true" className="flex h-7 w-[76px] shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-1 shadow-sm">
        <span className="flex h-5 w-8 items-center gap-1 rounded-full bg-primary px-1.5">
          <span className="size-1.5 rounded-full bg-primary-foreground" />
          <span className="h-1 flex-1 rounded-full bg-primary-foreground" />
        </span>
        <span className={dot} />
        <span className={dot} />
        <span className={dot} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="relative flex h-7 w-[76px] shrink-0 items-end">
      <span className="flex h-5 w-full items-center justify-end gap-2.5 rounded-lg border border-border bg-surface-elevated pr-2.5 shadow-sm">
        <span className={dot} />
        <span className={dot} />
        <span className={dot} />
      </span>
      <span className="absolute top-0 left-2 size-5 rounded-full bg-primary ring-2 ring-background" />
    </span>
  );
}

/**
 * Escolha do estilo da barra de abas do celular (por aparelho, como o tema). Os nomes dos rádios
 * não contêm "Claro", "Escuro" nem "Sistema": não se confundem com os do tema.
 */
export function TabBarOptions() {
  const [style, setStyle] = useTabBarStyle();
  return (
    <div role="radiogroup" aria-label="Barra de navegação no celular" className="flex flex-col gap-1">
      {TABBAR_STYLES.map((s) => {
        const { label, hint } = OPTIONS[s];
        const selected = style === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setStyle(s)}
            className={`flex min-h-13 items-center gap-3 rounded-md px-3 py-1.5 text-left transition-colors duration-200 ${selected ? "bg-primary-soft" : "hover:bg-surface-muted"}`}
          >
            <Preview style={s} />
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
