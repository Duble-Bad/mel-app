"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { Clock, Eye, MapPin, Share2, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { CASES, SectionHead, STATUS, useCmReduced, type CaseStatus, type PetCase, type PetPhoto } from "./shared";

type Filter = "all" | CaseStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "lost", label: "Perdidos" },
  { key: "sighting", label: "Avistados" },
  { key: "found", label: "Encontrados" },
  { key: "adoption", label: "Adoção" },
];

const SPRING = { type: "spring", stiffness: 300, damping: 32, mass: 0.9 } as const;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

function Photo({ photo, sizes }: { photo: PetPhoto; sizes: string }) {
  return (
    <Image
      src={photo.src}
      alt=""
      fill
      sizes={sizes}
      draggable={false}
      style={{ objectFit: "cover", objectPosition: photo.pos, transform: photo.zoom ? `scale(${photo.zoom})` : undefined, transformOrigin: photo.origin }}
    />
  );
}

function Badge({ status }: { status: CaseStatus }) {
  return <span className={`cm-badge ${STATUS[status].solid}`}>{STATUS[status].label}</span>;
}

/** Cartão com inclinação 3D, brilho especular que segue o ponteiro e moldura de luz no foco/hover. */
function TiltCard({ item, index, onOpen, ref }: { item: PetCase; index: number; onOpen: (item: PetCase, trigger: HTMLButtonElement) => void; ref?: Ref<HTMLLIElement> }) {
  const reduced = useCmReduced();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(30);
  const glow = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 240, damping: 20 });
  const rotateY = useSpring(ry, { stiffness: 240, damping: 20 });
  const shineOpacity = useSpring(glow, { stiffness: 200, damping: 26 });
  const shine = useMotionTemplate`radial-gradient(240px circle at ${gx}% ${gy}%, color-mix(in srgb, var(--mel-text-inverse) 38%, transparent), transparent 65%)`;

  function onMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    ry.set((nx - 0.5) * 16);
    rx.set((0.5 - ny) * 16);
    gx.set(nx * 100);
    gy.set(ny * 100);
    glow.set(1);
  }
  function reset() {
    rx.set(0);
    ry.set(0);
    glow.set(0);
  }

  return (
    <motion.li
      ref={ref}
      layout
      className="cm-card-li"
      initial={{ opacity: 0, y: 56, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.86, transition: { duration: 0.22 } }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ layout: SPRING, default: { duration: 0.8, ease: EASE_OUT, delay: (index % 4) * 0.07 } }}
    >
      <motion.button
        type="button"
        layoutId={`cm-card-${item.id}`}
        transition={SPRING}
        className="cm-card"
        style={{ borderRadius: 24 }}
        aria-haspopup="dialog"
        aria-label={`${item.name}, ${STATUS[item.status].label.toLowerCase()} em ${item.place}, ${item.when}. Abrir detalhes`}
        onPointerMove={onMove}
        onPointerLeave={reset}
        onClick={(e) => {
          rx.jump(0);
          ry.jump(0);
          glow.jump(0);
          onOpen(item, e.currentTarget);
        }}
      >
        <motion.span className="cm-card-tilt" style={{ rotateX, rotateY }}>
          <motion.span layoutId={`cm-photo-${item.id}`} transition={SPRING} className="cm-card-photo" style={{ borderRadius: 24 }}>
            <Photo photo={item.photo} sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw" />
          </motion.span>
          <span className="cm-card-scrim" aria-hidden="true" />
          <motion.span className="cm-card-shine" style={{ background: shine, opacity: shineOpacity }} aria-hidden="true" />
          <span className="cm-card-top">
            <Badge status={item.status} />
            <span className="cm-card-when">{item.when}</span>
          </span>
          <span className="cm-card-info">
            <span className="cm-card-name">{item.name}</span>
            <span className="cm-card-meta">
              <MapPin size={13} aria-hidden="true" />
              {item.place}
            </span>
          </span>
        </motion.span>
      </motion.button>
    </motion.li>
  );
}

/** Folha de detalhe: o cartão e a foto "viajam" (layoutId) da grade até aqui. Foco preso, Esc fecha. */
function CaseSheet({ item, onClose }: { item: PetCase; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true });
    const body = document.body;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>("button, a[href]");
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [onClose]);

  return (
    <>
      <motion.div className="cm-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      <div className="cm-sheet-wrap">
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cm-sheet-title"
          layoutId={`cm-card-${item.id}`}
          transition={SPRING}
          className="cm-sheet"
          style={{ borderRadius: 28 }}
        >
          <motion.div layoutId={`cm-photo-${item.id}`} transition={SPRING} className="cm-sheet-photo" style={{ borderRadius: 28 }}>
            <Photo photo={item.photo} sizes="(min-width: 768px) 440px, 100vw" />
          </motion.div>
          <motion.div
            className="cm-sheet-body"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT, delay: 0.16 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge status={item.status} />
                <h3 id="cm-sheet-title" className="mt-3 text-4xl font-extrabold tracking-[-0.03em]">
                  {item.name}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{item.kind}</p>
              </div>
              <button ref={closeBtn} type="button" onClick={onClose} className="cm-icon-btn" aria-label="Fechar detalhes">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} aria-hidden="true" />
                {item.place}, São Paulo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={15} aria-hidden="true" />
                {item.when}
              </span>
            </p>
            <p className="mt-4 text-base text-pretty">{item.note}</p>

            <h4 className="mt-6 text-caption font-bold tracking-[.12em] text-text-secondary uppercase">Linha do tempo</h4>
            <motion.ol className="cm-timeline" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.32 } } }}>
              {item.trail.map((t) => (
                <motion.li key={t.time} variants={{ hidden: { opacity: 0, x: -14 }, show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE_OUT } } }}>
                  <span className="cm-timeline-time tabular-nums">{t.time}</span>
                  <span>{t.text}</span>
                </motion.li>
              ))}
            </motion.ol>

            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" className="cm-btn cm-btn-gold" onClick={onClose}>
                <Eye size={18} aria-hidden="true" />
                Eu vi este pet
              </button>
              <button type="button" className="cm-btn cm-btn-ghost" onClick={onClose}>
                <Share2 size={18} aria-hidden="true" />
                Compartilhar
              </button>
            </div>
            <p className="mt-4 text-caption text-text-muted">Caso fictício de demonstração.</p>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}

/**
 * 3. Grade de casos: revelação escalonada ao rolar, filtros que reordenam a grade com animação de
 * layout, inclinação 3D com brilho especular e expansão do cartão em folha de detalhe (elemento
 * compartilhado).
 */
export function CasesGrid() {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<PetCase | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const visible = filter === "all" ? CASES : CASES.filter((c) => c.status === filter);

  const onOpen = useCallback((item: PetCase, el: HTMLButtonElement) => {
    trigger.current = el;
    setOpen(item);
  }, []);
  const onClose = useCallback(() => {
    setOpen(null);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section id="casos" aria-labelledby="cm-casos-title" className="cm-section">
      <div className="mel-container">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHead
            id="cm-casos-title"
            index="02"
            kicker="Casos por perto"
            title={<>Cada cartão é um bichinho esperando alguém olhar.</>}
            lead="Passe o mouse para sentir o peso do cartão, filtre para ver a grade se reorganizar e abra um caso: a foto viaja até o detalhe."
          />
          <LayoutGroup id="cm-filters">
            <div role="group" aria-label="Filtrar casos por situação" className="cm-fchips">
              {FILTERS.map((f) => {
                const active = f.key === filter;
                const n = f.key === "all" ? CASES.length : CASES.filter((c) => c.status === f.key).length;
                return (
                  <button key={f.key} type="button" aria-pressed={active} className="cm-fchip" onClick={() => setFilter(f.key)}>
                    {active ? <motion.span layoutId="cm-fchip-pill" className="cm-fchip-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
                    <span className="relative">{f.label}</span>
                    <span className="cm-fchip-n relative tabular-nums">{n}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        <p className="sr-only" role="status">
          {visible.length} {visible.length === 1 ? "caso exibido" : "casos exibidos"}
        </p>

        <ul className="cm-cards">
          <AnimatePresence mode="popLayout">
            {visible.map((item, i) => (
              <TiltCard key={item.id} item={item} index={i} onOpen={onOpen} />
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <AnimatePresence>{open ? <CaseSheet key={open.id} item={open} onClose={onClose} /> : null}</AnimatePresence>
    </section>
  );
}
