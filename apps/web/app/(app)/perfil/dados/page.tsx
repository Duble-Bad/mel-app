import type { Metadata } from "next";
import { Suspense } from "react";
import { maskPersonalData } from "@mel/core";
import { getMyPersonalData } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { PersonalDataPanel } from "@/components/profile/PersonalData";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Dados pessoais e documentos", robots: { index: false } };

export default function PersonalDataPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <h1 className="mb-1.5 text-2xl font-bold">Dados pessoais e documentos</h1>
      <p className="mb-6 text-text-secondary">Confira e corrija seu e-mail, telefones e documentos. Por segurança, mostramos só parte de cada dado.</p>
      <Suspense fallback={<LoadingState label="Carregando seus dados…" />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await requireOnboardedProfile("/perfil/dados");
  let data;
  try {
    // Valores inteiros só aqui no servidor: o navegador recebe a versão mascarada.
    data = maskPersonalData(await getMyPersonalData(await createSessionClient()));
  } catch (error) {
    console.error("[perfil/dados] falha ao carregar", (error as { code?: string }).code ?? "erro");
    return <ErrorState>Não conseguimos carregar seus dados agora. Atualize a página.</ErrorState>;
  }
  return <PersonalDataPanel data={data} />;
}
