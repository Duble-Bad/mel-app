import type { ReactNode } from "react";
import { TERMS_VERSION } from "@mel/core";

export const CONTACT_EMAIL = "rede.mel.pets@outlook.com";

/** Página de texto legal: largura de leitura, seções numeradas, versão vigente no topo. */
export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-[var(--mel-page-gutter)] pt-8 pb-16">
      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-sm text-text-secondary">Versão de {TERMS_VERSION.split("-").reverse().join("/")}</p>
          <p className="text-lg">{intro}</p>
        </header>
        {children}
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}
