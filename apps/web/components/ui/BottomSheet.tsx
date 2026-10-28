"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Painel que sobe do rodapé no celular (filtros, ações, compartilhar,
 * denunciar…) e vira um cartão central no desktop. Usa <dialog> nativo:
 * foco preso, Esc fecha, leitor de tela anuncia o título.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Toque no fundo escurecido fecha.
        if (e.target === e.currentTarget) onClose();
      }}
      className={
        "mx-auto mt-auto mb-0 max-h-[90dvh] w-full max-w-none rounded-t-hero bg-surface p-0 text-text-primary shadow-lg " +
        "backdrop:bg-ink-900/45 open:animate-sheet-up " +
        "sm:my-auto sm:w-[min(100%-2rem,30rem)] sm:rounded-card sm:open:animate-pop"
      }
    >
      <div className="flex flex-col gap-4 px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] sm:p-6">
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-border-strong sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            {description && <p className="text-sm text-text-secondary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted hover:text-text-primary"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
