"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/components/ui/motion/useReducedMotion";

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

const SPRING = { type: "spring", stiffness: 340, damping: 32 } as const;

/**
 * Avisos flutuantes (no lugar de alert() do navegador). Somem sozinhos e não cobrem botões por muito tempo.
 * "Pilha de avisos" (conceito de movimento): o aviso novo entra por baixo com mola e os anteriores
 * recuam (menores e mais apagados); com o ponteiro ou o foco na pilha, todos voltam ao tamanho
 * normal e o tempo para de correr, para dar tempo de ler. Com "reduzir movimento", nada desliza.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback<ShowToast>((toast) => {
    const id = ++nextId.current;
    setItems((list) => [...list.slice(-2), { ...toast, id }]);
  }, []);
  // Sem avisos, a pilha "fecha": o próximo aviso não nasce com o tempo parado.
  const open = expanded && items.length > 0;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
        onPointerOver={() => setExpanded(true)}
        onPointerLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
      >
        <AnimatePresence initial={false}>
          {items.map((t, i) => (
            <ToastView key={t.id} item={t} depth={items.length - 1 - i} expanded={open} reduced={reduced} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, depth, expanded, reduced, onDismiss }: { item: ToastItem; depth: number; expanded: boolean; reduced: boolean; onDismiss: (id: number) => void }) {
  const { id } = item;
  useEffect(() => {
    if (expanded) return; // lendo a pilha: o tempo recomeça quando o ponteiro ou o foco saem
    const timer = setTimeout(() => onDismiss(id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [onDismiss, id, expanded]);
  const { icon: Icon, className } = icons[item.tone];
  const back = expanded || reduced ? 0 : depth;
  return (
    <motion.div
      layout={!reduced}
      role={item.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-md origin-bottom items-start gap-3 rounded-lg bg-inverse-surface p-4 text-inverse-foreground shadow-lg"
      initial={reduced ? false : { opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1 - back * 0.22, y: 0, scale: 1 - back * 0.05 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
      transition={reduced ? { duration: 0 } : SPRING}
    >
      <Icon aria-hidden="true" className={`mt-px size-5 shrink-0 ${className}`} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.title}</p>
        {item.description && <p className="text-sm text-inverse-foreground/80">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Fechar aviso"
        className="-m-2 inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-inverse-foreground/70 hover:text-inverse-foreground"
      >
        <X aria-hidden="true" className="size-4" strokeWidth={2} />
      </button>
    </motion.div>
  );
}

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast precisa de <ToastProvider> (app/layout.tsx).");
  return show;
}
