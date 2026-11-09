import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/States";

// O protótipo do editor virou o passo "Personalizar" do fluxo "Criar cartaz".
export default function PosterEditorPage({ params }: PageProps<"/alerta/[code]/cartaz/editor">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo…" />}>
      {params.then(({ code }) => {
        redirect(`/alerta/${code}/cartaz/criar`);
      })}
    </Suspense>
  );
}
