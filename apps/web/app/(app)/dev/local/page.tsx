import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocationPickerHarness } from "./Harness";

export const metadata: Metadata = { title: "Teste do seletor de local", robots: { index: false } };

/**
 * Página INTERNA de verificação do LocationPicker (M4), usada pelos testes E2E
 * até o fluxo "Perdi meu pet" (M5) usá-lo de verdade. Só existe quando o build
 * é feito com MEL_DEV_ROUTES=1 — nunca em produção.
 */
export default function DevLocationPage() {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="mb-1 text-2xl font-bold">Onde foi visto pela última vez?</h1>
      <p className="mb-6 text-sm text-text-secondary">Página interna de teste (não aparece para usuários).</p>
      <LocationPickerHarness />
    </main>
  );
}
