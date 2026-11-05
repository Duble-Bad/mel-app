import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { CaseListPage } from "@/components/map/CaseListPage";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Mural da MEL",
  description: "Pets perdidos, encontrados e vistos soltos na sua região. Reconheceu algum? Avise pela MEL.",
};

/** Mural: perdidos, encontrados e vistos juntos (os tipos viram filtros). Adoção tem página própria. */
export default function MuralPage({ searchParams }: PageProps<"/mural">) {
  return (
    <CaseListPage
      title="Mural da MEL"
      intro="Pets perdidos, encontrados e vistos soltos na sua região. Se reconhecer algum, toque e avise."
      path="/mural"
      aside={
        <ButtonLink href="/adocao" variant="secondary" size="md" className="w-auto">
          <Heart aria-hidden="true" className="size-4" strokeWidth={2} /> Para adoção
        </ButtonLink>
      }
      searchParams={searchParams}
    />
  );
}
