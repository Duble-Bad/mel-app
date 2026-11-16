import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/States";

// O A4 antigo (HTML) saiu com o gerador antigo (2026-11-16): leva ao "Criar cartaz" já no A4.
export default function PrintPosterPage({ params }: PageProps<"/alerta/[code]/cartaz/a4">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo o cartaz…" />}>
      {params.then(({ code }) => {
        redirect(`/alerta/${code}/cartaz/criar?formato=impressao`);
      })}
    </Suspense>
  );
}
