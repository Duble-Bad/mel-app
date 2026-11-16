import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/States";

// O gerador antigo de cartaz saiu (decisão do proprietário, 2026-11-16): só os modelos do "Criar
// cartaz". Endereços antigos levam ao fluxo novo. A capa e o enquadramento da foto ficaram na
// página do alerta (área do tutor).
export default function PosterPage({ params }: PageProps<"/alerta/[code]/cartaz">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo o cartaz…" />}>
      {params.then(({ code }) => {
        redirect(`/alerta/${code}/cartaz/criar`);
      })}
    </Suspense>
  );
}
