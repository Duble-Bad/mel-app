import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, HeartHandshake, MapPin, PawPrint, Users, type LucideIcon } from "lucide-react";
import { GlassCard, LightFrame } from "@/components/brand/LightFrame";
import { MelMark } from "@/components/brand/MelLogo";
import { RevealMotion } from "@/components/brand/RevealMotion";
import { ButtonLink } from "@/components/ui/Button";
import "./origem.css";

export const metadata: Metadata = {
  title: "Nossa origem",
  description: "Antes de ser um aplicativo, MEL foi uma busca. A história da Mel, a Yorkshire que deu origem à rede.",
};

/** O nome: MEL = Movimento de Encontro e Localização (o mesmo do manifesto do app e da Privacidade). */
const LETTERS: { letter: string; word: string; text: string; Icon: LucideIcon }[] = [
  { letter: "M", word: "Movimento", text: "Gente que se mobiliza junto: vizinhos, protetores, parceiros e quem só passou e viu.", Icon: Users },
  { letter: "E", word: "Encontro", text: "O objetivo de tudo: cada pet de volta para casa, cada família reencontrada.", Icon: PawPrint },
  { letter: "L", word: "Localização", text: "Alertas e avistamentos no lugar certo, para quem está perto, sem expor o endereço de ninguém.", Icon: MapPin },
];

/**
 * História da marca. Topo em duas colunas no desktop: o título e a abertura da história à esquerda;
 * à direita, a Mel na "moldura de luz" (feixe dourado, aura, pegadas e cartões de vidro), com a foto
 * real da Mel num cartão. Embaixo, a história em duas colunas no desktop (uma no celular). Os textos
 * são os do proprietário, sem alteração.
 */
export default function OriginPage() {
  return (
    <main className="flex flex-1 flex-col">
      <RevealMotion />
      <div aria-hidden="true" className="or-progress" />
      <section aria-labelledby="origem-title" className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(55%_70%_at_78%_40%,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_70%),radial-gradient(35%_40%_at_0%_55%,color-mix(in_srgb,var(--color-status-found-accent)_9%,transparent),transparent_70%)]"
        />
        <div className="mel-container grid gap-12 pt-8 pb-14 sm:pt-12 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 lg:pt-16 lg:pb-20">
          <div className="flex flex-col items-start gap-5 lg:gap-6">
            <p className="inline-flex animate-enter items-center gap-2 rounded-full border border-primary/50 bg-primary-soft/60 px-3.5 py-1.5 text-sm font-semibold tracking-[.06em] text-text-primary uppercase">
              <MelMark size={18} className="block" />
              Nossa origem
            </p>
            <h1 id="origem-title" style={{ animationDelay: "90ms" }} className="animate-enter text-[clamp(34px,8vw,58px)] leading-[1.04] font-extrabold tracking-[-0.035em] text-balance">
              Antes de ser um aplicativo,{" "}
              <span className="or-shimmer relative inline-block text-primary">
                MEL
                <svg aria-hidden="true" viewBox="0 0 300 30" preserveAspectRatio="none" className="mel-draw absolute -bottom-[0.12em] left-0 h-[0.26em] w-full overflow-visible">
                  <path d="M4 20 C 80 6, 200 4, 296 16" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" style={{ "--len": 320, "--delay": "0.8s" } as React.CSSProperties} />
                </svg>
              </span>{" "}
              foi uma busca.
            </h1>
            <p style={{ animationDelay: "180ms" }} className="max-w-[40ch] animate-enter text-body-lg text-text-secondary lg:text-xl">
              Tudo começou com a Mel, uma pequena Yorkshire muito amada que desapareceu de casa.
            </p>
            <a
              href="#historia"
              style={{ animationDelay: "260ms" }}
              className="group inline-flex animate-enter min-h-12 items-center gap-2 rounded-full border border-border-strong px-6 font-bold text-text-primary transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-surface-muted active:scale-[.97]"
            >
              Ler a história
              <ArrowDown aria-hidden="true" className="or-bob size-5" />
            </a>
          </div>

          <LightFrame
            className="mx-auto w-full max-w-xl animate-enter lg:max-w-none"
            farClassName="-top-6 -left-6 hidden sm:block"
            nearClassName="-bottom-8 right-3 sm:-right-6"
            far={
              <GlassCard className="or-float flex items-center gap-3 py-2.5 pr-4 pl-2.5">
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
              <GlassCard className="or-float flex items-center gap-3 p-2 pr-4 [animation-delay:-3s]">
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

      <article id="historia" aria-label="A história da Mel" className="mel-container flex scroll-mt-20 flex-col gap-6 pb-16 lg:gap-8">
        {/* A história em um painel só: três capítulos lado a lado no desktop (um embaixo do outro no
            celular) e o fechamento dentro do mesmo painel. Textos do proprietário sem alteração. */}
        <section aria-label="A história" data-or="up" className="overflow-hidden rounded-hero border border-border bg-surface/60 shadow-sm">
          <div className="grid lg:grid-cols-[1fr_1.05fr_1fr]">
            <div data-or="up" style={{ "--d": "0.15s" } as React.CSSProperties} className="flex flex-col gap-4 p-7 sm:p-9">
              <ChapterLabel n="01" title="A busca" />
              <div className="flex flex-col gap-4 text-body-lg text-text-secondary">
                <p>De repente, alguém que fazia parte da família não estava mais ali.</p>
                <p>
                  Vieram as buscas pelas ruas, os cartazes, as mensagens, os grupos, as publicações nas redes sociais e aquela
                  esperança que fazia cada informação parecer a possibilidade de trazê-la de volta.
                </p>
                <p>Muitas pessoas quiseram ajudar. Mas percebemos um problema:</p>
              </div>
            </div>

            <div data-or="up" style={{ "--d": "0.3s" } as React.CSSProperties} className="flex flex-col gap-4 border-y border-border bg-primary/[.04] p-7 sm:p-9 lg:border-x lg:border-y-0">
              <ChapterLabel n="02" title="O problema" />
              <div className="flex flex-1 items-center">
                <blockquote className="or-bar text-[clamp(20px,1.9vw,23px)] leading-snug font-bold tracking-[-0.01em] text-foreground">
                  Quem procurava, quem tinha visto e quem queria ajudar estavam espalhados por lugares diferentes.
                </blockquote>
              </div>
              <p className="text-body-lg text-text-secondary">Faltava uma forma simples de conectar todas essas pessoas no momento em que cada minuto importava.</p>
            </div>

            <div data-or="up" style={{ "--d": "0.45s" } as React.CSSProperties} className="flex flex-col gap-4 p-7 sm:p-9">
              <ChapterLabel n="03" title="A rede" />
              <div className="flex flex-col gap-4 text-body-lg text-text-secondary">
                <p className="font-semibold text-foreground">Foi dessa busca que nasceu a MEL.</p>
                <p>
                  Uma rede criada para transformar a procura solitária em uma busca coletiva — conectando famílias, pessoas
                  próximas, avistamentos e informações em um só lugar.
                </p>
              </div>
              <div data-or="scale" style={{ "--d": "0.7s" } as React.CSSProperties} className="or-sheen mt-auto flex items-start gap-3.5 rounded-card border border-primary/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_75%)] p-4.5">
                <span className="or-pulse shrink-0">
                  <MelMark size={36} className="block" />
                </span>
                <p className="text-text-secondary">
                  <strong className="font-semibold text-foreground">A Mel foi o começo dessa história.</strong> Hoje, cada animal encontrado,
                  cada família ajudada e cada reencontro possível carrega um pouco dela.
                </p>
              </div>
            </div>
          </div>

        </section>

        {/* O nome: um painel com a introdução (e o símbolo) à esquerda e as três letras à direita. */}
        <section aria-labelledby="nome-title" data-or="up" className="grid overflow-hidden rounded-hero border border-border bg-surface/60 shadow-sm lg:grid-cols-[0.95fr_1.25fr]">
          <div data-or="left" style={{ "--d": "0.15s" } as React.CSSProperties} className="flex flex-col gap-4 p-7 sm:p-9 lg:justify-between lg:gap-8">
            <div className="flex flex-col gap-3">
              <p className="text-caption font-semibold tracking-[.08em] text-link uppercase">O nome</p>
              <h2 id="nome-title" className="text-[clamp(28px,4vw,40px)] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
                <span className="text-primary">MEL</span> é o nome dela. E virou o nosso.
              </h2>
              <p className="text-body-lg text-text-secondary">
                Cada letra guarda uma parte do que aprendemos procurando a Mel:{" "}
                <strong className="font-semibold text-foreground">Movimento de Encontro e Localização</strong>.
              </p>
            </div>
            <div className="flex items-start gap-4 rounded-card border border-border bg-surface-warm p-5">
              <span className="or-pulse shrink-0" style={{ "--pd": "1s" } as React.CSSProperties}>
                <MelMark size={44} className="block" />
              </span>
              <p className="text-text-secondary">
                <strong className="font-semibold text-foreground">O símbolo também é ela:</strong> a cabeça de uma Yorkshire, com as orelhas
                marcantes, que converge para a ponta de um pino de localização. O focinho é o ponto no mapa.
              </p>
            </div>
          </div>

          <ol className="flex flex-col border-t border-border lg:border-t-0 lg:border-l">
            {LETTERS.map(({ letter, word, text, Icon }, i) => (
              <li
                key={letter}
                data-or="right"
                style={{ "--d": `${0.25 + i * 0.18}s` } as React.CSSProperties}
                className="group flex flex-1 items-center gap-5 border-b border-border p-6 transition-colors duration-300 last:border-b-0 hover:bg-primary/[.05] sm:gap-7 sm:px-9"
              >
                <span
                  aria-hidden="true"
                  className="or-letter w-14 shrink-0 text-center text-[64px] leading-none font-extrabold tracking-[-0.05em] text-primary transition-transform duration-300 group-hover:scale-110 sm:w-16 sm:text-[76px]"
                >
                  {letter}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="flex items-center gap-2 text-xl font-extrabold tracking-[-0.02em]">
                    {word}
                    <Icon aria-hidden="true" className="size-4.5 text-primary" />
                  </h3>
                  <p className="text-text-secondary">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer data-or="up" className="or-sheen flex flex-col items-start gap-6 rounded-hero border border-primary/30 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--color-primary)_14%,var(--color-surface-warm)),var(--color-surface-warm)_60%)] p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <span className="or-pulse shrink-0" style={{ "--pd": "0.5s" } as React.CSSProperties}>
              <MelMark size={56} className="block" />
            </span>
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

/** Rótulo de capítulo da história: número e título. */
function ChapterLabel({ n, title }: { n: string; title: string }) {
  return (
    <p className="flex items-center gap-2.5 text-caption font-bold tracking-[.08em] uppercase">
      <span className="or-pop grid size-7 place-items-center rounded-full bg-primary/15 text-[12px] text-primary">{n}</span>
      <span className="text-text-secondary">{title}</span>
    </p>
  );
}
