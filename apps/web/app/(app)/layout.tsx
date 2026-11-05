import { AppHeader } from "@/components/layout/AppHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

/** Telas do app: com cabeçalho e rodapé. Telas de tela cheia (ex.: /entrar) ficam fora deste grupo. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      {children}
      <SiteFooter />
    </>
  );
}
