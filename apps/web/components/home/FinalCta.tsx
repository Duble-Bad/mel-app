import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MelMark } from "@/components/brand/MelLogo";
import { Magnetic } from "@/components/ui/motion/Magnetic";
import { GooBackdrop } from "./GooBackdrop";

/**
 * Chamada final do início (conceito de movimento): o convite para entrar na rede sobre o fundo
 * "de mel". Nomes de link diferentes dos outros da página (cada link com nome único).
 */
export function FinalCta() {
  return (
    <section aria-labelledby="fim-title">
      <div className="mel-container py-16 lg:py-[72px]">
        <GooBackdrop>
          <MelMark size={60} className="mb-6 rounded-[23%] shadow-lg" />
          <h2 id="fim-title" className="max-w-[18ch] text-[clamp(32px,5.4vw,64px)] leading-[1.02] font-extrabold tracking-[-0.04em] text-balance">
            Nenhum pet deveria procurar o caminho de casa sozinho.
          </h2>
          <p className="mt-5 max-w-xl text-lg text-pretty text-text-secondary">
            Entre para a rede: em poucos minutos você publica um alerta, registra um avistamento ou passa a receber os avisos da sua região.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <Link
                href="/entrar?criar=1"
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary px-7 font-extrabold text-primary-foreground shadow-primary transition-[background-color,transform] duration-200 hover:bg-primary-hover active:scale-[.97]"
              >
                Fazer parte da rede
                <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.25} />
              </Link>
            </Magnetic>
            <Link
              href="/mural"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface/60 px-7 font-bold text-text-primary transition-[background-color,transform] duration-200 hover:bg-surface-muted active:scale-[.97]"
            >
              Ver quem precisa de ajuda
            </Link>
          </div>
        </GooBackdrop>
      </div>
    </section>
  );
}
