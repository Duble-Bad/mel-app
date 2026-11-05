import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bell, Heart, Map as MapIcon, MessageCircle, PawPrint, PlayCircle, ShieldCheck, Store, UserPlus } from "lucide-react";
import { Suspense } from "react";
import { BrandStory } from "@/components/brand/BrandStory";
import { HelpActions } from "@/components/home/HelpActions";
import { SystemStatus } from "@/components/home/SystemStatus";

const STEPS = [
  { Icon: PawPrint, title: "Publique em minutos", text: "Foto, onde e quando. O alerta sai pronto para compartilhar, com cartaz e QR Code." },
  { Icon: Bell, title: "A rede se mobiliza", text: "Vizinhos, Guardiões e parceiros da região recebem o aviso e ficam de olho." },
  { Icon: MessageCircle, title: "Pistas chegam até você", text: "Avistamentos aparecem no mapa e a conversa acontece aqui, sem expor seu telefone." },
] as const;

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_75%_35%,color-mix(in_srgb,var(--color-status-found-accent)_14%,transparent),transparent_70%),radial-gradient(40%_50%_at_5%_95%,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent_70%)]"
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-7 pb-10 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-x-10 lg:gap-y-0 lg:pt-14 lg:pb-16">
          <div className="flex flex-col items-start gap-4 lg:gap-6 lg:pt-6">
            <span className="inline-flex animate-enter items-center gap-2 rounded-full border border-primary/50 bg-primary-soft/60 px-3.5 py-1.5 text-sm font-semibold text-text-primary">
              <PawPrint aria-hidden="true" className="size-4 text-primary" strokeWidth={2.5} />
              Rede de Encontro e Adoção de Pets
            </span>
            <h1
              id="hero-title"
              className="animate-enter text-[clamp(34px,9.5vw,64px)] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance"
              style={{ animationDelay: "80ms" }}
            >
              Uma rede inteira procurando{" "}
              <span className="relative inline-block whitespace-nowrap text-primary">
                com você.
                <svg aria-hidden="true" viewBox="0 0 300 30" preserveAspectRatio="none" className="mel-draw absolute -bottom-[0.14em] left-0 h-[0.3em] w-[92%] overflow-visible">
                  <path d="M4 20 C 80 6, 200 4, 296 16" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" style={{ "--len": 320, "--delay": "0.7s" } as React.CSSProperties} />
                </svg>
              </span>
            </h1>
            <p className="max-w-[36ch] animate-enter text-base text-text-secondary sm:text-body-lg lg:text-xl" style={{ animationDelay: "160ms" }}>
              Encontre, divulgue e receba ajuda da comunidade para reencontrar seu pet, informar avistamentos e apoiar adoções responsáveis.
            </p>
            <div className="flex animate-enter flex-wrap gap-3" style={{ animationDelay: "220ms" }}>
              <Link
                href="/entrar?criar=1"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-primary transition-[background-color,transform] duration-200 hover:bg-primary-hover active:scale-[.97]"
              >
                <UserPlus aria-hidden="true" className="size-5" strokeWidth={2.25} />
                Criar conta gratuitamente
              </Link>
              <a
                href="#como-funciona"
                className="hidden min-h-12 items-center gap-2 rounded-full border border-border-strong px-6 font-bold text-text-primary transition-colors hover:bg-surface-muted sm:inline-flex"
              >
                <PlayCircle aria-hidden="true" className="size-5" strokeWidth={2} />
                Como funciona
              </a>
            </div>
          </div>

          {/* Celular: as ações vêm antes da foto (são a prioridade). Desktop: foto ao lado do texto. */}
          <div className="order-3 lg:order-none lg:row-span-1">
            <HeroPhoto />
          </div>

          <section aria-labelledby="como-ajudar" className="order-2 lg:order-none lg:col-span-2 lg:mt-10">
            <h2 id="como-ajudar" className="mb-3 text-sm font-bold tracking-[.06em] text-text-secondary uppercase lg:sr-only">
              Como podemos ajudar?
            </h2>
            <HelpActions />
          </section>
        </div>
      </section>

      <section id="como-funciona" aria-labelledby="cf-title" className="scroll-mt-20 border-t border-border bg-surface-warm">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 lg:py-20">
          <p className="text-sm font-bold tracking-[.08em] text-primary uppercase">Como funciona</p>
          <h2 id="cf-title" className="mt-2 max-w-xl text-3xl font-extrabold tracking-[-0.025em] lg:text-4xl">
            Ninguém precisa procurar sozinho.
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li key={title} className="relative rounded-card border border-border bg-surface p-6">
                <span className="absolute top-5 right-6 text-5xl font-extrabold text-text-primary/[.06]" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  <Icon aria-hidden="true" className="size-6" strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-1.5 text-text-secondary">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-label="Explore a rede" className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-14 md:grid-cols-2 lg:grid-cols-3 lg:py-20">
        <Teaser
          href="/mapa"
          Icon={MapIcon}
          title="Mapa da rede MEL"
          text="Veja perdidos, encontrados e avistamentos perto de você. A localização é sempre aproximada, para proteger os tutores."
          cta="Abrir o mapa"
        />
        <Teaser
          href="/adocao"
          Icon={Heart}
          title="Adoção responsável"
          text="Animais de ONGs e protetores, revisados pela moderação. Conheça quem procura um lar."
          cta="Ver animais"
        />
        <Teaser
          href="/parceiros"
          Icon={Store}
          title="Parceiros da rede"
          text="Clínicas, ONGs e protetores que ajudam animais a voltarem para casa. Sem venda dentro da MEL."
          cta="Conhecer o programa"
        />
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-14 lg:grid lg:grid-cols-2 lg:items-start lg:pb-20">
        <Link
          href="/guardiao"
          className="group flex items-start gap-4 rounded-card border border-primary/40 bg-primary-soft/40 p-6 transition-colors hover:border-primary"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={2} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-xl font-bold">Seja um Guardião MEL</span>
            <span className="text-text-secondary">Receba um aviso quando um pet se perder perto de você. Leva 1 minuto.</span>
            <span className="mt-2 inline-flex items-center gap-1 font-semibold text-link">
              Ativar alertas próximos{" "}
              <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={2} />
            </span>
          </span>
        </Link>
        <BrandStory />
      </div>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Informações legais" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/termos" className="inline-flex min-h-11 items-center font-semibold hover:text-text-primary hover:underline">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="inline-flex min-h-11 items-center font-semibold hover:text-text-primary hover:underline">
              Política de privacidade
            </Link>
            <Link href="/nossa-origem" className="inline-flex min-h-11 items-center font-semibold hover:text-text-primary hover:underline">
              Nossa origem
            </Link>
          </nav>
          <Suspense fallback={<p>Verificando conexão…</p>}>
            <SystemStatus />
          </Suspense>
        </div>
      </footer>
    </main>
  );
}

/** Foto do topo com a fita dourada e o coração desenhado (animações desligam com "reduzir movimento"). */
function HeroPhoto() {
  return (
    <div className="relative mx-auto w-full max-w-xl animate-enter lg:max-w-none" style={{ animationDelay: "120ms" }}>
      <svg aria-hidden="true" viewBox="0 0 400 500" className="mel-draw pointer-events-none absolute top-[8%] -right-[10%] -z-0 h-[95%] w-[60%] text-primary">
        <path
          d="M380 10 C 300 160, 420 260, 240 340 S 120 470, 20 490"
          fill="none"
          stroke="currentColor"
          strokeWidth="44"
          strokeLinecap="round"
          opacity=".9"
          style={{ "--len": 720, "--delay": "0.5s" } as React.CSSProperties}
        />
      </svg>
      <Image
        src="/fotos/mel-e-gatinho.webp"
        alt="A Mel, uma Yorkshire com laço amarelo, abraçada a um gatinho tigrado"
        width={1600}
        height={901}
        priority
        sizes="(min-width: 1024px) 560px, 100vw"
        className="relative aspect-[16/11] w-full rounded-hero object-cover object-[62%_35%] shadow-lg lg:aspect-auto lg:h-[480px]"
      />
      <svg aria-hidden="true" viewBox="0 0 100 100" className="mel-draw mel-float absolute -top-4 -left-3 size-16 text-primary sm:size-20">
        <path
          d="M50 84 C 18 60, 8 40, 22 26 C 34 14, 48 24, 50 36 C 54 22, 70 12, 80 26 C 94 44, 74 64, 50 84"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ "--len": 300, "--delay": "1s" } as React.CSSProperties}
        />
      </svg>
      <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-lg border border-border-strong/70 bg-background/85 py-2.5 pr-4 pl-3 shadow-md backdrop-blur-md">
        <span aria-hidden="true" className="mel-live size-2.5 rounded-full bg-status-found-accent" />
        <span className="text-sm">
          <strong className="block font-bold">Avistamentos em tempo real</strong>
          <span className="text-text-secondary">chegam direto para o tutor</span>
        </span>
      </div>
    </div>
  );
}

function Teaser({ href, Icon, title, text, cta }: { href: string; Icon: typeof MapIcon; title: string; text: string; cta: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-card border border-border bg-surface p-6 transition-[transform,border-color,box-shadow] duration-300 ease-mel hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg"
    >
      <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
        <Icon aria-hidden="true" className="size-6" strokeWidth={2} />
      </span>
      <span className="text-xl font-bold">{title}</span>
      <span className="text-text-secondary">{text}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-2 font-semibold text-link">
        {cta} <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={2} />
      </span>
    </Link>
  );
}
