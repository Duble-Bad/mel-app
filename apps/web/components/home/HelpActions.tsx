import Link from "next/link";
import { ChevronRight, Eye, Heart, PawPrint, TriangleAlert, type LucideIcon } from "lucide-react";

type Tone = "lost" | "found" | "sighting" | "adoption";

interface HelpAction {
  label: string;
  hint: string;
  Icon: LucideIcon;
  tone: Tone;
  href: string;
  /** Destaque com brilho e feixe na borda (home.css: .mh-glow). */
  glow?: boolean;
}

const ACTIONS: HelpAction[] = [
  { label: "Perdi meu pet", hint: "Divulgue agora e mobilize sua região.", Icon: TriangleAlert, tone: "lost", href: "/publicar/perdido" },
  { label: "Encontrei um pet", hint: "Ajude a reunir o animal à sua família.", Icon: PawPrint, tone: "found", href: "/publicar/encontrado" },
  { label: "Vi um pet", hint: "Registre um avistamento de forma segura.", Icon: Eye, tone: "sighting", href: "/publicar/encontrado?vi=1" },
  { label: "Quero adotar", hint: "Conheça os animais e cadastre seu interesse.", Icon: Heart, tone: "adoption", href: "/adocao", glow: true },
];

// Cor viva de cada caminho (a mesma dos pinos do mapa e dos selos do mural).
const accent: Record<Tone, string> = {
  lost: "var(--color-status-lost-accent)",
  found: "var(--color-status-found-accent)",
  sighting: "var(--color-status-sighting-accent)",
  adoption: "var(--color-status-adoption-accent)",
};

/** As quatro ações da MEL. Celular: 2×2 compacto (cabe na 1ª tela); desktop: 4 lado a lado. */
export function HelpActions() {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      {ACTIONS.map(({ label, hint, Icon, tone, href, glow }, i) => (
        <li key={label} className="animate-enter" style={{ animationDelay: `${120 + i * 70}ms` }}>
          <Link
            href={href}
            style={{ "--c": accent[tone], "--glow": accent[tone] } as React.CSSProperties}
            className={`mel-action ${glow ? "mh-glow" : ""} group relative flex h-full flex-col overflow-hidden rounded-card border-[1.5px] p-3.5 text-text-primary transition-[transform,box-shadow,border-color] duration-300 ease-mel hover:-translate-y-1.5 focus-visible:-translate-y-1.5 active:scale-[.98] sm:min-h-27 sm:p-4.5 lg:min-h-49 lg:p-5.5`}
          >
            {glow && <span aria-hidden="true" className="mh-glow__border" />}
            <PawPrint aria-hidden="true" className="absolute -top-2 -right-2 size-20 rotate-12 text-text-primary opacity-[.06]" strokeWidth={1.5} />
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full text-white shadow-md sm:size-12"
              style={{ background: "var(--c)" }}
            >
              <Icon className="size-5 sm:size-6" strokeWidth={2.25} />
            </span>
            <span className="mt-2.5 text-[17px] leading-[1.1] font-extrabold tracking-[-0.01em] sm:text-xl lg:mt-3.5 lg:text-[22px]">{label}</span>
            <span className="mt-1 flex items-end lg:mt-1.5 justify-between gap-2">
              <span className="text-[13px] leading-snug text-text-primary/85 sm:text-sm">{hint}</span>
              <span
                aria-hidden="true"
                className="hidden size-9 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-300 ease-mel group-hover:translate-x-1 sm:flex"
                style={{ background: "var(--c)" }}
              >
                <ChevronRight className="size-4" strokeWidth={2.5} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
