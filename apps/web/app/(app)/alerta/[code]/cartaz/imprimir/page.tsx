import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintOnLoad } from "@/components/lost/PrintOnLoad";
import { LoadingState } from "@/components/ui/States";
import { isV2Format } from "@/lib/poster/PosterV2";

// Versão para IMPRIMIR do cartaz escolhido no "Criar cartaz": só o PNG, em página inteira (A4 sem margens).
// Repassa apenas os parâmetros conhecidos do gerador; nada é gravado.
export const metadata: Metadata = { title: "Imprimir cartaz", robots: { index: false, follow: false } };

const PASS = ["estilo", "fotos", "foco", "zoom"] as const;

export default function PrintPosterPage({ params, searchParams }: PageProps<"/alerta/[code]/cartaz/imprimir">) {
  return (
    <Suspense fallback={<LoadingState label="Preparando a impressão…" />}>
      {Promise.all([params, searchParams]).then(([{ code }, q]) => (
        <Print code={code} q={q} />
      ))}
    </Suspense>
  );
}

function Print({ code, q }: { code: string; q: Record<string, string | string[] | undefined> }) {
  const formato = typeof q.formato === "string" ? q.formato : "impressao";
  if (!/^[a-z2-9]{6}$/i.test(code) || !isV2Format(formato)) notFound();
  const pass = new URLSearchParams({ modelo: "proposta" });
  for (const k of PASS) if (typeof q[k] === "string") pass.set(k, q[k] as string);
  const src = `/alerta/${code}/cartaz/${formato}?${pass.toString()}`;
  return (
    <div className="print-poster flex flex-col items-center gap-4 p-4">
      <style>{`
        @page { size: ${formato === "impressao" ? "A4" : "auto"}; margin: 0; }
        @media print {
          header, footer, nav, .no-print { display: none !important; }
          .print-poster { padding: 0 !important; }
          .print-poster img { width: 100% !important; max-width: none !important; height: auto; }
        }
      `}</style>
      <PrintOnLoad src={src} />
    </div>
  );
}
