"use client";

import { Check, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { MotionVariant } from "./MotionSteps";
import { s } from "./classes";

/** Escolhe a linguagem de movimento ("a" ou "b") para tudo o que estiver dentro. */
export function MotionRoot({ variant, children, className = "", ...rest }: { variant: MotionVariant; children: ReactNode; className?: string } & Omit<ComponentProps<"div">, "children" | "className">) {
  return (
    <div {...rest} className={`${s.root} ${className}`} data-variant={variant}>
      {children}
    </div>
  );
}

export type Direction = "forward" | "back";

/**
 * Navegação de um assistente em etapas, igual para as duas opções: etapa atual, sentido da
 * última troca e o foco no título da etapa nova (teclado e leitor de tela sabem onde estão).
 */
export function useStepFlow(total: number, initial = 0) {
  const [index, setIndex] = useState(initial);
  const [direction, setDirection] = useState<Direction>("forward");
  const moved = useRef(false);
  const go = useCallback(
    (to: number) => {
      const next = Math.min(total - 1, Math.max(0, to));
      moved.current = true;
      setDirection(next < index ? "back" : "forward");
      setIndex(next);
    },
    [index, total],
  );
  return { index, direction, go, next: () => go(index + 1), back: () => go(index - 1), moved };
}

/**
 * Troca de conteúdo entre etapas: a camada anterior sai enquanto a nova entra, na mesma célula
 * da grade (nada pisca nem fica em branco). A anterior fica inerte e escondida do leitor de
 * tela. O foco vai para o elemento `[data-step-heading]` da etapa nova.
 */
export function StepStage({ stepKey, direction, children, focus = true }: { stepKey: string; direction: Direction; children: ReactNode; focus?: boolean }) {
  const [layers, setLayers] = useState<{ key: string; node: ReactNode; dir: Direction }[]>([{ key: stepKey, node: children, dir: direction }]);
  const [shownKey, setShownKey] = useState(stepKey);
  const live = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Guarda a etapa que saiu durante a animação de saída ("estado derivado da prop", sem efeito).
  if (stepKey !== shownKey) {
    // Com "reduzir movimento" a troca é direta: nada sai animado.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leaving = reduced ? undefined : layers.find((l) => l.key === shownKey);
    setShownKey(stepKey);
    setLayers([...(leaving ? [{ ...leaving, dir: direction }] : []), { key: stepKey, node: children, dir: direction }]);
  }
  const current = layers.map((l) => (l.key === stepKey ? { ...l, node: children } : l));

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (focus) {
      const h = live.current?.querySelector<HTMLElement>("[data-step-heading]");
      h?.focus({ preventScroll: true });
      // Se o topo do fluxo (com o indicador) ficou para cima, volta até ele: a troca de etapa
      // precisa ser vista. O cabeçalho fixo é compensado pelo scroll-padding global.
      const wrap = live.current?.closest<HTMLElement>("[data-step-flow]");
      if (wrap && wrap.getBoundingClientRect().top < 80) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        wrap.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      }
    }
    // Segurança: se o navegador não disparar o fim da animação, a camada antiga sai mesmo assim.
    const t = window.setTimeout(() => setLayers((ls) => ls.filter((l) => l.key === stepKey)), 450);
    return () => window.clearTimeout(t);
  }, [stepKey, focus]);

  return (
    <div className={s.stage}>
      {current.map((l) => {
        const out = l.key !== stepKey;
        return (
          <div
            key={l.key}
            ref={out ? undefined : live}
            className={s.layer}
            data-phase={out ? "out" : "in"}
            data-dir={l.dir}
            aria-hidden={out || undefined}
            inert={out || undefined}
            onAnimationEnd={(e) => {
              if (out && e.target === e.currentTarget) setLayers((ls) => ls.filter((x) => x.key !== l.key));
            }}
          >
            {l.node}
          </div>
        );
      })}
    </div>
  );
}

/** Mensagem de validação que abre sem empurrar o formulário de uma vez (e some do mesmo jeito). */
export function FieldMessage({ id, message }: { id: string; message: string | null }) {
  // Mantém o último texto enquanto a linha fecha, para não sumir de repente.
  const [last, setLast] = useState(message);
  if (message && message !== last) setLast(message);
  return (
    <div className={s.msg} data-open={message ? true : undefined}>
      <div className={s.msgInner}>
        <p id={id} role={message ? "alert" : undefined} className={`${s.msgText} text-sm font-semibold text-danger`}>
          {message ?? last}
        </p>
      </div>
    </div>
  );
}

/**
 * O campo com erro balança uma vez na opção B, a cada tentativa inválida. A animação é
 * reiniciada no próprio elemento: o campo nunca é recriado (não perde o foco nem o texto).
 */
export function Shake({ attempt, children, className = "" }: { attempt: number; children: ReactNode; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node || attempt === 0) return;
    node.classList.remove(s.shake);
    void node.offsetWidth; // reinicia a animação
    node.classList.add(s.shake);
  }, [attempt]);
  return (
    <div ref={el} className={className}>
      {children}
    </div>
  );
}

/**
 * Setas flutuantes nas laterais da tela (só em telas largas): voltar e continuar, sem texto;
 * o nome aparece como dica ao passar o mouse ou focar pelo teclado. Sem a ação, a seta some.
 */
export function SideArrows({ onBack, onNext, backLabel = "Voltar", nextLabel = "Continuar" }: { onBack?: () => void; onNext?: () => void; backLabel?: string; nextLabel?: string }) {
  const arrow = (side: "left" | "right", label: string, onClick?: () => void) =>
    onClick && (
      <button type="button" className={s.sideArrow} data-side={side} aria-label={label} onClick={onClick}>
        {side === "left" ? <ChevronLeft aria-hidden="true" className="size-7" /> : <ChevronRight aria-hidden="true" className="size-7" />}
        <span className={s.sideTip} aria-hidden="true">
          {label}
        </span>
      </button>
    );
  return (
    <>
      {arrow("left", backLabel, onBack)}
      {arrow("right", nextLabel, onNext)}
    </>
  );
}

/** Classes para cartões selecionáveis e o selo de selecionado (movimento depende da variante). */
export const motionCard = s.card;
export const motionBadge = s.badge;

/**
 * Botão com estado real de processamento: "busy" enquanto a ação roda e "done" quando ela
 * terminou de fato (quem chama decide; nada é simulado aqui).
 */
export function ActionButton({
  state,
  onClick,
  children,
  busyText,
  doneText,
  className,
  disabled,
}: {
  state: "idle" | "busy" | "done";
  onClick: () => void;
  children: ReactNode;
  busyText: string;
  doneText: string;
  className: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || state === "busy"} aria-busy={state === "busy" || undefined} className={className}>
      <span key={state} className={s.actionLabel}>
        {state === "busy" ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" /> {busyText}
          </>
        ) : state === "done" ? (
          <>
            <Check aria-hidden="true" className="size-5" /> {doneText}
          </>
        ) : (
          children
        )}
      </span>
    </button>
  );
}
