import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Teste da tela de erro", robots: { index: false } };

/**
 * Página INTERNA para o E2E da tela de erro (error.tsx): falha com o texto
 * técnico de RLS enquanto o cookie `mel-dev-erro=1` existir. Só existe com
 * MEL_DEV_ROUTES=1 — nunca em produção.
 */
export default function DevErrorPage() {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={null}>
        <MaybeFail />
      </Suspense>
    </main>
  );
}

async function MaybeFail() {
  if ((await cookies()).get("mel-dev-erro")?.value === "1") {
    throw new Error('new row violates row-level security policy for table "found_cases"');
  }
  return <h1 className="text-2xl font-bold">Página carregada</h1>;
}
