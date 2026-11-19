import { AppHeader } from "@/components/layout/AppHeader";
import { AppTabBar } from "@/components/layout/AppTabBar";
import { SiteFooter } from "@/components/layout/SiteFooter";

/** Telas do app: com cabeçalho e rodapé. Telas de tela cheia (ex.: /entrar) ficam fora deste grupo. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      {children}
      <SiteFooter />
      {/* Celular: espaço para o fim da página não ficar atrás da barra de abas. */}
      <div aria-hidden="true" className="h-[var(--mel-tabbar-h)] lg:hidden" />
      <AppTabBar />
    </>
  );
}
