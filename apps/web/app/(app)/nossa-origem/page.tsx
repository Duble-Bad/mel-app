import type { Metadata } from "next";
import Image from "next/image";
import { MelMark } from "@/components/brand/MelLogo";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Nossa origem",
  description: "Antes de ser um aplicativo, MEL foi uma busca. A história da Mel, a Yorkshire que deu origem à rede.",
};

/** História da marca: texto longo, largura de leitura (~680px), a foto real da Mel. */
export default function OriginPage() {
  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-[var(--mel-page-gutter)] pt-8 pb-16 sm:pt-14">
      <article className="flex animate-enter flex-col gap-8">
        <header className="flex flex-col gap-6">
          <figure className="relative self-start">
            <Image
              src="/brand/mel-origem.webp"
              alt="A Mel, uma pequena Yorkshire de pelo dourado e orelhas em pé"
              width={150}
              height={180}
              priority
              className="h-[180px] w-[150px] rounded-card object-cover object-top shadow-md ring-1 ring-border"
            />
            <span className="absolute -right-7 -bottom-7 rounded-[26%] shadow-sm ring-4 ring-background">
              <MelMark size={40} className="block" />
            </span>
            <figcaption className="sr-only">A Mel, que deu origem à MEL.</figcaption>
          </figure>
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-caption font-semibold tracking-[.08em] text-link uppercase">Nossa origem</p>
            <h1 className="text-3xl font-bold tracking-[-0.025em] sm:text-4xl">Antes de ser um aplicativo, MEL foi uma busca.</h1>
          </div>
        </header>

        <div className="flex flex-col gap-5 text-body-lg text-text-secondary">
          <p>Tudo começou com a Mel, uma pequena Yorkshire muito amada que desapareceu de casa.</p>
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

        <footer className="flex flex-col items-start gap-6 border-t border-border pt-8">
          <MelMark size={48} />
          <p className="text-2xl leading-tight font-bold tracking-[-0.02em] text-foreground">
            Porque quando um animal desaparece, ninguém deveria precisar procurá-lo sozinho.
          </p>
          <ButtonLink href="/" variant="secondary" size="md" className="sm:w-auto">
            Voltar ao início
          </ButtonLink>
        </footer>
      </article>
    </main>
  );
}
