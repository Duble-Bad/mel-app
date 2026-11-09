import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { POSTER_FORMATS } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { LoadingState } from "@/components/ui/States";
import { V2_FORMATS, type PosterV2Format } from "@/lib/poster/PosterV2";

// COMPARAÇÃO INTERNA das propostas de cartaz (avaliação do proprietário). Só existe com
// MEL_DEV_ROUTES=1 (conferido na requisição), não tem link no app e não é indexada.
// Os cartazes atuais continuam valendo: aqui só se compara.
export const metadata: Metadata = { title: "Comparação de cartazes", robots: { index: false, follow: false } };

const ORDER: PosterV2Format[] = ["impressao", "square", "portrait", "story", "landscape"];

/** Versão anterior de cada formato (modelo atual). O A4 atual é uma página para imprimir, não imagem. */
const BEFORE: Record<PosterV2Format, { path: string; kind: "image" | "page"; size: string }> = {
  impressao: { path: "a4", kind: "page", size: "folha A4 (página HTML para imprimir)" },
  square: { path: "square", kind: "image", size: `${POSTER_FORMATS.square.width}×${POSTER_FORMATS.square.height}` },
  portrait: { path: "portrait", kind: "image", size: `${POSTER_FORMATS.portrait.width}×${POSTER_FORMATS.portrait.height}` },
  story: { path: "story", kind: "image", size: `${POSTER_FORMATS.story.width}×${POSTER_FORMATS.story.height}` },
  landscape: { path: "landscape", kind: "image", size: `${POSTER_FORMATS.landscape.width}×${POSTER_FORMATS.landscape.height}` },
};

/** O que mudou em cada formato (resumo para a avaliação). */
const CHANGES: Record<PosterV2Format, string[]> = {
  impressao: [
    "Passa a ser imagem PNG em 200 dpi (1654×2339), além da página para imprimir.",
    "Fundo branco (economiza tinta); faixa PROCURA-SE no topo.",
    "Foto principal alta (64% da largura) e até duas complementares em coluna.",
    "Data com horário aproximado; QR grande com “Escaneie e avise” e código do alerta.",
  ],
  square: [
    "Faixa PROCURA-SE no topo, fora da foto (antes o selo ficava sobre a imagem).",
    "Foto ocupa ~56% do cartaz; recorte que não corta rosto, orelhas nem laço.",
    "Nome, região, data e chamada logo abaixo; QR à direita.",
  ],
  portrait: [
    "Formato do feed do Instagram (4:5), foto ocupando ~59% do cartaz.",
    "Complementares em coluna, proporcionais; bloco inferior sem textos espremidos.",
  ],
  story: [
    "Respeita as áreas seguras dos apps: nada essencial no topo (~250 px) nem na base (~220 px).",
    "Foto principal alta com complementares em coluna; QR e código do alerta visíveis.",
  ],
  landscape: [
    "Agora 1200×630 (antes 1920×1080): tamanho de prévia de link.",
    "Só a foto principal (miniaturas não ajudam nesse tamanho); nome grande e texto enxuto.",
  ],
};

export default function PosterComparisonPage({ params, searchParams }: PageProps<"/alerta/[code]/cartaz/propostas">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Preparando a comparação…" />}>
        {Promise.all([params, searchParams]).then(([{ code }, q]) => (
          <Comparison code={code} fotos={typeof q.fotos === "string" ? q.fotos : null} foco={typeof q.foco === "string" ? q.foco : null} />
        ))}
      </Suspense>
    </main>
  );
}

async function Comparison({ code, fotos, foco }: { code: string; fotos: string | null; foco: string | null }) {
  if (process.env.MEL_DEV_ROUTES !== "1") notFound();
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const c = await getPublicLostCase(createPublicClient(), code);
  if (!c || c.status === "CLOSED") notFound();
  const base = `/alerta/${c.code}/cartaz`;
  const photos = c.pet.photos;
  const v = photos.map((p) => `${p.isPrimary ? 1 : 0}${p.focus ? `${p.focus.x}.${p.focus.y}` : "a"}`).join("-").slice(0, 60) || "0";
  const active = fotos && /^\d(,\d){0,2}$/.test(fotos) ? fotos : null;
  // foco=x,y: simulação do enquadramento do tutor na foto principal (não grava nada).
  const focus = foco && /^\d{1,3},\d{1,3}$/.test(foco) ? foco : null;
  const q = `modelo=proposta&v=${v}${active ? `&fotos=${active}` : ""}${focus ? `&foco=${focus}` : ""}`;
  // Combinações para os testes: cada foto sozinha e cada foto como principal com as duas seguintes.
  const combos: { label: string; value: string | null }[] = [{ label: "Capa e ordem do cadastro", value: null }];
  photos.forEach((_, i) => combos.push({ label: `Só a foto ${i + 1}`, value: String(i) }));
  if (photos.length > 2) photos.forEach((_, i) => combos.push({ label: `Foto ${i + 1} principal + 2`, value: [i, (i + 1) % photos.length, (i + 2) % photos.length].join(",") }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="self-start rounded-md bg-[#f6b928] px-2 py-0.5 text-sm font-bold text-[#0a111d]">AMBIENTE DE TESTE — DEV · avaliação interna, não divulgar</p>
        <Link href={base} className="text-sm font-semibold text-link underline-offset-4 hover:underline">
          ‹ Cartazes atuais (continuam valendo)
        </Link>
        <h1 className="text-2xl font-bold">Cartazes de {c.pet.name}: versão anterior × proposta</h1>
        <p className="text-text-secondary">
          Dados e fotos reais do alerta <strong>{c.code.toUpperCase()}</strong>. Cada formato abaixo pode ser visto em tamanho real e baixado. As fotos de teste mudam só as propostas.
        </p>
        <nav className="flex flex-wrap gap-2" aria-label="Combinação de fotos">
          {combos.map((o) => (
            <a
              key={o.label}
              href={o.value ? `?fotos=${o.value}` : "?"}
              aria-current={o.value === active ? "true" : undefined}
              className={`min-h-10 rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${o.value === active ? "border-[#f6b928]" : "border-border"}`}
            >
              {o.label}
            </a>
          ))}
        </nav>
      </div>

      {ORDER.map((f) => {
        const meta = V2_FORMATS[f];
        const before = BEFORE[f];
        const after = `${base}/${f}?${q}`;
        return (
          <section key={f} aria-labelledby={`fmt-${f}`} className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card" data-testid={`comparacao-${f}`}>
            <div>
              <h2 id={`fmt-${f}`} className="text-xl font-bold">
                {meta.label}
              </h2>
              <p className="text-sm text-text-secondary">{meta.hint}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <figure className="flex flex-col gap-2">
                <figcaption className="text-sm font-semibold">
                  Versão anterior <span className="font-normal text-text-secondary">· {before.size}</span>
                </figcaption>
                {before.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem gerada sob demanda
                  <img src={`${base}/${before.path}?v=${v}`} alt={`Versão anterior ${meta.label}`} loading="lazy" className={`w-full rounded-md border border-border ${f === "story" ? "mx-auto max-w-64" : ""}`} />
                ) : (
                  // O app proíbe ser incorporado (frame-ancestors 'none'): o A4 atual abre em nova aba.
                  <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong p-4 text-center text-sm text-text-secondary">
                    O A4 atual é uma página para imprimir (não uma imagem).
                    <a href={`${base}/${before.path}`} target="_blank" className="font-semibold text-link underline-offset-4 hover:underline">
                      Abrir versão anterior em nova aba
                    </a>
                  </div>
                )}
                <a href={`${base}/${before.path}${before.kind === "image" ? `?v=${v}` : ""}`} target="_blank" className="text-sm font-semibold text-link underline-offset-4 hover:underline">
                  Ver em tamanho real
                </a>
              </figure>
              <figure className="flex flex-col gap-2">
                <figcaption className="text-sm font-semibold">
                  Proposta <span className="font-normal text-text-secondary">· {meta.width}×{meta.height} PNG</span>
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada sob demanda */}
                <img src={after} alt={`Proposta ${meta.label}`} loading="lazy" width={meta.width} height={meta.height} className={`w-full rounded-md border border-border ${f === "story" ? "mx-auto max-w-64" : f === "impressao" || f === "portrait" ? "mx-auto max-w-sm" : ""}`} />
                <details className="text-sm">
                  <summary className="min-h-10 cursor-pointer py-2 font-semibold text-link">Ver na largura de um celular (360 px)</summary>
                  {/* eslint-disable-next-line @next/next/no-img-element -- mesma imagem, na largura de uma tela de celular */}
                  <img src={after} alt={`Proposta ${meta.label} em 360 px`} loading="lazy" style={{ width: 360, maxWidth: "100%" }} className="rounded-md border border-border" />
                </details>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <a href={after} target="_blank" className="text-sm font-semibold text-link underline-offset-4 hover:underline">
                    Ver em tamanho real
                  </a>
                  <a href={`${after}&baixar=1`} download className="text-sm font-semibold text-link underline-offset-4 hover:underline">
                    Baixar proposta
                  </a>
                </div>
              </figure>
            </div>
            <div>
              <h3 className="text-sm font-semibold">O que mudou</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary">
                {CHANGES[f].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
