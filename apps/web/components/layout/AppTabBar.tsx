"use client";

import { Handshake, Heart, House, LayoutGrid, Map as MapIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { SlidingPillTabs, type PillTab } from "@/components/ui/motion/SlidingPillTabs";
import { isActive, NAV_ITEMS } from "./MainNav";

const ICONS: Record<string, React.ReactNode> = {
  "/": <House size={21} strokeWidth={2.1} />,
  "/mapa": <MapIcon size={21} strokeWidth={2.1} />,
  "/mural": <LayoutGrid size={21} strokeWidth={2.1} />,
  "/adocao": <Heart size={21} strokeWidth={2.1} />,
  "/parceiros": <Handshake size={21} strokeWidth={2.1} />,
};

const TABS: PillTab[] = NAV_ITEMS.map((item) => ({ id: item.href, label: item.label, href: item.href, icon: ICONS[item.href] }));

/**
 * Barra de abas do celular (abaixo de lg), como num aplicativo: as mesmas seções do menu
 * principal, com a pílula dourada "Sliding Pill" sob a seção atual. Fica fixa embaixo; some
 * enquanto o teclado está aberto (campo de texto em foco) para não cobrir o que se digita.
 * O espaço que ela ocupa é `--mel-tabbar-h` (globals.css): rodapé, chat, avisos e barras fixas
 * sobem esse tanto. Em telas que não são de nenhuma seção, nenhuma aba fica marcada.
 */
export function AppTabBar() {
  // usePathname depende da URL: com cacheComponents precisa de Suspense. Enquanto isso, a mesma
  // barra aparece sem aba marcada (o espaço e as abas já estão lá, sem pulo de layout).
  return (
    <Suspense
      fallback={
        <div className="mel-apptabbar lg:hidden">
          <SlidingPillTabs label="Seções" tabs={TABS} active="" />
        </div>
      }
    >
      <LiveTabBar />
    </Suspense>
  );
}

function LiveTabBar() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => isActive(pathname, item.href))?.href ?? "";
  // A pílula sai no toque, sem esperar a página nova carregar; quando a rota muda, vale a rota.
  const [tapped, setTapped] = useState<{ on: string; to: string } | null>(null);
  const active = tapped && tapped.on === pathname ? tapped.to : current;
  return (
    <div className="mel-apptabbar lg:hidden">
      <SlidingPillTabs label="Seções" tabs={TABS} active={active} onSelect={(to) => setTapped({ on: pathname, to })} />
    </div>
  );
}
