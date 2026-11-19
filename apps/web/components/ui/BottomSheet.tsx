"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/** Arrastar para baixo fecha o painel a partir desta distância (px) ou desta velocidade (px/ms). */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.6;

/**
 * Painel que sobe do rodapé no celular (filtros, ações, compartilhar,
 * denunciar…) e vira um cartão central no desktop. Usa <dialog> nativo:
 * foco preso, Esc fecha, leitor de tela anuncia o título.
 *
 * No celular, a alça do topo também fecha: arrastar para baixo leva o painel junto com o dedo
 * (só `transform`); soltar depois de um trecho, ou num gesto rápido, fecha; antes disso ele volta
 * ao lugar. É um atalho de toque: o botão "Fechar", o Esc e o toque no fundo continuam valendo.
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

  const drag = useRef<{ startY: number; startT: number; lastY: number; lastT: number; dy: number; velocity: number } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Limpa o que um arrasto anterior deixou no estilo, para a entrada animar de novo.
      dialog.style.transform = "";
      dialog.style.transition = "";
      dialog.style.animation = "";
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function onHandleDown(e: ReactPointerEvent<HTMLDivElement>) {
    const dialog = ref.current;
    if (!dialog || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startT: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp, dy: 0, velocity: 0 };
    // A animação de entrada (com fill "both") seguraria o transform; durante o gesto quem manda é o dedo.
    dialog.style.animation = "none";
    dialog.style.transition = "none";
  }
  function onHandleMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const dialog = ref.current;
    if (!d || !dialog) return;
    const dt = e.timeStamp - d.lastT;
    d.dy = Math.max(0, e.clientY - d.startY);
    // Velocidade: a maior entre o último trecho e a média do gesto (num gesto curto o navegador
    // entrega poucos eventos, e o último trecho sozinho engana).
    const total = e.timeStamp - d.startT;
    d.velocity = Math.max(dt > 0 ? (e.clientY - d.lastY) / dt : 0, total > 0 && total < 300 ? d.dy / total : 0);
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    dialog.style.transform = `translateY(${d.dy}px)`;
  }
  function onHandleUp() {
    const d = drag.current;
    const dialog = ref.current;
    drag.current = null;
    if (!d || !dialog) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const settle = (transform: string, ms: number, easing: string) => {
      dialog.style.transition = still ? "none" : `transform ${ms}ms ${easing}`;
      dialog.style.transform = transform;
    };
    if (d.dy < CLOSE_DISTANCE && !(d.dy > 24 && d.velocity > CLOSE_VELOCITY)) {
      settle("translateY(0)", 320, "cubic-bezier(0.16, 1, 0.3, 1)");
      return;
    }
    settle("translateY(100%)", 200, "cubic-bezier(0.4, 0, 1, 1)");
    setTimeout(
      () => {
        onClose();
        // Quem usa pode recusar o fechamento (ex.: envio em andamento): nesse caso o painel volta.
        setTimeout(() => {
          if (ref.current?.open) settle("translateY(0)", 320, "cubic-bezier(0.16, 1, 0.3, 1)");
        }, 80);
      },
      still ? 0 : 200,
    );
  }

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
        "mx-auto mt-auto mb-0 max-h-[90dvh] w-full max-w-none rounded-t-hero border-t border-border bg-surface-elevated p-0 text-text-primary shadow-lg " +
        "backdrop:bg-ink-900/45 open:animate-sheet-up " +
        "sm:my-auto sm:w-[min(100%-2rem,30rem)] sm:rounded-card sm:open:animate-pop"
      }
    >
      <div className="flex flex-col gap-4 px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] sm:p-6">
        {/* Alça: área de toque maior que o traço (as margens negativas mantêm o espaçamento de antes). */}
        <div
          aria-hidden="true"
          className="-mx-5 -mt-3 -mb-3 flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing sm:hidden"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
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
