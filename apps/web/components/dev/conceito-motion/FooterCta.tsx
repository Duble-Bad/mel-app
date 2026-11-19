"use client";

import Link from "next/link";
import { ArrowRight, ArrowUp } from "lucide-react";
import { MelMark } from "@/components/brand/MelLogo";
import { GooBackdrop } from "@/components/home/GooBackdrop";
import { Magnetic } from "./shared";

/**
 * 7. Chamada final: bolhas douradas que se fundem como mel (filtro "gooey" em SVG), com uma bolha
 * extra que segue o ponteiro. É o mesmo fundo da chamada final do início (components/home/GooBackdrop).
 */
export function FooterCta() {
  return (
    <section aria-labelledby="cm-cta-title" className="cm-section cm-section-last">
      <div className="mel-container">
        <GooBackdrop>
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
        </GooBackdrop>
      </div>
    </section>
  );
}
