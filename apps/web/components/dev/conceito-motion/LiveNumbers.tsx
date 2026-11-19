"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TrendingUp } from "lucide-react";
import { motion, useInView } from "motion/react";
import { SectionHead, useCmReduced } from "./shared";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const formatBR = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Odômetro: cada casa é uma coluna 0–9 que rola até o dígito (só transform). */
function Odometer({ value, active }: { value: number; active: boolean }) {
  const text = formatBR(value);
  const chars = Array.from(text);
  return (
    <span className="cm-odo" role="img" aria-label={text}>
      {chars.map((ch, i) => {
        const fromRight = chars.length - 1 - i;
        if (ch === ".") {
          return (
            <span key={`s${fromRight}`} aria-hidden="true">
              .
            </span>
          );
        }
        return (
          <span key={fromRight} className="cm-odo-col" aria-hidden="true">
            <span className="cm-odo-strip" style={{ "--d": active ? Number(ch) : 0, "--i": fromRight } as CSSProperties}>
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

const ALPHA = "ABCDEFGHIJLMNOPRSTUVZÃÉ ";
const PLACES = ["PERDIZES", "PINHEIROS", "VILA MARIANA", "BUTANTÃ", "POMPEIA", "LAPA"];
const FLAP_LEN = 12;

/** Painel de aeroporto (split-flap): as letras "embaralham" e assentam da esquerda para a direita. */
function SplitFlap({ text, animated }: { text: string; animated: boolean }) {
  const target = text.padEnd(FLAP_LEN, " ");
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (!animated) return;
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      let done = true;
      const next = Array.from(target, (ch, i) => {
        if (tick >= 4 + i * 1.6) return ch;
        done = false;
        return ALPHA[(tick * 7 + i * 13) % ALPHA.length] ?? ch;
      }).join("");
      setShown(next);
      if (done) clearInterval(id);
    }, 62);
    return () => clearInterval(id);
  }, [target, animated]);

  const display = animated ? shown : target;
  return (
    <span className="cm-flap">
      <span className="sr-only">{text}</span>
      {Array.from(display, (ch, i) => (
        <span key={i} className="cm-flap-cell" aria-hidden="true">
          <span key={ch} className="cm-flap-char">
            {ch === " " ? " " : ch}
          </span>
        </span>
      ))}
    </span>
  );
}

/* Gráfico: avistamentos por hora (fictício), curva suavizada calculada uma vez. */
const SERIES = [6, 5, 4, 4, 3, 5, 9, 14, 18, 16, 15, 19, 24, 21, 18, 20, 26, 31, 28, 24, 27, 33, 30, 36];
const W = 640;
const H = 200;
const PAD = 14;
const POINTS = SERIES.map((v, i) => ({ x: PAD + (i / (SERIES.length - 1)) * (W - PAD * 2), y: H - PAD - (v / 40) * (H - PAD * 2) }));
const LINE = POINTS.reduce((d, p, i, arr) => {
  if (i === 0) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const p0 = arr[i - 2] ?? arr[i - 1]!;
  const p1 = arr[i - 1]!;
  const p3 = arr[i + 1] ?? p;
  const c1x = p1.x + (p.x - p0.x) / 6;
  const c1y = p1.y + (p.y - p0.y) / 6;
  const c2x = p.x - (p3.x - p1.x) / 6;
  const c2y = p.y - (p3.y - p1.y) / 6;
  return `${d} C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
}, "");
const AREA = `${LINE} L${W - PAD} ${H} L${PAD} ${H} Z`;
const LAST = POINTS[POINTS.length - 1]!;

type Stats = { home: number; guardians: number; sightings: number };

/**
 * 4. Números da rede ao vivo (fictícios): odômetros que rolam e continuam "pulsando" enquanto a
 * seção está na tela, gráfico que se desenha sozinho e um painel split-flap com o último reencontro.
 */
export function LiveNumbers() {
  const reduced = useCmReduced();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.25 });
  const live = useInView(ref, { amount: 0.1 });
  const [stats, setStats] = useState<Stats>({ home: 1284, guardians: 8612, sightings: 437 });
  const [place, setPlace] = useState(0);

  useEffect(() => {
    if (!live || reduced) return;
    const tick = setInterval(() => {
      const r = Math.random();
      const bump = 1 + Math.floor(Math.random() * 3);
      setStats((s) => (r < 0.5 ? { ...s, guardians: s.guardians + bump } : r < 0.85 ? { ...s, sightings: s.sightings + 1 } : { ...s, home: s.home + 1 }));
    }, 2300);
    const flap = setInterval(() => setPlace((p) => (p + 1) % PLACES.length), 4600);
    return () => {
      clearInterval(tick);
      clearInterval(flap);
    };
  }, [live, reduced]);

  const active = seen || reduced;
  const draw = reduced ? false : { pathLength: 0 };
  const fade = reduced ? false : { opacity: 0 };

  return (
    <section id="numeros" aria-labelledby="cm-numeros-title" className="cm-section">
      <div className="mel-container">
        <SectionHead
          id="cm-numeros-title"
          index="03"
          kicker="A rede, agora"
          title={<>Números que respiram junto com a vizinhança.</>}
          lead="Contadores que rolam como um odômetro e seguem vivos enquanto você olha. Valores fictícios, só para demonstração."
        />

        <div ref={ref} className="mt-10 grid gap-4 lg:grid-cols-12">
          <article className="cm-panel lg:col-span-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="cm-panel-k">Avistamentos nesta semana</p>
                <p className="cm-big tabular-nums">
                  <Odometer value={stats.sightings} active={active} />
                </p>
              </div>
              <span className="cm-delta">
                <TrendingUp size={15} aria-hidden="true" />
                18% acima da semana passada
              </span>
            </div>

            <svg key={String(reduced)} viewBox={`0 0 ${W} ${H}`} className="cm-chart" role="img" aria-label="Gráfico de linha: avistamentos por hora nas últimas 24 horas, em alta no fim do dia">
              <defs>
                <linearGradient id="cm-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--mel-brand)" stopOpacity=".34" />
                  <stop offset="1" stopColor="var(--mel-brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((t) => (
                <line key={t} x1={PAD} x2={W - PAD} y1={H * t} y2={H * t} className="cm-chart-grid" />
              ))}
              <motion.path d={AREA} fill="url(#cm-area)" initial={fade} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 1, delay: 1.5 }} />
              <motion.path d={LINE} className="cm-chart-line" initial={draw} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 2.1, ease: [0.65, 0, 0.35, 1] }} />
              <motion.g initial={fade} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.4, delay: 2 }}>
                <circle cx={LAST.x} cy={LAST.y} r="14" className="cm-chart-ping" />
                <circle cx={LAST.x} cy={LAST.y} r="5.5" className="cm-chart-dot" />
              </motion.g>
            </svg>
            <div className="cm-chart-x" aria-hidden="true">
              <span>00h</span>
              <span>06h</span>
              <span>12h</span>
              <span>18h</span>
              <span>agora</span>
            </div>
          </article>

          <div className="grid grid-cols-2 gap-4 lg:col-span-5">
            <article className="cm-panel cm-panel-tile">
              <p className="cm-panel-k">Pets de volta para casa</p>
              <p className="cm-mid tabular-nums text-status-found">
                <Odometer value={stats.home} active={active} />
              </p>
              <p className="cm-panel-foot">12 reencontros só nesta semana</p>
            </article>
            <article className="cm-panel cm-panel-tile">
              <p className="cm-panel-k">Guardiões ativos</p>
              <p className="cm-mid tabular-nums text-primary">
                <Odometer value={stats.guardians} active={active} />
              </p>
              <p className="cm-panel-foot">em 96 bairros de São Paulo</p>
            </article>
            <article className="cm-panel cm-panel-tile col-span-2">
              <p className="cm-panel-k">
                <span className="cm-live-dot" aria-hidden="true" />
                Último reencontro confirmado
              </p>
              <p className="mt-3">
                <SplitFlap text={PLACES[place] ?? ""} animated={!reduced} />
              </p>
              <p className="mt-3 text-sm text-text-secondary">
                Mediana até o primeiro avistamento:{" "}
                <b className="text-text-primary">38 min</b>
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
