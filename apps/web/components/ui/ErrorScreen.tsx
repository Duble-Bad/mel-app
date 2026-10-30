"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { MelLogo } from "@/components/brand/MelLogo";
import { Button, ButtonLink } from "@/components/ui/Button";

/**
 * Tela de quando uma página não pôde ser carregada (error.tsx). Nunca mostra
 * o erro em si (mensagem, código, stack): só explica, oferece "Tentar
 * novamente" e um caminho seguro. O erro original vai para o console (e, no
 * servidor, para o log — `digest` liga os dois).
 */
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function ErrorScreen({ error, retry, withLogo = false }: { error: unknown; retry: () => void; withLogo?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const offline = !useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    console.error("[MEL] a página não pôde ser carregada", error);
  }, [error]);

  useEffect(() => {
    heading.current?.focus();
    // Voltou a conexão: tenta de novo sozinho.
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [retry]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-10 pb-10">
      {withLogo && (
        <Link href="/" aria-label="MEL — início" className="-ml-1 mb-2 inline-flex self-start rounded-md p-1">
          <MelLogo size={30} />
        </Link>
      )}
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
        {offline ? "Você está sem internet" : "Não conseguimos carregar esta página"}
      </h1>
      <p className="text-text-secondary" aria-live="polite">
        {offline
          ? "Confira sua conexão. Assim que ela voltar, tentamos de novo sozinhos."
          : "Pode ser uma instabilidade passageira. Tente de novo em instantes."}
      </p>
      <div className="mt-2 flex flex-col gap-3">
        <Button onClick={() => retry()}>Tentar novamente</Button>
        <ButtonLink href="/" variant="secondary">
          Voltar para o início
        </ButtonLink>
      </div>
    </main>
  );
}
