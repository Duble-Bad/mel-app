"use client";

import Image from "next/image";
import {
  useCallback, useEffect, useRef, useState,
  type ClipboardEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref,
} from "react";
import { Archive, Bell, Check, Heart, House, Map as MapIcon, PawPrint, Send, SlidersHorizontal, UserRound } from "lucide-react";
import { animate, AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useToast } from "@/components/ui/Toast";
import { PHOTOS, SectionHead, useCmReduced } from "./shared";

const SOFT = { type: "spring", stiffness: 340, damping: 32 } as const;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

function LabCard({ n, title, hint, children, wide }: { n: string; title: string; hint: string; children: ReactNode; wide?: boolean }) {
  return (
    <motion.article
      className={`cm-lab ${wide ? "cm-lab-wide" : ""}`}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
    >
      <header className="cm-lab-head">
        <span className="cm-lab-n">{n}</span>
        <div>
          <h3 className="cm-lab-title">{title}</h3>
          <p className="cm-lab-hint">{hint}</p>
        </div>
      </header>
      <div className="cm-lab-stage">{children}</div>
    </motion.article>
  );
}

/* ---------- 1. Barra de abas com pílula líquida ---------- */

const TABS = [
  { label: "Início", Icon: House, screen: "3 casos novos perto de você" },
  { label: "Mapa", Icon: MapIcon, screen: "Raio de 2 km · Vila Madalena" },
  { label: "Alertas", Icon: Bell, screen: "2 avistamentos aguardando resposta" },
  { label: "Perfil", Icon: UserRound, screen: "Guardiã desde março" },
];

function LiquidTabs() {
  const [active, setActive] = useState(0);
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="cm-tabs-screen" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
            {TABS[active]?.screen}
          </motion.p>
        </AnimatePresence>
      </div>
      <nav aria-label="Navegação de exemplo" className="cm-tabs">
        <span className="cm-tabs-goo" aria-hidden="true">
          <motion.span className="cm-tabs-blob" animate={{ x: `${active * 100}%` }} initial={false} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
          <motion.span className="cm-tabs-blob cm-tabs-trail" animate={{ x: `${active * 100}%` }} initial={false} transition={{ type: "spring", stiffness: 130, damping: 19 }} />
        </span>
        {TABS.map(({ label, Icon }, i) => (
          <button key={label} type="button" className="cm-tab" aria-current={i === active ? "page" : undefined} onClick={() => setActive(i)}>
            <motion.span className="inline-flex" animate={{ y: i === active ? -1 : 0, scale: i === active ? 1.12 : 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
              <Icon size={19} aria-hidden="true" />
            </motion.span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------- 2. Segurar para confirmar ---------- */

function HoldConfirm() {
  const [done, setDone] = useState(false);
  const progress = useMotionValue(0);
  const controls = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => controls.current?.stop(), []);

  function start() {
    if (done) return;
    controls.current?.stop();
    controls.current = animate(progress, 1, { duration: 1.25 * (1 - progress.get()), ease: "linear", onComplete: () => setDone(true) });
  }
  function cancel() {
    if (done) return;
    controls.current?.stop();
    controls.current = animate(progress, 0, { type: "spring", stiffness: 260, damping: 30 });
  }
  function undo() {
    controls.current?.stop();
    progress.set(0);
    setDone(false);
  }
  function onKeyDown(e: ReactKeyboardEvent) {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      start();
    }
  }
  function onKeyUp(e: ReactKeyboardEvent) {
    if (e.key === " " || e.key === "Enter") cancel();
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <button
        type="button"
        className="cm-hold"
        data-done={done}
        aria-describedby="cm-hold-hint"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <motion.span className="cm-hold-fill" style={{ scaleX: progress }} aria-hidden="true" />
        <span className="cm-hold-content">
          <svg viewBox="0 0 36 36" className="cm-hold-ring" aria-hidden="true">
            <circle cx="18" cy="18" r="15" className="cm-hold-track" />
            <motion.circle cx="18" cy="18" r="15" className="cm-hold-arc" style={{ pathLength: progress }} />
            <path d="M11.5 18.5 L16 23 L24.5 13.5" pathLength={1} className="cm-hold-tick" />
          </svg>
          {done ? "Reencontro confirmado" : "Segure para confirmar"}
        </span>
      </button>
      <p id="cm-hold-hint" className="cm-lab-note" role="status">
        {done ? (
          <button type="button" className="cm-link" onClick={undo}>
            Desfazer
          </button>
        ) : (
          "Mantenha pressionado por 1 segundo (ou segure Espaço). Soltar antes cancela."
        )}
      </p>
    </div>
  );
}

/* ---------- 3. Ações por deslize ---------- */

type Note = { id: number; title: string; text: string };
const NOTES: Note[] = [
  { id: 1, title: "Novo avistamento da Mel", text: "Rua Harmonia · há 4 min" },
  { id: 2, title: "Guardião por perto", text: "A 200 m do último ponto" },
  { id: 3, title: "Cartaz pronto para imprimir", text: "QR Code gerado" },
];

/** Distância do dedo (px) ou velocidade (px/s) a partir das quais o gesto vale como ação. */
const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 320;

function SwipeRow({ note, read, onArchive, onRead, ref }: { note: Note; read: boolean; onArchive: () => void; onRead: () => void; ref?: Ref<HTMLLIElement> }) {
  const reduced = useCmReduced();
  const row = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const x = useMotionValue(0);
  // O fundo já aparece com cor cheia assim que a linha sai do lugar; só o ícone cresce com o gesto.
  const readOpacity = useTransform(x, [0, 1], [0, 1]);
  const readScale = useTransform(x, [8, 70], [0.6, 1.15]);
  const archiveOpacity = useTransform(x, [-1, 0], [1, 0]);
  const archiveScale = useTransform(x, [-70, -8], [1.15, 0.6]);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Completa o gesto: a linha termina de sair para o lado do deslize e só então a ação acontece. */
  function complete(dir: 1 | -1) {
    const width = row.current?.offsetWidth ?? 320;
    if (reduced) {
      x.set(0);
      if (dir < 0) onArchive();
      else onRead();
      return;
    }
    if (dir < 0) {
      void animate(x, -width, { duration: 0.2, ease: EASE_OUT }).then(onArchive);
      return;
    }
    void animate(x, width, { type: "spring", stiffness: 380, damping: 36 }).then(() => {
      onRead();
      // Mostra o "Lida" verde por um instante e devolve a linha, já no novo estado.
      timer.current = setTimeout(() => void animate(x, 0, SOFT), 420);
    });
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    // O motion começa a devolver a linha ao soltar; a animação abaixo assume o controle do mesmo valor.
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) complete(-1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) complete(1);
  }
  return (
    <motion.li ref={ref} layout className="cm-swipe" exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }} transition={SOFT}>
      <motion.span className="cm-swipe-bg cm-swipe-read" style={{ opacity: readOpacity }} aria-hidden="true">
        <motion.span className="inline-flex" style={{ scale: readScale }}>
          <Check size={18} strokeWidth={3} />
        </motion.span>
        {read ? "Não lida" : "Lida"}
      </motion.span>
      <motion.span className="cm-swipe-bg cm-swipe-archive" style={{ opacity: archiveOpacity }} aria-hidden="true">
        Arquivar
        <motion.span className="inline-flex" style={{ scale: archiveScale }}>
          <Archive size={18} strokeWidth={2.5} />
        </motion.span>
      </motion.span>
      <motion.div ref={row} className="cm-swipe-row" data-read={read} drag="x" style={{ x }} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.8} onDragEnd={onDragEnd}>
        <span className="cm-swipe-dot" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <b className="line-clamp-2 block text-sm leading-tight">{note.title}</b>
          <small className="block truncate text-caption text-text-secondary">{note.text}</small>
        </span>
        <button type="button" className="cm-act cm-act-read" aria-pressed={read} aria-label={`Marcar como lida: ${note.title}`} onClick={onRead}>
          <Check size={16} strokeWidth={3} aria-hidden="true" />
        </button>
        <button type="button" className="cm-act cm-act-archive" aria-label={`Arquivar: ${note.title}`} onClick={() => complete(-1)}>
          <Archive size={16} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </motion.div>
    </motion.li>
  );
}

function SwipeDemo() {
  const [notes, setNotes] = useState(NOTES);
  const [read, setRead] = useState<number[]>([]);
  return (
    <div className="flex w-full flex-col gap-3">
      <ul className="relative flex min-h-[188px] flex-col gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {notes.map((n) => (
            <SwipeRow
              key={n.id}
              note={n}
              read={read.includes(n.id)}
              onArchive={() => setNotes((list) => list.filter((x) => x.id !== n.id))}
              onRead={() => setRead((list) => (list.includes(n.id) ? list.filter((id) => id !== n.id) : [...list, n.id]))}
            />
          ))}
        </AnimatePresence>
        {notes.length === 0 ? <li className="cm-lab-note m-auto">Tudo arquivado.</li> : null}
      </ul>
      <p className="cm-lab-note flex items-center justify-between gap-3">
        <span>Deslize: direita marca como lida, esquerda arquiva.</span>
        {notes.length < NOTES.length ? (
          <button type="button" className="cm-link" onClick={() => setNotes(NOTES)}>
            Restaurar
          </button>
        ) : null}
      </p>
    </div>
  );
}

/* ---------- 4. Painel inferior com pontos de encaixe ---------- */

const SNAP = { full: 0, half: 134, closed: 284 } as const;
type SheetState = keyof typeof SNAP;
const SHEET_FILTERS = ["Cães", "Gatos", "Até 2 km", "Com foto"];

function SheetDemo() {
  const reduced = useCmReduced();
  const [state, setState] = useState<SheetState>("closed");
  const [picked, setPicked] = useState<string[]>(["Cães", "Até 2 km"]);
  const y = useMotionValue<number>(SNAP.closed);
  const backdrop = useTransform(y, [SNAP.full, SNAP.closed], [0.5, 0]);
  const opener = useRef<HTMLButtonElement>(null);
  const handle = useRef<HTMLButtonElement>(null);

  const go = useCallback(
    (to: SheetState) => {
      setState(to);
      animate(y, SNAP[to], reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 34 });
      if (to === "closed") opener.current?.focus({ preventScroll: true });
    },
    [y, reduced],
  );

  function onDragEnd(_: unknown, info: PanInfo) {
    const projected = y.get() + info.velocity.y * 0.16;
    const nearest = (Object.keys(SNAP) as SheetState[]).reduce((best, k) => (Math.abs(SNAP[k] - projected) < Math.abs(SNAP[best] - projected) ? k : best), "half" as SheetState);
    go(nearest);
  }

  return (
    <div className="cm-phone">
      <div className="cm-phone-body" inert={state !== "closed"}>
        <p className="text-sm font-bold">Casos por perto</p>
        <span className="cm-skel w-4/5" />
        <span className="cm-skel w-3/5" />
        <span className="cm-skel w-2/3" />
        <button
          ref={opener}
          type="button"
          className="cm-btn cm-btn-ghost cm-btn-sm mt-auto"
          onClick={() => {
            go("half");
            handle.current?.focus({ preventScroll: true });
          }}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Abrir filtros
        </button>
      </div>
      <motion.div className="cm-phone-dim" style={{ opacity: backdrop, pointerEvents: state === "closed" ? "none" : "auto" }} onClick={() => go("closed")} aria-hidden="true" />
      <motion.div
        className="cm-bsheet"
        role="dialog"
        aria-label="Filtros"
        inert={state === "closed"}
        drag="y"
        dragConstraints={{ top: SNAP.full, bottom: SNAP.closed }}
        dragElastic={0.06}
        dragMomentum={false}
        style={{ y }}
        onDragEnd={onDragEnd}
        onKeyDown={(e) => {
          if (e.key === "Escape") go("closed");
        }}
      >
        <button ref={handle} type="button" className="cm-bsheet-handle" aria-label={state === "full" ? "Reduzir painel" : "Expandir painel"} onClick={() => go(state === "full" ? "half" : "full")}>
          <span />
        </button>
        <p className="text-sm font-bold">Filtros</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SHEET_FILTERS.map((f) => {
            const on = picked.includes(f);
            return (
              <button key={f} type="button" aria-pressed={on} className="cm-pick" onClick={() => setPicked((p) => (on ? p.filter((x) => x !== f) : [...p, f]))}>
                {f}
              </button>
            );
          })}
        </div>
        <p className="cm-lab-note mt-4">Arraste: meio, tela cheia ou para baixo para fechar.</p>
        <button type="button" className="cm-btn cm-btn-gold cm-btn-sm mt-4 w-full" onClick={() => go("closed")}>
          Aplicar {picked.length} filtros
        </button>
      </motion.div>
    </div>
  );
}

/* ---------- 5. Pilha de avisos ---------- */

const TOAST_TEXT = ["Avistamento enviado. Obrigado!", "Alerta entregue aos Guardiões da região", "Link do caso copiado", "Cartaz salvo com QR Code"];

/** Dispara os avisos DE VERDADE do site (components/ui/Toast): a pilha aparece no rodapé da tela. */
function ToastDemo() {
  const toast = useToast();
  const next = useRef(0);
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="cm-lab-note text-center">
        Este é o aviso real do site. Dispare dois ou três: o novo entra por baixo, os anteriores recuam, e com o ponteiro (ou o foco) na pilha todos
        voltam ao tamanho normal e o tempo para.
      </p>
      <button
        type="button"
        className="cm-btn cm-btn-ghost cm-btn-sm"
        onClick={() => {
          const i = next.current++;
          toast({ tone: i % 4 === 2 ? "info" : "success", title: TOAST_TEXT[i % TOAST_TEXT.length] ?? "" });
        }}
      >
        <Send size={16} aria-hidden="true" />
        Disparar aviso
      </button>
    </div>
  );
}

/* ---------- 6. Puxar para atualizar ---------- */

const FEED = ["Thor visto no Butantã", "Amora: nova pista em Sumaré", "Flor voltou para casa", "Tigrinho avistado em Pinheiros", "Nina tem visita marcada"];

function PullDemo() {
  const reduced = useCmReduced();
  const y = useMotionValue(0);
  const [items, setItems] = useState([0, 1, 2]);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rotate = useTransform(y, [0, 90], [0, 320]);
  const opacity = useTransform(y, [0, 24, 56], [0, 0.5, 1]);
  const scale = useTransform(y, [0, 56], [0.4, 1]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = (to: number) => animate(y, to, reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 });

  function refresh() {
    if (busy) return;
    setBusy(true);
    settle(54);
    timer.current = setTimeout(() => {
      setItems((list) => [(Math.max(...list) + 1), ...list].slice(0, 3));
      setBusy(false);
      settle(0);
    }, 1250);
  }
  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (busy || (e.target as HTMLElement).closest("button")) return;
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (startY.current === null) return;
    const d = e.clientY - startY.current;
    y.set(d > 0 ? Math.min(d * 0.55, 96) : 0);
  }
  function onUp() {
    if (startY.current === null) return;
    startY.current = null;
    if (y.get() > 52) refresh();
    else settle(0);
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="cm-pull" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <motion.span className="cm-pull-ind" style={{ opacity, scale }} aria-hidden="true">
          <motion.span className={`inline-flex ${busy ? "cm-spin" : ""}`} style={{ rotate }}>
            <PawPrint size={20} />
          </motion.span>
        </motion.span>
        <motion.ul className="cm-pull-list" style={{ y }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((id) => (
              <motion.li key={id} layout initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SOFT} className="cm-pull-item">
                <span className="cm-swipe-dot" aria-hidden="true" />
                {FEED[id % FEED.length]}
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
      <p className="cm-lab-note flex items-center justify-between gap-3" role="status">
        <span>{busy ? "Buscando novidades..." : "Arraste a lista para baixo e solte."}</span>
        <button type="button" className="cm-link" onClick={refresh} disabled={busy}>
          Atualizar
        </button>
      </p>
    </div>
  );
}

/* ---------- 7. Código de verificação ---------- */

const CODE = "482913";
const EMPTY = ["", "", "", "", "", ""];

function OtpDemo() {
  const [digits, setDigits] = useState(EMPTY);
  const [status, setStatus] = useState<"idle" | "error" | "ok">("idle");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function commit(next: string[], focus: number) {
    setDigits(next);
    if (next.every(Boolean)) {
      if (next.join("") === CODE) {
        setStatus("ok");
        inputs.current[5]?.blur();
        return;
      }
      setStatus("error");
      timer.current = setTimeout(() => {
        setDigits(EMPTY);
        inputs.current[0]?.focus();
      }, 650);
      return;
    }
    setStatus("idle");
    inputs.current[Math.min(focus, 5)]?.focus();
  }
  function fill(from: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return;
    const next = [...digits];
    Array.from(clean).slice(0, 6 - from).forEach((d, k) => (next[from + k] = d));
    commit(next, from + clean.length);
  }
  function onKeyDown(i: number, e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      const target = digits[i] ? i : Math.max(i - 1, 0);
      next[target] = "";
      setDigits(next);
      setStatus("idle");
      inputs.current[target]?.focus();
    } else if (e.key === "ArrowLeft") inputs.current[Math.max(i - 1, 0)]?.focus();
    else if (e.key === "ArrowRight") inputs.current[Math.min(i + 1, 5)]?.focus();
  }
  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text"));
  }
  function reset() {
    setDigits(EMPTY);
    setStatus("idle");
    inputs.current[0]?.focus();
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <motion.fieldset
        className="cm-otp"
        data-status={status}
        animate={status === "error" ? { x: [0, -10, 9, -7, 5, -2, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
      >
        <legend className="sr-only">Código de verificação de 6 dígitos</legend>
        {/* Com o código certo, os seis campos deslizam um para o outro, fundem-se numa só forma
            (.cm-otp-pill), a forma encolhe até virar um círculo e o "check" se desenha por cima. */}
        <span className="cm-otp-cells">
          <span className="cm-otp-pill" aria-hidden="true">
            <svg viewBox="0 0 56 56" className="cm-otp-check">
              <circle cx="28" cy="28" r="26" pathLength={1} />
              <path d="M17.5 28.5 L25 36 L39 21" pathLength={1} />
            </svg>
          </span>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              className="cm-otp-cell"
              style={{ "--i": i } as CSSProperties}
              data-filled={d !== ""}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Dígito ${i + 1} de 6`}
              aria-invalid={status === "error"}
              readOnly={status === "ok"}
              onChange={(e) => {
                // Uma tecla troca o dígito; vários caracteres de uma vez (colar, código do SMS) se distribuem.
                const v = e.target.value;
                fill(i, d && v.length === 2 ? v.replace(d, "") || v.slice(-1) : v);
              }}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => onPaste(i, e)}
              onFocus={(e) => e.currentTarget.select()}
            />
          ))}
        </span>
      </motion.fieldset>
      <p className="cm-lab-note text-center" role="status">
        {status === "ok" ? (
          <span className="inline-flex items-center gap-2 font-bold text-status-found">
            <Check size={16} aria-hidden="true" />
            Telefone confirmado.
            <button type="button" className="cm-link" onClick={reset}>
              Recomeçar
            </button>
          </span>
        ) : status === "error" ? (
          <span className="font-bold text-status-lost">Código incorreto. Tente de novo.</span>
        ) : (
          <>
            Código de teste: <b className="text-text-primary tabular-nums">482913</b> (dá para colar).
          </>
        )}
      </p>
    </div>
  );
}

/* ---------- 8. Favoritar com explosão ---------- */

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

function FavoriteDemo() {
  const [liked, setLiked] = useState(false);
  const [burst, setBurst] = useState(0);
  const count = 127 + (liked ? 1 : 0);
  return (
    <div className="cm-fav-card">
      <span className="cm-fav-photo">
        <Image src={PHOTOS.mel.src} alt="" fill sizes="80px" style={{ objectFit: "cover", objectPosition: PHOTOS.mel.pos }} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base">Mel</b>
        <span className="flex items-center gap-1 text-caption text-text-secondary">
          <span className="cm-fav-count tabular-nums">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={count} className="inline-block" initial={{ y: liked ? 12 : -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: liked ? -12 : 12, opacity: 0 }} transition={{ duration: 0.25 }}>
                {count}
              </motion.span>
            </AnimatePresence>
          </span>
          acompanham
        </span>
      </span>
      <button
        type="button"
        className="cm-fav"
        aria-pressed={liked}
        aria-label={liked ? "Deixar de acompanhar a Mel" : "Acompanhar a Mel"}
        onClick={() => {
          if (!liked) setBurst((b) => b + 1);
          setLiked(!liked);
        }}
      >
        <motion.span
          key={`${burst}-${liked}`}
          className="inline-flex"
          initial={false}
          animate={liked ? { scale: [1, 0.55, 1.4, 1] } : { scale: [1, 0.8, 1] }}
          transition={{ duration: liked ? 0.6 : 0.25, times: liked ? [0, 0.18, 0.55, 1] : [0, 0.4, 1], ease: "easeOut" }}
        >
          <Heart size={22} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
        </motion.span>
        {liked ? (
          <span key={burst} className="cm-fav-burst" aria-hidden="true">
            {RAYS.map((a, i) => (
              <span key={a} className="cm-fav-ray" style={{ "--a": `${a}deg`, "--i": i } as CSSProperties} />
            ))}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/**
 * 6. Laboratório de microinterações: oito padrões (categorias do ui-motion-prompts) escolhidos
 * para telas reais da MEL, cada um em um cartão rotulado e utilizável por toque, mouse e teclado.
 */
export function Playground() {
  return (
    <section id="laboratorio" aria-labelledby="cm-lab-title" className="cm-section">
      <div className="mel-container">
        <SectionHead
          id="cm-lab-title"
          index="05"
          kicker="Laboratório de microinterações"
          title={<>Oito gestos pequenos que fazem o app parecer vivo.</>}
          lead="Tudo aqui funciona de verdade: toque, arraste, segure, digite. Cada cartão indica em que tela da MEL o padrão entraria."
        />
        <div className="cm-labs">
          <LabCard n="A" title="Abas com pílula líquida" hint="Barra inferior do app">
            <LiquidTabs />
          </LabCard>
          <LabCard n="B" title="Segurar para confirmar" hint="Marcar pet como encontrado">
            <HoldConfirm />
          </LabCard>
          <LabCard n="C" title="Ações por deslize" hint="Lista de notificações">
            <SwipeDemo />
          </LabCard>
          <LabCard n="D" title="Painel com pontos de encaixe" hint="Filtros do mapa">
            <SheetDemo />
          </LabCard>
          <LabCard n="E" title="Pilha de avisos" hint="Confirmações rápidas">
            <ToastDemo />
          </LabCard>
          <LabCard n="F" title="Puxar para atualizar" hint="Mural e conversas">
            <PullDemo />
          </LabCard>
          <LabCard n="G" title="Código de verificação" hint="Confirmar telefone">
            <OtpDemo />
          </LabCard>
          <LabCard n="H" title="Acompanhar com explosão" hint="Cartão e página do caso">
            <FavoriteDemo />
          </LabCard>
        </div>
      </div>
    </section>
  );
}
