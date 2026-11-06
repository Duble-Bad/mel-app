"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Início" },
  { href: "/mapa", label: "Mapa da Rede" },
  { href: "/mural", label: "Mural" },
  { href: "/adocao", label: "Adoção" },
  { href: "/parceiros", label: "Parceiros" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegação principal no desktop (sublinhado dourado na seção atual). */
export function DesktopNav() {
  return <DesktopNavList pathname={usePathname()} />;
}

/** Sem pathname (fallback do Suspense durante o prerender): links sem destaque. */
export function DesktopNavList({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Principal" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center px-3.5 font-semibold transition-colors after:absolute after:inset-x-3.5 after:bottom-1 after:h-0.5 after:origin-left after:rounded-full after:bg-primary after:transition-transform after:duration-300 after:ease-mel ${
                  active ? "text-primary after:scale-x-100" : "text-text-secondary after:scale-x-0 hover:text-text-primary hover:after:scale-x-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Menu do celular: abre por cima da página; fecha com Esc, no X ou ao navegar. */
export function MobileNav({ account }: { account?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="menu-celular"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen(!open);
        }}
        className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-surface text-text-primary"
      >
        {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
      </button>
      {/* Portal no <body>: o cabeçalho tem backdrop-filter, que vira o "containing block"
          de qualquer position:fixed dentro dele — o painel ficava preso nos 64 px do
          cabeçalho e só "Início" aparecia. Fica abaixo do cabeçalho, que mantém o X visível. */}
      {open &&
        createPortal(
          <div
            id="menu-celular"
            className="fixed inset-x-0 top-16 z-30 h-[calc(100dvh-4rem)] animate-enter overflow-y-auto overscroll-contain border-t border-border bg-background px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] lg:hidden"
          >
          <nav aria-label="Principal">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-13 items-center rounded-lg px-4 text-lg font-semibold ${
                        active ? "bg-primary-soft text-primary-soft-foreground" : "text-text-primary hover:bg-surface-muted"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {account && <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">{account}</div>}
          </div>,
          document.body,
        )}
    </div>
  );
}
