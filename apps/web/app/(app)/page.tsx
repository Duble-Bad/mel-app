import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CircleCheck,
  HandHeart,
  Heart,
  Megaphone,
  MessageSquare,
  PlayCircle,
  ShieldCheck,
  Store,
  UserPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { BrandStory } from "@/components/brand/BrandStory";
import { AdoptionPreview } from "@/components/home/AdoptionPreview";
import { HeroCinema } from "@/components/home/HeroCinema";
import { HelpActions } from "@/components/home/HelpActions";
import { HomeMotion } from "@/components/home/HomeMotion";
import { NetworkStats } from "@/components/home/NetworkStats";
import { RegionListPanel, RegionMapPanel } from "@/components/home/RegionPreview";
import "../home.css";

const STEPS: { Icon: LucideIcon; title: string; text: string }[] = [
  { Icon: Megaphone, title: "Publique em 2 minutos", text: "Foto, nome e a região onde o pet sumiu. A MEL gera um cartaz com QR Code para imprimir e compartilhar." },
  { Icon: Bell, title: "A vizinhança é avisada", text: "Guardiões da região recebem o alerta. Quem vê o pet registra o avistamento com foto, mesmo sem conta." },
  { Icon: MessageSquare, title: "Chat seguro até o reencontro", text: "O contato acontece pelo chat da MEL. Seu endereço nunca aparece, e o telefone só se você quiser." },
];

const ADOPTION_CHECKS = [
  "Seu contato fica privado. A conversa com quem cuida do animal acontece pelo chat da MEL.",
  "Você cancela o interesse quando quiser, com um toque.",
  "Cada anúncio passa pela moderação antes de aparecer.",
];

const PARTNER_KINDS: { Icon: LucideIcon; title: string; text: string }[] = [
  { Icon: Store, title: "Empresas e serviços pet", text: "Clínicas, pet shops, banho e tosa, hotéis." },
  { Icon: HandHeart, title: "ONGs", text: "Publicam animais para adoção e recebem a fila de interessados." },
  { Icon: UserRound, title: "Protetores independentes", text: "Pessoas que resgatam e cuidam. Cadastro revisado pela moderação." },
];

// Estilos repetidos dos botões em pílula (mesmos do topo).
const btnGold =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-primary transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[.97]";
const btnGhost =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-strong px-6 font-bold text-text-primary transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-surface-muted active:scale-[.97]";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <HomeMotion />
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_75%_35%,color-mix(in_srgb,var(--color-status-found-accent)_14%,transparent),transparent_70%),radial-gradient(40%_50%_at_5%_95%,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent_70%)]"
        />
        <div className="flex mel-container flex-col gap-6 pt-7 pb-10 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-x-10 lg:gap-y-0 lg:pt-14 lg:pb-8">
          <div className="mh-cine-copy relative z-[1] flex flex-col items-start gap-4 lg:min-h-[470px] lg:justify-center lg:gap-6">
            <span className="inline-flex animate-enter items-center gap-2 rounded-full border border-primary/50 bg-primary-soft/60 px-3.5 py-1.5 text-sm font-semibold text-text-primary">
              <PawPrintSmall />
              Rede de Encontro e Adoção de Pets
            </span>
            <h1
              id="hero-title"
              className="animate-enter text-[clamp(34px,9.5vw,64px)] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance"
              style={{ animationDelay: "80ms" }}
            >
              Uma rede inteira procurando{" "}
              <span className="mh-shimmer relative inline-block whitespace-nowrap text-primary">
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
              <Link href="/entrar?criar=1" className={btnGold}>
                <UserPlus aria-hidden="true" className="size-5" strokeWidth={2.25} />
                Criar conta gratuitamente
              </Link>
              <a href="#como-funciona" className={`${btnGhost} max-sm:hidden`}>
                <PlayCircle aria-hidden="true" className="size-5" strokeWidth={2} />
                Como funciona
              </a>
            </div>
          </div>

          {/* Celular: as ações (e os números) vêm antes do vídeo, pois são a prioridade. Desktop: o vídeo é o
              palco à direita, até a borda da tela (posicionado pelo CSS, atrás do texto). */}
          <div className="order-3 lg:order-none lg:contents">
            <HeroCinema />
          </div>

          <section aria-labelledby="como-ajudar" className="order-2 lg:order-none lg:col-span-2 lg:mt-10">
            <h2 id="como-ajudar" className="mb-3 text-sm font-bold tracking-[.06em] text-text-secondary uppercase lg:sr-only">
              Como podemos ajudar?
            </h2>
            <HelpActions />
            <Suspense fallback={null}>
              <NetworkStats />
            </Suspense>
          </section>
        </div>
      </section>

      <section id="como-funciona" aria-labelledby="cf-title" className="scroll-mt-20">
        <div className="mel-container py-16 lg:pt-11 lg:pb-[72px]">
          <SectionHead eyebrow="Como funciona" id="cf-title" title="Do alerta ao reencontro, em três passos">
            Sem custo, sem anúncios. A MEL avisa quem está perto e protege os dados de quem pede ajuda.
          </SectionHead>
          <ol className="grid gap-4 md:grid-cols-3 md:gap-5">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li
                key={title}
                data-reveal
                style={{ "--d": `${i * 0.1}s` } as React.CSSProperties}
                className="mh-step relative rounded-card border border-border bg-surface/70 p-6.5"
              >
                <span aria-hidden="true" className="mb-4.5 block text-[15px] font-extrabold tracking-[.08em] text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <IconTile Icon={Icon} />
                <h3 className="mb-2 text-[21px] leading-[1.1] font-extrabold tracking-[-0.02em]">{title}</h3>
                <p className="text-text-secondary">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="rede-title" className="border-y border-border bg-gradient-to-b from-surface-warm to-background">
        <div className="mel-container py-16 lg:py-[72px]">
          <div data-reveal className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div>
              <Eyebrow>Agora na sua região</Eyebrow>
              <h2 id="rede-title" className={h2Class}>
                Mapa e mural, lado a lado
              </h2>
            </div>
            <Link href="/mapa" className={btnGhost}>
              Abrir o mapa da rede <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2} />
            </Link>
          </div>
          <div className="grid gap-4.5 lg:grid-cols-[1.1fr_1fr]">
            <Panel title="Mapa da rede" href="/mapa" linkLabel="Ver tudo">
              <Suspense fallback={<div className="mh-map min-h-[300px] animate-pulse sm:min-h-[360px]" />}>
                <RegionMapPanel />
              </Suspense>
            </Panel>
            <Panel title="Últimos no mural" href="/mural" linkLabel="Abrir mural" delay="0.1s">
              <Suspense fallback={<ListSkeleton />}>
                <RegionListPanel />
              </Suspense>
            </Panel>
          </div>
        </div>
      </section>

      <section aria-labelledby="ad-title">
        <div className="grid mel-container items-center gap-7 py-16 lg:grid-cols-2 lg:gap-14 lg:py-[72px]">
          <div data-reveal>
            <Eyebrow>Adoção responsável</Eyebrow>
            <h2 id="ad-title" className={h2Class}>
              Ainda não achou seu novo amigo? Entre na fila.
            </h2>
            <p className="mt-3.5 max-w-[58ch] text-lg text-text-secondary">
              Cadastre o que você procura (espécie, porte, idade) mesmo sem animais disponíveis. Quando chegar alguém compatível, a ONG ou o protetor fala com você pela MEL.
            </p>
            <ul className="mt-5 grid gap-3">
              {ADOPTION_CHECKS.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 fill-primary text-primary-foreground" strokeWidth={2.25} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              {/* Nome diferente do cartão "Quero adotar" do topo: cada link com nome único. */}
              <Link href="/adocao/quero-adotar" className={btnGold}>
                <Heart aria-hidden="true" className="size-5" strokeWidth={2.25} />
                Cadastrar meu interesse
              </Link>
              <Link href="/adocao" className={btnGhost}>
                Ver disponíveis
              </Link>
            </div>
          </div>
          <div data-reveal style={{ "--d": "0.1s" } as React.CSSProperties}>
            <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-surface-muted" />}>
              <AdoptionPreview />
            </Suspense>
          </div>
        </div>
      </section>

      <section aria-label="Guardiões e a origem da MEL" className="border-t border-border">
        <div className="grid mel-container gap-4.5 py-16 lg:grid-cols-2 lg:items-stretch lg:py-[72px]">
          <Link
            href="/guardiao"
            data-reveal
            // Card de destaque com brilho e feixe dourado na borda (home.css: .mh-glow).
            className="mh-step mh-glow group flex flex-col gap-5 self-start rounded-card p-6 sm:p-7"
          >
            <span aria-hidden="true" className="mh-glow__border" />
            <span className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-primary">
                <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={2} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-xl font-extrabold">Seja um Guardião MEL</span>
                <span className="text-text-secondary">Receba um aviso quando um pet se perder perto de você. Leva 1 minuto.</span>
              </span>
            </span>
            <span className="mh-glow__cta inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full px-5 font-bold text-primary-foreground">
              Ativar alertas próximos
              <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={2.25} />
            </span>
          </Link>
          <div data-reveal style={{ "--d": "0.1s" } as React.CSSProperties}>
            <BrandStory />
          </div>
        </div>
      </section>

      <section aria-labelledby="pa-title" className="border-y border-border bg-gradient-to-b from-surface-warm to-background">
        <div className="grid mel-container items-center gap-7 py-16 lg:grid-cols-2 lg:gap-14 lg:py-[72px]">
          <div data-reveal>
            <Eyebrow>Parceiros da MEL</Eyebrow>
            <h2 id="pa-title" className={h2Class}>
              Clínicas, ONGs e protetores que ajudam animais a voltar para casa
            </h2>
            <p className="mt-3.5 max-w-[58ch] text-lg text-text-secondary">
              Parceiros são pontos de apoio da rede: recebem animais encontrados, divulgam alertas e orientam tutores. A MEL não vende nada. A parceria é pela causa.
            </p>
            <div className="mt-7">
              <Link href="/parceiros" className={btnGold}>
                Conhecer o programa
              </Link>
            </div>
          </div>
          <ul data-reveal style={{ "--d": "0.1s" } as React.CSSProperties} className="grid gap-4">
            {PARTNER_KINDS.map(({ Icon, title, text }) => (
              <li key={title} className="mh-step relative rounded-card border border-border bg-surface/70 p-6">
                <IconTile Icon={Icon} />
                <h3 className="mb-1.5 pr-14 text-[19px] font-extrabold tracking-[-0.02em]">{title}</h3>
                <p className="pr-14 text-text-secondary">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

const h2Class = "mt-2.5 text-[clamp(30px,4.4vw,46px)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance";

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-extrabold tracking-[.12em] text-primary uppercase">{children}</p>;
}

function SectionHead({ eyebrow, id, title, children }: { eyebrow: string; id: string; title: string; children: ReactNode }) {
  return (
    <div data-reveal className="mb-9">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className={h2Class}>
        {title}
      </h2>
      <p className="mt-3.5 max-w-[58ch] text-lg text-text-secondary">{children}</p>
    </div>
  );
}

function IconTile({ Icon }: { Icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="absolute top-5.5 right-5.5 flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
      <Icon className="size-5.5" strokeWidth={2} />
    </span>
  );
}

function Panel({ title, href, linkLabel, delay, children }: { title: string; href: string; linkLabel: string; delay?: string; children: ReactNode }) {
  return (
    <div data-reveal style={delay ? ({ "--d": delay } as React.CSSProperties) : undefined} className="flex flex-col overflow-hidden rounded-[22px] border border-border bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4.5 py-1.5">
        <h3 className="text-lg font-extrabold">{title}</h3>
        <Link href={href} className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
          {linkLabel}
        </Link>
      </div>
      {/* Os dois painéis têm a mesma altura (grade): a prévia do mapa ocupa o espaço todo. */}
      <div className="flex-1">{children}</div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3.5 border-b border-border px-5 py-3 last:border-b-0">
          <span className="size-16 animate-pulse rounded-xl bg-surface-muted" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-20 animate-pulse rounded-full bg-surface-muted" />
            <span className="h-4 w-32 animate-pulse rounded-full bg-surface-muted" />
          </span>
        </div>
      ))}
    </div>
  );
}

function PawPrintSmall() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 text-primary" fill="currentColor">
      <ellipse cx="5.5" cy="10" rx="2.2" ry="2.8" />
      <ellipse cx="9.5" cy="5.6" rx="2.2" ry="2.9" />
      <ellipse cx="14.5" cy="5.6" rx="2.2" ry="2.9" />
      <ellipse cx="18.5" cy="10" rx="2.2" ry="2.8" />
      <path d="M12 11.2c-3.3 0-6.4 4.3-6.4 6.9 0 1.9 1.4 2.9 3.2 2.9 1.4 0 2.1-.7 3.2-.7s1.8.7 3.2.7c1.8 0 3.2-1 3.2-2.9 0-2.6-3.1-6.9-6.4-6.9z" />
    </svg>
  );
}

