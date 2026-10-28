import type { Metadata } from "next";
import { Suspense } from "react";
import { FoundWizard } from "@/components/found/FoundWizard";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Encontrei um pet", robots: { index: false } };

/** Sem conta obrigatória: a sessão anônima é criada ao publicar. `?vi=1` = "Vi um pet solto". */
export default function FoundPage({ searchParams }: PageProps<"/publicar/encontrado">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <Suspense fallback={<LoadingState />}>
        {searchParams.then((q) => (
          <FoundWizard sawOnly={q.vi === "1"} />
        ))}
      </Suspense>
    </main>
  );
}
