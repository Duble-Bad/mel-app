import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BottomBarCompare } from "@/components/dev/barra-inferior/BottomBarCompare";

export const metadata: Metadata = { title: "Barra inferior: opções (interno)", robots: { index: false, follow: false } };

/**
 * Página INTERNA (MEL_DEV_ROUTES=1, nunca em produção): seis opções de barra inferior para o
 * celular, lado a lado, todas funcionando. A barra real do site (AppTabBar) não muda aqui.
 */
export default function DevBottomBarPage() {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  return (
    <main className="mel-container flex flex-1 flex-col gap-10 py-10">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-[13px] font-extrabold tracking-[.12em] text-primary uppercase">Interno · comparação</p>
        <h1 className="text-[clamp(28px,4vw,40px)] leading-[1.1] font-extrabold tracking-[-0.02em]">Barra inferior do celular: seis opções</h1>
        <p className="text-lg text-text-secondary">
          Toque nas abas de cada moldura para ver o movimento e role o mural por trás para ver como a barra se comporta sobre o conteúdo. As cinco seções são as do site; o
          mural é fictício. A opção 1 é a barra que está no ar hoje.
        </p>
      </header>
      <BottomBarCompare />
    </main>
  );
}
