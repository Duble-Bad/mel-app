"use client";

import Link from "next/link";
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowRight, ArrowUp } from "lucide-react";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";
import { MelMark } from "@/components/brand/MelLogo";
import { Magnetic, useCmReduced } from "./shared";

const blob = (width: string, left: string, top: string, tx: string, ty: string, ts: number, seconds: number) =>
  ({ width, left, top, "--tx": tx, "--ty": ty, "--ts": ts, animationDuration: `${seconds}s` }) as CSSProperties;

const BLOBS: CSSProperties[] = [
  blob("22%", "-6%", "62%", "90%", "-30%", 1.25, 13),
  blob("16%", "12%", "78%", "140%", "-60%", 0.8, 17),
  blob("20%", "38%", "80%", "-70%", "-34%", 1.2, 15),
  blob("15%", "60%", "74%", "110%", "-50%", 1.3, 19),
  blob("24%", "80%", "58%", "-80%", "26%", 0.85, 14),
  blob("14%", "-4%", "-14%", "120%", "60%", 1.3, 21),
  blob("17%", "86%", "-18%", "-130%", "50%", 1.15, 18),
];

/**
 * 7. Chamada final: bolhas douradas que se fundem como mel (filtro "gooey" em SVG), com uma bolha
 * extra que segue o ponteiro. As bolhas só se movem enquanto o bloco está na tela.
 */
export function FooterCta() {
  const reduced = useCmReduced();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.05 });
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 60, damping: 16 });
  const y = useSpring(my, { stiffness: 60, damping: 16 });

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - (r.left + r.width / 2));
    my.set(e.clientY - (r.top + r.height / 2));
  }

  return (
    <section aria-labelledby="cm-cta-title" className="cm-section cm-section-last">
      <div className="mel-container">
        <div ref={ref} className="cm-cta" data-live={inView && !reduced} onPointerMove={onMove}>
          <div className="cm-cta-goo" aria-hidden="true">
            {BLOBS.map((style, i) => (
              <span key={i} className="cm-blob" style={style} />
            ))}
            <motion.span className="cm-blob cm-blob-ptr" style={{ x, y }} />
          </div>

          <MelMark size={60} className="cm-cta-mark" />
          <h2 id="cm-cta-title" className="cm-cta-title text-balance">
            Nenhum pet deveria procurar o caminho de casa sozinho.
          </h2>
          <p className="mt-5 max-w-xl text-body-lg text-pretty text-text-secondary">
            Este é um conceito de movimento para comparar com o site atual. Se algo aqui fizer sentido, a gente leva
            para as telas de verdade, uma por vez.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <Link href="/guardiao" className="cm-btn cm-btn-gold">
                <span className="cm-btn-sheen" aria-hidden="true" />
                Quero ser Guardião
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </Magnetic>
            <Link href="/" className="cm-btn cm-btn-ghost">
              Comparar com o site atual
            </Link>
          </div>
          <a href="#topo" className="cm-link mt-8 inline-flex items-center gap-2 text-sm">
            <ArrowUp size={15} aria-hidden="true" />
            Voltar ao topo
          </a>
        </div>
      </div>
    </section>
  );
}
