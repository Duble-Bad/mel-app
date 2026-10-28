import type { Metadata } from "next";
import { CaseListPage } from "@/components/map/CaseListPage";

export const metadata: Metadata = {
  title: "Pets perdidos perto de você",
  description: "Alertas ativos de pets perdidos na sua região. Viu algum? Avise o tutor pela MEL.",
};

export default function LostListPage({ searchParams }: PageProps<"/perdidos">) {
  return (
    <CaseListPage
      title="Perdidos perto de você"
      intro="Alertas ativos. Se reconhecer algum, toque e envie um avistamento."
      path="/perdidos"
      kinds={["lost"]}
      searchParams={searchParams}
    />
  );
}
