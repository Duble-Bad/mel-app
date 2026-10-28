import type { Metadata } from "next";
import { CaseListPage } from "@/components/map/CaseListPage";

export const metadata: Metadata = {
  title: "Pets encontrados e vistos soltos",
  description: "Animais encontrados ou vistos soltos na sua região. Reconheceu o seu? Publique um alerta e o Radar MEL avisa quem encontrou.",
};

export default function FoundListPage({ searchParams }: PageProps<"/encontrados">) {
  return (
    <CaseListPage
      title="Encontrados e vistos soltos"
      intro="Animais que alguém encontrou ou viu na rua. Reconheceu o seu? Toque para ver."
      path="/encontrados"
      kinds={["found", "sighting"]}
      searchParams={searchParams}
    />
  );
}
