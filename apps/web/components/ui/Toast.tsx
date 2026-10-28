"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Tone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

type ShowToast = (toast: Omit<ToastItem, "id">) => void;

const ToastContext = createContext<ShowToast | null>(null);

const VISIBLE_MS = 6000;

const icons = {
  success: { icon: CircleCheck, className: "text-status-found-accent" },
  error: { icon: CircleAlert, className: "text-status-lost-accent" },
  info: { icon: Info, className: "text-status-info-accent" },
};

/** Avisos flutuantes (no lugar de alert() do navegador). Somem sozinhos e não cobrem botões por muito tempo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback<ShowToast>((toast) => {
    const id = ++nextId.current;
    setItems((list) => [...list.slice(-2), { ...toast, id }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  const { icon: Icon, className } = icons[item.tone];
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-md animate-toast items-start gap-3 rounded-lg bg-ink-800 p-4 text-text-inverse shadow-lg"
    >
      <Icon aria-hidden="true" className={`mt-px size-5 shrink-0 ${className}`} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.title}</p>
        {item.description && <p className="text-sm text-text-inverse/80">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="-m-2 inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-text-inverse/70 hover:text-text-inverse"
      >
        <X aria-hidden="true" className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast precisa de <ToastProvider> (app/layout.tsx).");
  return show;
}
