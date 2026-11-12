import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, HeartHandshake } from "lucide-react";
import { GlassCard, LightFrame } from "@/components/brand/LightFrame";
import { MelMark } from "@/components/brand/MelLogo";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Nossa origem",
  description: "Antes de ser um aplicativo, MEL foi uma busca. A história da Mel, a Yorkshire que deu origem à rede.",
};

/**
 * História da marca. Topo em duas colunas no desktop: o título e a abertura da história à esquerda;
 * à direita, a Mel na "moldura de luz" (feixe dourado, aura, pegadas e cartões de vidro), com a foto
 * real da Mel num cartão. Embaixo, a história em duas colunas no desktop (uma no celular). Os textos
 * são os do proprietário, sem alteração.
 */
export default function OriginPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section aria-labelledby="origem-title" className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(55%_70%_at_78%_40%,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_70%),radial-gradient(35%_40%_at_0%_55%,color-mix(in_srgb,var(--color-status-found-accent)_9%,transparent),transparent_70%)]"
        />
        <div className="mel-container grid gap-12 pt-8 pb-14 sm:pt-12 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 lg:pt-16 lg:pb-20">
          <div className="flex animate-enter flex-col items-start gap-5 lg:gap-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary-soft/60 px-3.5 py-1.5 text-sm font-semibold tracking-[.06em] text-text-primary uppercase">
              <MelMark size={18} className="block" />
              Nossa origem
            </p>
            <h1 id="origem-title" className="text-[clamp(34px,8vw,58px)] leading-[1.04] font-extrabold tracking-[-0.035em] text-balance">
              Antes de ser um aplicativo, <span className="text-primary">MEL</span> foi uma busca.
            </h1>
            <p className="max-w-[40ch] text-body-lg text-text-secondary lg:text-xl">
              Tudo começou com a Mel, uma pequena Yorkshire muito amada que desapareceu de casa.
            </p>
            <a
              href="#historia"
              className="group inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong px-6 font-bold text-text-primary transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-surface-muted active:scale-[.97]"
            >
              Ler a história
              <ArrowDown aria-hidden="true" className="size-5 transition-transform duration-200 group-hover:translate-y-0.5" />
            </a>
          </div>

          <LightFrame
            className="mx-auto w-full max-w-xl animate-enter lg:max-w-none"
            farClassName="-top-6 -left-6 hidden sm:block"
            nearClassName="-bottom-8 right-3 sm:-right-6"
            far={
              <GlassCard className="flex items-center gap-3 py-2.5 pr-4 pl-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-primary/20 text-primary">
                  <HeartHandshake aria-hidden="true" className="size-5" />
                </span>
                <span className="text-sm leading-tight">
                  <strong className="block font-bold">Uma busca virou rede</strong>
                  <span className="text-text-secondary">para ninguém procurar sozinho</span>
                </span>
              </GlassCard>
            }
            near={
              <GlassCard className="flex items-center gap-3 p-2 pr-4">
                <Image
                  src="/brand/mel-origem.webp"
                  alt="A Mel, uma pequena Yorkshire de pelo dourado e orelhas em pé"
                  width={64}
                  height={77}
                  className="h-[77px] w-16 rounded-lg object-cover object-top ring-1 ring-border"
                />
                <span className="text-sm leading-tight">
                  <strong className="block font-bold">A Mel</strong>
                  <span className="text-text-secondary">onde tudo começou</span>
                </span>
              </GlassCard>
            }
          >
            <Image
              src="/fotos/mel-e-gatinho.webp"
              alt="A Mel, uma Yorkshire com laço amarelo, abraçada a um gatinho tigrado"
              width={1600}
              height={901}
              priority
              sizes="(min-width: 1024px) 620px, 100vw"
              className="aspect-[4/3] w-full object-cover object-[62%_35%] lg:aspect-[5/4]"
            />
          </LightFrame>
        </div>
      </section>

      <article id="historia" aria-label="A história da Mel" className="mel-container scroll-mt-20 pb-16">
        <div className="grid gap-8 border-t border-border pt-12 lg:grid-cols-2 lg:gap-16 lg:pt-16">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 text-body-lg text-text-secondary">
              <p>De repente, alguém que fazia parte da família não estava mais ali.</p>
              <p>
                Vieram as buscas pelas ruas, os cartazes, as mensagens, os grupos, as publicações nas redes sociais e aquela
                esperança que fazia cada informação parecer a possibilidade de trazê-la de volta.
              </p>
              <p>Muitas pessoas quiseram ajudar. Mas percebemos um problema:</p>
            </div>
            <blockquote className="rounded-card border-l-4 border-brand bg-surface-warm p-6 text-xl leading-snug font-semibold text-foreground">
              Quem procurava, quem tinha visto e quem queria ajudar estavam espalhados por lugares diferentes.
            </blockquote>
          </div>

          <div className="flex flex-col gap-5 text-body-lg text-text-secondary">
            <p>Faltava uma forma simples de conectar todas essas pessoas no momento em que cada minuto importava.</p>
            <p className="font-semibold text-foreground">Foi dessa busca que nasceu a MEL.</p>
            <p>
              Uma rede criada para transformar a procura solitária em uma busca coletiva — conectando famílias, pessoas
              próximas, avistamentos e informações em um só lugar.
            </p>
            <p>A Mel foi o começo dessa história.</p>
            <p>Hoje, cada animal encontrado, cada família ajudada e cada reencontro possível carrega um pouco dela.</p>
          </div>
        </div>

        <footer className="mt-14 flex flex-col items-start gap-6 rounded-hero border border-border bg-surface-warm p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <MelMark size={56} className="shrink-0" />
            <p className="max-w-[34ch] text-2xl leading-tight font-bold tracking-[-0.02em] text-foreground">
              Porque quando um animal desaparece, ninguém deveria precisar procurá-lo sozinho.
            </p>
          </div>
          <ButtonLink href="/" variant="secondary" size="md" className="sm:w-auto">
            Voltar ao início
          </ButtonLink>
        </footer>
      </article>
    </main>
  );
}
