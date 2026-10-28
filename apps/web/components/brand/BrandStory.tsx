import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MelMark } from "./MelLogo";

/**
 * Chamada da história da marca na home; o texto completo fica em /nossa-origem.
 * A foto real da Mel aparece pequena (original 239×287 px) e sem filtro nos dois temas.
 */
export function BrandStory() {
  return (
    <section aria-labelledby="historia" className="overflow-hidden rounded-card border border-border/70 bg-surface-warm p-5 shadow-sm">
      <div className="flex items-start gap-5">
        <figure className="relative shrink-0">
          <Image
            src="/brand/mel-origem.webp"
            alt="A Mel, uma pequena Yorkshire de pelo dourado e orelhas em pé"
            width={96}
            height={115}
            className="h-[115px] w-24 rounded-lg object-cover object-top ring-1 ring-border"
          />
          {/* Selo no canto, fora da foto: só toca a curva do canto (sem cobrir a Mel). */}
          <span className="absolute -right-6 -bottom-6 rounded-[26%] shadow-sm ring-4 ring-surface-warm">
            <MelMark size={30} className="block" />
          </span>
          <figcaption className="sr-only">A Mel, que deu origem à MEL.</figcaption>
        </figure>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-caption font-semibold tracking-[.06em] text-link uppercase">Nossa origem</p>
          <h2 id="historia" className="text-lg font-bold">
            Antes de ser um aplicativo, MEL foi uma busca.
          </h2>
        </div>
      </div>
      <p className="mt-8 text-text-secondary">
        Tudo começou com a Mel, uma pequena Yorkshire muito amada que desapareceu de casa. Dessa busca nasceu uma rede para
        que ninguém precise procurar sozinho.
      </p>
      <Link
        href="/nossa-origem"
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-link underline-offset-4 hover:underline"
      >
        Conheça a história da Mel
        <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
      </Link>
    </section>
  );
}
