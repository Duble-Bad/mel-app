import Image from "next/image";
import { MelMark } from "./MelLogo";

/**
 * História da marca: a Mel real, que deu origem à rede. A foto aparece pequena
 * (o original tem 239×287 px) e sem filtro nos dois temas.
 */
export function BrandStory() {
  return (
    <section aria-labelledby="historia" className="overflow-hidden rounded-card border border-border/70 bg-surface-warm p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <figure className="relative shrink-0">
          <Image
            src="/brand/mel-origem.webp"
            alt="Mel, uma Yorkshire de pelo dourado e orelhas em pé"
            width={96}
            height={115}
            className="h-[115px] w-24 rounded-lg object-cover object-top ring-1 ring-border"
          />
          <span className="absolute -right-2 -bottom-2 rounded-[23%] shadow-sm">
            <MelMark size={32} className="block" />
          </span>
          <figcaption className="sr-only">A Mel, que deu origem à MEL.</figcaption>
        </figure>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-caption font-semibold tracking-[.06em] text-link uppercase">Nossa origem</p>
          <h2 id="historia" className="text-lg font-bold">
            Começou por uma Mel. Agora é por todos eles.
          </h2>
        </div>
      </div>
      <p className="mt-4 text-text-secondary">
        A MEL nasceu da busca por uma Yorkshire chamada Mel. Quando ela desapareceu, as informações ficaram espalhadas
        entre grupos, cartazes e redes sociais, e quem queria ajudar não conseguia se conectar. A MEL reúne tudo em um só
        lugar, para que nenhum animal precise ser procurado sozinho.
      </p>
    </section>
  );
}
