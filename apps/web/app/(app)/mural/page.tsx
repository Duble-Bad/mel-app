import "@/app/map.css";
import type { Metadata } from "next";
import { MuralFeed } from "@/components/map/MuralFeed";

export const metadata: Metadata = {
  title: "Mural da MEL",
  description: "Pets perdidos, encontrados, vistos soltos e para adoção na sua região. Reconheceu algum? Avise pela MEL.",
};

/** Mural: perdidos, encontrados, vistos e adoção juntos (os tipos viram filtros). */
export default function MuralPage({ searchParams }: PageProps<"/mural">) {
  return <MuralFeed searchParams={searchParams} />;
}
