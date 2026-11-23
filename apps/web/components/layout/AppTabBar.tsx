"use client";

import { Handshake, Heart, House, LayoutGrid, Map as MapIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { AppTabs, type AppTab } from "@/components/ui/motion/AppTabs";
import { isActive, NAV_ITEMS } from "./MainNav";

const ICONS: Record<string, React.ReactNode> = {
  "/": <House size={21} strokeWidth={2.1} />,
  "/mapa": <MapIcon size={21} strokeWidth={2.1} />,
  "/mural": <LayoutGrid size={21} strokeWidth={2.1} />,
  "/adocao": <Heart size={21} strokeWidth={2.1} />,
  "/parceiros": <Handshake size={21} strokeWidth={2.1} />,
};

/** Nome curto no estilo "Círculo dourado", onde cada aba tem só a própria largura para o nome. */
const SHORT: Record<string, string> = { "/mapa": "Mapa" };

const TABS: AppTab[] = NAV_ITEMS.map((item) => ({ id: item.href, label: item.label, shortLabel: SHORT[item.href], href: item.href, icon: ICONS[item.href] }));

/**
 * Barra de abas do celular (abaixo de lg), como num aplicativo: as mesmas seções do menu
 * principal. Dois estilos (components/ui/motion/AppTabs): "Aba que se abre" (padrão) e "Círculo
 * dourado", escolhido pela pessoa em Aparência (por aparelho; ver lib/theme/tabbar.ts). A marcação
 * é a mesma nos dois; o CSS escolhe pelo atributo data-tabbar do <html>, posto antes da primeira
 * pintura, então a barra já nasce no estilo certo. Fica fixa embaixo; some enquanto o teclado está
 * aberto (campo de texto em foco) para não cobrir o que se digita. O espaço que ela ocupa é
 * `--mel-tabbar-h` (globals.css): rodapé, chat, avisos e barras fixas sobem esse tanto. Em telas
 * que não são de nenhuma seção, nenhuma aba fica marcada.
 */
export function AppTabBar() {
  // usePathname depende da URL: com cacheComponents precisa de Suspense. Enquanto isso, a mesma
  // barra aparece sem aba marcada (o espaço e as abas já estão lá, sem pulo de layout).
  return (
    <Suspense
      fallback={
        <div className="mel-apptabbar lg:hidden">
          <AppTabs label="Seções" tabs={TABS} active="" />
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
  // O destaque sai no toque, sem esperar a página nova carregar; quando a rota muda, vale a rota.
  const [tapped, setTapped] = useState<{ on: string; to: string } | null>(null);
  // Mudou de rota (inclusive pelo "voltar"): o toque já cumpriu o papel e a rota passa a valer.
  if (tapped && tapped.on !== pathname) setTapped(null);
  const active = tapped ? tapped.to : current;
  return (
    <div className="mel-apptabbar lg:hidden">
      <AppTabs label="Seções" tabs={TABS} active={active} onSelect={(to) => setTapped({ on: pathname, to })} />
    </div>
  );
}
