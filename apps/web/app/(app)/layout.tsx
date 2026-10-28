import { AppHeader } from "@/components/layout/AppHeader";

/** Telas do app: com cabeçalho. Telas de tela cheia (ex.: /entrar) ficam fora deste grupo. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
