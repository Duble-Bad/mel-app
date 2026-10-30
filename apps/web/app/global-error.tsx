"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Último recurso: falha no próprio layout raiz. Substitui o documento inteiro
 * (por isso tem <html> e <body> e importa o CSS global). Sem detalhes técnicos.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[MEL] falha no layout raiz", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-full flex-col bg-background font-sans text-text-primary antialiased">
        <title>MEL</title>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-10 pb-10">
          <p className="text-xl font-extrabold text-primary">MEL</p>
          <h1 className="text-2xl font-bold">Não conseguimos abrir a MEL agora</h1>
          <p className="text-text-secondary">Pode ser uma instabilidade passageira. Tente de novo em instantes.</p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="min-h-12 w-full rounded-md bg-primary px-5 font-semibold text-primary-foreground"
            >
              Tentar novamente
            </button>
            {/* <a> simples (recarga completa): aqui o roteador do app pode estar quebrado. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="flex min-h-12 w-full items-center justify-center rounded-md border border-border-strong font-semibold">
              Voltar para o início
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
