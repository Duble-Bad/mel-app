import type { Metadata } from "next";
import Link from "next/link";
import { MapPinned, MessageCircle, Share2, X } from "lucide-react";
import { Suspense } from "react";
import { MelLogo } from "@/components/brand/MelLogo";
import { NetworkIllustration } from "@/components/brand/NetworkIllustration";
import { SignInForm } from "@/components/auth/SignInForm";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { Skeleton } from "@/components/ui/Surface";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false },
};

// O que a MEL já faz hoje (nada de promessa de recurso que ainda não existe).
const VALUES = [
  { icon: Share2, text: "Alerta pronto para compartilhar em cerca de 2 minutos" },
  { icon: MapPinned, text: "Avistamentos chegam no mapa, em tempo real" },
  { icon: MessageCircle, text: "Converse com quem ajuda sem mostrar seu telefone" },
] as const;

/**
 * Celular: tela cheia, sem cabeçalho do app. Tablet: cartão de 440px
 * centralizado. Desktop: painel da marca + formulário lado a lado.
 */
export default function SignInPage() {
  return (
    <main className="relative isolate flex flex-1 flex-col overflow-hidden bg-[image:var(--mel-gradient-soft)] sm:items-center sm:justify-center sm:px-6 sm:py-12">
      <Glow />
      <div className="flex w-full flex-1 animate-enter flex-col sm:max-w-[440px] sm:flex-none sm:overflow-hidden sm:rounded-hero sm:border sm:border-border/70 sm:bg-surface sm:shadow-lg lg:grid lg:max-w-[1000px] lg:grid-cols-[1fr_460px]">
        <BrandPanel />

        <div className="flex flex-1 flex-col px-[var(--mel-page-gutter)] pt-[max(12px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))] sm:px-10 sm:pt-8 sm:pb-10 lg:relative lg:justify-center lg:px-12 lg:py-12">
          <div className="flex min-h-12 items-center justify-between lg:absolute lg:top-6 lg:right-8">
            <Link href="/" aria-label="MEL — início" className="-ml-1 rounded-md p-1 lg:hidden">
              <MelLogo size={30} />
            </Link>
            <div className="-mr-2 flex items-center">
              <ThemeSwitcher />
              <Link
                href="/"
                aria-label="Fechar e voltar ao início"
                className="inline-flex size-11 items-center justify-center rounded-md text-text-secondary transition-colors duration-200 hover:bg-surface-muted hover:text-text-primary"
              >
                <X aria-hidden="true" className="size-5" strokeWidth={2} />
              </Link>
            </div>
          </div>

          <NetworkIllustration className="mt-2 lg:hidden" />

          <div className="mt-4 mb-6 flex flex-col gap-1.5 text-center sm:mt-5 sm:mb-7 lg:mt-0 lg:text-left">
            <h1 className="text-3xl font-bold tracking-[-0.025em] text-foreground">Bem-vindo à MEL</h1>
            <p className="text-body-lg text-text-secondary">
              <span className="lg:hidden">Uma rede inteira procurando com você.</span>
              <span className="hidden lg:inline">Entre ou crie sua conta em segundos.</span>
            </p>
          </div>

          <Suspense fallback={<FormSkeleton />}>
            <SessionSignInForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

/** Quem já ajudou sem conta neste aparelho: criar conta mantém as contribuições. */
async function SessionSignInForm() {
  const anonymous = (await getSessionUser())?.isAnonymous === true;
  return <SignInForm anonymous={anonymous} />;
}

/** Desktop: lado da marca, com a ilustração da rede e o que a MEL faz. */
function BrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-surface-warm p-12 lg:flex">
      <div aria-hidden="true" className="absolute -right-24 -bottom-24 size-80 rounded-full bg-primary-soft/70" />
      <Link href="/" aria-label="MEL — início" className="relative -ml-1 self-start rounded-md p-1">
        <MelLogo size={32} />
      </Link>
      <div className="relative flex flex-col gap-8">
        <NetworkIllustration className="mx-0 scale-110 origin-left" />
        <p className="max-w-sm text-3xl leading-[1.2] font-bold tracking-[-0.025em] text-foreground">
          Uma rede inteira procurando com você.
        </p>
        <ul className="flex flex-col gap-4">
          {VALUES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-text-primary">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface text-link shadow-xs">
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-text-secondary">Movimento de Encontro e Localização</p>
    </div>
  );
}

/** Brilhos da marca no fundo (só a partir do tablet, onde há espaço em volta do cartão). */
function Glow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden sm:block">
      <div className="absolute -top-40 -left-32 size-[520px] rounded-full bg-primary-soft/80 blur-3xl" />
      <div className="absolute -right-40 -bottom-48 size-[560px] rounded-full bg-teal-500/8 blur-3xl" />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-5">
      <Skeleton className="h-13 w-full rounded-md" />
      <Skeleton className="h-13 w-full rounded-md" />
      <Skeleton className="h-13 w-full rounded-md" />
    </div>
  );
}
