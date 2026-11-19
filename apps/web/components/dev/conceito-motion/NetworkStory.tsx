"use client";

import { useRef, type CSSProperties } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { SectionHead, useCmReduced } from "./shared";

/* ---------- Mapa fictício (viewBox 800×600), gerado de forma determinística ---------- */

const CX = 400;
const CY = 310;
const WAVE_R = 500;
const TOTAL_GUARDIANS = 312;

/** Gerador pseudoaleatório com semente fixa: mesmo desenho no servidor e no navegador. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

const BLOCKS = (() => {
  const rnd = seeded(7);
  const out: { x: number; y: number; w: number; h: number; park: boolean }[] = [];
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 13; col++) {
      const skip = rnd() < 0.07;
      const park = (col === 8 || col === 9) && row === 3;
      if (skip && !park) continue;
      if (park && col === 9) continue; // a praça ocupa duas quadras
      out.push({ x: -190 + col * 96, y: -210 + row * 82, w: park ? 176 : 80, h: 66, park });
    }
  }
  return out;
})();

const GUARDIANS = (() => {
  const rnd = seeded(41);
  const out: { x: number; y: number; on: number; near: boolean }[] = [];
  while (out.length < 58) {
    const x = 30 + rnd() * 740;
    const y = 30 + rnd() * 540;
    const d = Math.hypot(x - CX, y - CY);
    if (d < 46) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 34)) continue;
    // O ponto acende quando a onda (que cresce de 0 a WAVE_R entre 26% e 60% da rolagem) passa por ele.
    out.push({ x: r3(x), y: r3(y), on: r3(0.26 + Math.min(d / WAVE_R, 1) * 0.34), near: d < 170 });
  }
  return out;
})();

const TRAIL = "M400 310 C 432 268, 452 240, 486 232 S 566 236, 594 262 S 648 322, 634 384";
const SIGHTINGS = [
  { x: 486, y: 232, on: 0.62, label: "14h32" },
  { x: 594, y: 262, on: 0.7, label: "15h10" },
  { x: 634, y: 384, on: 0.78, label: "15h48" },
];
const PIN = "M0 0 C -4 -10 -14 -17 -14 -28 A 14 14 0 1 1 14 -28 C 14 -17 4 -10 0 0 Z";

const STEPS = [
  { s: 0, e: 0.26, tone: "lost", tag: "Perdi", title: "O alerta sai em 2 minutos", text: "Foto, nome e o ponto onde o pet sumiu. O pino entra no mapa e o radar começa a varrer a vizinhança." },
  { s: 0.26, e: 0.6, tone: "brand", tag: "A rede acorda", title: "312 Guardiões avisados, em ondas", text: "Quem está mais perto recebe primeiro. O aviso se espalha como um pulso, quarteirão por quarteirão." },
  { s: 0.6, e: 0.86, tone: "sighting", tag: "Avistamentos", title: "Cada foto vira uma pista", text: "Quem vê o pet registra o avistamento, mesmo sem conta. Os pontos se ligam e desenham o caminho." },
  { s: 0.86, e: 1.2, tone: "found", tag: "Reencontro", title: "O caminho de volta para casa", text: "O contato acontece pelo chat seguro da MEL. O endereço nunca aparece, e a história termina em abraço." },
] as const;

/**
 * 2. "A rede se ativando": seção fixada (sticky) em que a rolagem conduz a história. Um único valor
 * (--p, de 0 a 1) é escrito por quadro; todo o resto (onda, pontos que acendem, pinos, trilha,
 * câmera, legendas) é derivado em CSS com calc()/clamp(), sem re-renderizar o React.
 */
export function NetworkStory() {
  const reduced = useCmReduced();
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.0005 });
  const count = useTransform(progress, (p) => Math.round(TOTAL_GUARDIANS * Math.min(Math.max((p - 0.26) / 0.34, 0), 1)));

  return (
    <section id="rede" aria-labelledby="cm-rede-title" className="cm-section">
      <div className="mel-container">
        <SectionHead
          id="cm-rede-title"
          index="01"
          kicker="A rede se ativando"
          title={<>Do susto ao reencontro, em quatro movimentos.</>}
          lead="Role devagar: a própria rolagem conduz a história. Cada ponto dourado é um Guardião que recebeu o alerta."
        />
      </div>

      <div ref={track} className="cm-story">
        <motion.div className="cm-story-pin" style={{ "--p": reduced ? 1 : progress } as unknown as CSSProperties}>
          <div className="mel-container cm-story-grid">
            <div className="cm-steps-wrap">
            <ol className="cm-steps">
              {STEPS.map((step, i) => (
                <li key={step.tag} className="cm-step" data-tone={step.tone} style={{ "--s": step.s, "--e": step.e } as CSSProperties}>
                  <span className="cm-step-tag">
                    <span className="cm-step-n">{i + 1}</span>
                    {step.tag}
                  </span>
                  <h3 className="cm-step-title">{step.title}</h3>
                  <p className="cm-step-text">{step.text}</p>
                </li>
              ))}
            </ol>
              <span className="cm-rail" aria-hidden="true">
                <span />
              </span>
            </div>

            <div className="cm-scene">
              <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mapa ilustrativo de um bairro: o pino do pet perdido emite ondas, os Guardiões acendem e os avistamentos formam uma trilha até o reencontro">
                <g className="cm-cam">
                  <g transform={`rotate(-13 ${CX} ${CY})`}>
                    {BLOCKS.map((b) => (
                      <rect key={`${b.x}-${b.y}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="9" className={b.park ? "cm-park" : "cm-block"} />
                    ))}
                  </g>
                  <path d="M-40 500 C 180 470, 300 380, 420 330 S 680 220, 850 150" className="cm-avenue" />
                  <path d="M-40 500 C 180 470, 300 380, 420 330 S 680 220, 850 150" className="cm-avenue-mark" />
                  <text x="214" y="156" className="cm-hood">VILA MADALENA</text>
                  <text x="214" y="568" className="cm-hood">PINHEIROS</text>
                  <text x="498" y="112" className="cm-hood">SUMARÉ</text>

                  {/* Onda do alerta */}
                  <circle cx={CX} cy={CY} r={WAVE_R} className="cm-wave" />
                  <circle cx={CX} cy={CY} r={WAVE_R} className="cm-wave cm-wave-2" />

                  {/* Ligações com os Guardiões mais próximos */}
                  {GUARDIANS.filter((g) => g.near).map((g) => (
                    <line key={`l${g.x}`} x1={CX} y1={CY} x2={g.x} y2={g.y} className="cm-link" style={{ "--on": g.on } as CSSProperties} />
                  ))}

                  {/* Guardiões */}
                  {GUARDIANS.map((g) => (
                    <g key={`g${g.x}`} className="cm-g" style={{ "--on": g.on } as CSSProperties}>
                      <circle cx={g.x} cy={g.y} r="13" className="cm-g-halo" />
                      <circle cx={g.x} cy={g.y} r="3" className="cm-g-off" />
                      <circle cx={g.x} cy={g.y} r="3.6" className="cm-g-on" />
                    </g>
                  ))}

                  {/* Trilha de avistamentos */}
                  <path d={TRAIL} pathLength={1} className="cm-trail" />
                  <path d={TRAIL} pathLength={1} className="cm-trail cm-trail-found" />

                  {SIGHTINGS.map((s, i) => (
                    <g key={s.label} className={`cm-sight ${i === 2 ? "cm-sight-last" : ""}`} style={{ "--on": s.on } as CSSProperties}>
                      <g transform={`translate(${s.x} ${s.y})`}>
                        <circle r="5" className="cm-sight-base" />
                        <g className="cm-sight-pin">
                          <path d={PIN} />
                          <circle cy="-28" r="5.5" className="cm-pin-eye" />
                          <text y="-50" textAnchor="middle" className="cm-pin-label">
                            {s.label}
                          </text>
                        </g>
                      </g>
                    </g>
                  ))}

                  {/* Pino do pet perdido, com radar */}
                  <g transform={`translate(${CX} ${CY})`}>
                    <g className="cm-lost">
                      <circle r="64" className="cm-lost-ring" />
                      <circle r="64" className="cm-lost-ring cm-lost-ring-2" />
                      <g className="cm-lost-pin">
                        <path d={PIN} transform="scale(1.35)" />
                        <circle cy="-38" r="7.5" className="cm-pin-eye" />
                        <text y="-66" textAnchor="middle" className="cm-pin-label cm-pin-label-lg">
                          Mel sumiu aqui
                        </text>
                      </g>
                    </g>
                  </g>

                  {/* Reencontro */}
                  <g transform="translate(634 384)">
                    <g className="cm-found">
                      <circle r="46" className="cm-found-halo" />
                      <circle r="46" className="cm-found-ring" />
                      <g className="cm-found-pin">
                        <path d={PIN} transform="scale(1.5)" />
                        <path d="M0 -36.5 c -2.6 -4.6 -9.2 -2.6 -8.6 2.6 c 0.5 4 5.2 6.6 8.6 9.6 c 3.4 -3 8.1 -5.6 8.6 -9.6 c 0.6 -5.2 -6 -7.2 -8.6 -2.6 Z" className="cm-pin-eye" />
                        <text y="-74" textAnchor="middle" className="cm-pin-label cm-pin-label-lg">
                          Reencontro
                        </text>
                      </g>
                    </g>
                  </g>
                </g>
              </svg>

              <div className="cm-hud cm-hud-tl">
                <span className="cm-hud-k">Guardiões avisados</span>
                <span className="cm-hud-v tabular-nums">{reduced ? TOTAL_GUARDIANS : <motion.span>{count}</motion.span>}</span>
              </div>
              <div className="cm-hud cm-hud-br" aria-hidden="true">
                <span className="cm-hud-k">Raio do alerta</span>
                <span className="cm-hud-v">2 km</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
