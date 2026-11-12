import Link from "next/link";
import { Suspense } from "react";
import { MelLogo } from "@/components/brand/MelLogo";
import { SystemStatus } from "@/components/home/SystemStatus";

// Nomes diferentes dos cartões de ação da home ("Perdi meu pet"…): os testes
// e leitores de tela procuram esses links pelo nome, e cada um deve ser único.
const COLUMNS = [
  {
    title: "Ajudar agora",
    links: [
      { href: "/publicar/perdido", label: "Publicar pet perdido" },
      { href: "/publicar/encontrado", label: "Avisar pet encontrado" },
      { href: "/publicar/encontrado?vi=1", label: "Registrar avistamento" },
      { href: "/adocao", label: "Pets para adoção" },
    ],
  },
  {
    title: "A rede",
    links: [
      { href: "/mapa", label: "Mapa da Rede" },
      { href: "/mural", label: "Mural" },
      { href: "/parceiros", label: "Parceiros" },
      { href: "/nossa-origem", label: "Nossa origem" },
    ],
  },
  {
    title: "Confiança",
    links: [
      { href: "/privacidade", label: "Política de privacidade" },
      { href: "/termos", label: "Termos de uso" },
      { href: "/privacidade", label: "Como protegemos seus dados" },
    ],
  },
] as const;

/** Rodapé de todas as telas do app (Conceito B). */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border text-text-secondary">
      <div className="mel-container pt-12 pb-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 min-[860px]:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 min-[860px]:col-span-1">
            <MelLogo size={34} />
            <p className="mt-3 max-w-[34ch]">Rede comunitária e gratuita de apoio a animais perdidos, encontrados e disponíveis para adoção.</p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="mb-2 text-[15px] font-bold text-text-primary">{col.title}</p>
              <ul className="grid gap-1">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="inline-flex min-h-11 items-center transition-colors hover:text-text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-5 text-[13.5px]">
          <span>© MEL — feita por voluntários. Sem anúncios, sem venda.</span>
          <Suspense fallback={<p>Verificando conexão…</p>}>
            <SystemStatus />
          </Suspense>
        </div>
      </div>
    </footer>
  );
}
