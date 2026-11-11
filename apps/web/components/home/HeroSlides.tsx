"use client";

import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

type Slide = {
  key: string;
  src: string;
  /** Proporção natural da imagem (largura / altura). */
  ratio: number;
  alt: string;
  /** Enquadramento no quadro (object-position), em fração. */
  pos: [number, number];
  /** Ponto da imagem (em fração) de onde nasce a onda de quarteirões ao entrar nesta cena. */
  origin: [number, number];
  label: string;
  chip: { title: string; text: string; dot: string };
};

const SLIDES: Slide[] = [
  {
    key: "rede",
    src: "/fotos/mel-e-gatinho.webp",
    ratio: 1600 / 901,
    alt: "A Mel, uma Yorkshire com laço amarelo, abraçada a um gatinho tigrado",
    pos: [0.62, 0.35],
    origin: [0.36, 0.08], // perto do coração do canto do quadro
    label: "A rede",
    chip: { title: "Avistamentos em tempo real", text: "chegam direto para o tutor", dot: "bg-status-found-accent" },
  },
  {
    key: "guardiao",
    src: "/fotos/guardiao-escudo.webp",
    // Fundo da ilustração estendido acima e abaixo (1172×1060): os bichos e as casinhas dos dois
    // lados cabem inteiros no card, no desktop e no celular.
    ratio: 1172 / 1060,
    alt: "Uma Yorkshire e um gato laranja sentados diante de um escudo dourado, sobre o mapa iluminado de um bairro",
    pos: [0.5, 0.5],
    origin: [0.51, 0.72], // o pino dourado do mapa
    label: "Guardiões no bairro",
    chip: { title: "Guardiões no seu bairro", text: "avisos chegam a quem está perto", dot: "bg-primary" },
  },
];

const HOLD_S = 7; // tempo de cada cena
const FLIP_S = 0.9; // virada de cada quarteirão
const WAVE_S = 0.75; // atraso máximo da onda (do mais perto ao mais longe da origem)
const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Retângulo que a imagem ocupa no quadro com object-fit: cover e o enquadramento da cena. */
function coverRect(s: Slide, W: number, H: number) {
  const w = Math.max(W, H * s.ratio);
  const h = Math.max(H, W / s.ratio);
  return { w, h, x: -(w - W) * s.pos[0], y: -(h - H) * s.pos[1] };
}

/**
 * Imagem principal do início: a foto da Mel com o gatinho e a ilustração do Guardião no bairro.
 *
 * Troca de cena "o bairro se ativando": a imagem vira uma grade de quarteirões que viram em 3D,
 * um a um, numa onda que parte de um ponto com significado (o pino dourado do mapa; o coração do
 * canto), cada quarteirão acendendo uma borda dourada ao virar — como um alerta se espalhando pela
 * rede. Entre as trocas, a cena do Guardião tem ondas no chão a partir do pino e um brilho que passa;
 * no desktop o quadro inclina seguindo o mouse, com reflexo de luz. Indicadores de tempo trocam com
 * um toque; pausa com o mouse em cima ou o foco dentro. "Reduzir movimento": sem troca automática,
 * sem inclinação e a troca só esmaece.
 */
export function HeroSlides() {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [state, setState] = useState<{ index: number; next: number | null; run: number }>({ index: 0, next: null, run: 0 });
  const [hold, setHold] = useState(false);
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED).matches, () => false);
  const { index, next } = state;
  const slide = SLIDES[index]!;
  const shown = SLIDES[next ?? index]!; // o selo e os indicadores já mostram a cena que está chegando

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = (i: number) => {
    const target = (i + SLIDES.length) % SLIDES.length;
    setState((s) => (s.next !== null || target === s.index ? s : { ...s, next: target, run: s.run + 1 }));
  };
  const finish = () => setState((s) => (s.next === null ? s : { index: s.next, next: null, run: s.run }));

  // Inclinação 3D seguindo o mouse (só com mouse e sem "reduzir movimento").
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [3.5, -3.5]), { stiffness: 150, damping: 18 });
  const ry = useSpring(useTransform(px, [0, 1], [-4.5, 4.5]), { stiffness: 150, damping: 18 });
  const glossX = useTransform(px, (v) => `${v * 100}%`);
  const glossY = useTransform(py, (v) => `${v * 100}%`);

  return (
    <motion.div
      role="group"
      aria-roledescription="apresentação"
      aria-label="Imagens da MEL"
      className="hs relative"
      style={reduced ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1200 }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        setHold(false);
        px.set(0.5);
        py.set(0.5);
      }}
      onFocus={(e) => e.target.matches(":focus-visible") && setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHold(false)}
    >
      {/* isolate: as camadas das cenas ficam presas no quadro e nunca cobrem os controles. */}
      <div ref={frame} className="mh-slides relative isolate aspect-[16/11] w-full overflow-hidden rounded-hero bg-surface-muted shadow-lg lg:aspect-auto lg:h-[480px]">
        {/* Cena atual (inteira, nítida) */}
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.key}
            className="absolute inset-0"
            initial={reduced ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 1, transition: { duration: 0 } }}
            transition={{ duration: 0.5 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- já otimizada; repetida nos quarteirões da troca */}
            <img
              src={slide.src}
              alt={slide.alt}
              fetchPriority={index === 0 ? "high" : "auto"}
              className="hs-kenburns size-full object-cover"
              style={{ objectPosition: `${slide.pos[0] * 100}% ${slide.pos[1] * 100}%` }}
            />
            {slide.key === "guardiao" && size.w > 0 && <GuardianLife slide={slide} W={size.w} H={size.h} />}
          </motion.div>
        </AnimatePresence>

        {/* Troca: a grade de quarteirões vira em onda a partir da origem da cena que chega */}
        {next !== null && !reduced && size.w > 0 && <TileWave key={state.run} from={slide} to={SLIDES[next]!} W={size.w} H={size.h} onDone={finish} />}
        {next !== null && reduced && <ReducedSwap onDone={finish} />}

        {/* Reflexo de luz que acompanha o mouse */}
        {!reduced && (
          <motion.span
            aria-hidden="true"
            className="hs-gloss pointer-events-none absolute inset-0 z-[60]"
            style={{ "--gx": glossX, "--gy": glossY } as unknown as CSSProperties}
          />
        )}
      </div>

      {/* Indicadores: o tempo de cada cena; tocar troca de cena. */}
      <div className="absolute top-4 right-4 z-[4] flex gap-1.5 rounded-full border border-border-strong/60 bg-background/70 p-1.5 shadow-md backdrop-blur-md">
        {SLIDES.map((s, i) => {
          const active = SLIDES[next ?? index]!.key === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => go(i)}
              aria-label={`Mostrar: ${s.label}`}
              aria-pressed={active}
              className="group relative flex h-6 w-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-text-primary/20 group-hover:bg-text-primary/35">
                {active && next === null && (
                  <span
                    key={`${s.key}-${state.run}`}
                    className={`mh-slide-progress absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary ${hold ? "is-paused" : ""} ${reduced ? "is-static" : ""}`}
                    style={{ animationDuration: `${HOLD_S}s` }}
                    onAnimationEnd={() => go(index + 1)}
                  />
                )}
                {active && next !== null && <span className="absolute inset-0 rounded-full bg-primary/60" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selo: flutua sobre a borda de baixo (não cobre o pino) e troca junto com a cena. */}
      <div className="absolute -bottom-6 left-4 z-[3] overflow-hidden rounded-lg border border-border-strong/70 bg-background/85 shadow-md backdrop-blur-md">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={shown.key}
            className="flex items-center gap-3 py-2.5 pr-4 pl-3"
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span aria-hidden="true" className={`mel-live size-2.5 shrink-0 rounded-full ${shown.chip.dot}`} />
            <span className="text-sm">
              <strong className="block font-bold">{shown.chip.title}</strong>
              <span className="text-text-secondary">{shown.chip.text}</span>
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Uma imagem recortada no tamanho do quadro, para cada face de cada quarteirão. */
function FaceImg({ s, W, H, c, r, tw, th }: { s: Slide; W: number; H: number; c: number; r: number; tw: number; th: number }) {
  const rect = coverRect(s, W, H);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- recorte da mesma imagem já carregada
    <img
      src={s.src}
      alt=""
      draggable={false}
      className="absolute max-w-none select-none"
      style={{ width: rect.w, height: rect.h, left: rect.x - c * tw, top: rect.y - r * th }}
    />
  );
}

/**
 * A troca de cena: quarteirões virando em 3D, em onda a partir da origem da cena que chega. Frente
 * = cena atual, verso = cena nova; cada quarteirão sobe um pouco no meio da virada e acende uma borda
 * dourada. Ao terminar, avisa (onDone) e some — a cena nova já está inteira por baixo.
 */
function TileWave({ from, to, W, H, onDone }: { from: Slide; to: Slide; W: number; H: number; onDone: () => void }) {
  const cols = W >= 480 ? 8 : 6;
  const rows = Math.max(4, Math.round((cols * H) / W));
  const tw = W / cols;
  const th = H / rows;
  const toRect = coverRect(to, W, H);
  const ox = toRect.x + to.origin[0] * toRect.w;
  const oy = toRect.y + to.origin[1] * toRect.h;
  const maxD = Math.max(...[0, W].flatMap((x) => [0, H].map((y) => Math.hypot(x - ox, y - oy))));
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = Math.hypot(c * tw + tw / 2 - ox, r * th + th / 2 - oy) / maxD;
      tiles.push({ c, r, delay: d * WAVE_S });
    }
  }
  const last = Math.max(...tiles.map((t) => t.delay));
  return (
    <div className="hs-wave absolute inset-0 z-50" aria-hidden="true">
      {tiles.map(({ c, r, delay }) => (
        <div
          key={`${c}-${r}`}
          className="hs-tile"
          style={{ left: c * tw, top: r * th, width: tw + 0.6, height: th + 0.6, "--d": `${delay}s`, "--f": `${FLIP_S}s` } as CSSProperties}
          onAnimationEnd={delay === last ? onDone : undefined}
        >
          <div className="hs-tile-inner">
            <div className="hs-face hs-face--front">
              <FaceImg s={from} W={W} H={H} c={c} r={r} tw={tw} th={th} />
            </div>
            <div className="hs-face hs-face--back">
              <FaceImg s={to} W={W} H={H} c={c} r={r} tw={tw} th={th} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Reduzir movimento": só esmaece para a cena nova (a cena por baixo já troca com fade). */
function ReducedSwap({ onDone }: { onDone: () => void }) {
  useLayoutEffect(() => {
    const id = window.setTimeout(onDone, 30);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return null;
}

/**
 * Vida na cena do Guardião: ondas douradas saindo do pino pelo chão (achatadas no mesmo plano em
 * perspectiva do disco da ilustração), uma luz no pino e um brilho que atravessa a cena de vez em quando.
 */
function GuardianLife({ slide, W, H }: { slide: Slide; W: number; H: number }) {
  const rect = coverRect(slide, W, H);
  const x = rect.x + slide.origin[0] * rect.w;
  const y = rect.y + slide.origin[1] * rect.h + 0.02 * rect.h; // base do pino, no chão
  const ring = Math.min(W, H) * 0.34;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute" style={{ left: x, top: y }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="hs-ground-ring" style={{ width: ring, height: ring * 0.3, animationDelay: `${i * 1.2}s` }} />
        ))}
        <span className="hs-pin-light" style={{ width: ring * 0.42, height: ring * 0.42 }} />
      </div>
      <span className="hs-shine" />
    </div>
  );
}
