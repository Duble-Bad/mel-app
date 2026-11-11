import Link from "next/link";
import { connection } from "next/server";
import { Clock, Heart, MapPin, PawPrint } from "lucide-react";
import { ageLabel, SIZE_LABELS, type PublicAdoption } from "@mel/core";
import { listAdoptions } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { AdoptionCarousel } from "./AdoptionCarousel";

/** Até 8 anúncios reais de adoção (já revisados pela moderação) num carrossel, ou um convite para a fila. */
export async function AdoptionPreview() {
  await connection();
  let items: PublicAdoption[] = [];
  try {
    items = (await listAdoptions(createPublicClient(), { pageSize: 8 })).items;
  } catch (error) {
    console.error("[home] prévia de adoção falhou", error);
  }
  if (items.length === 0) return <QueueInvite />;
  return <AdoptionCarousel items={items.map((a) => <AdoptionMiniCard key={a.code} a={a} />)} labels={items.map((a) => a.name)} />;
}

function AdoptionMiniCard({ a }: { a: PublicAdoption }) {
  const second = [ageLabel(a.ageMonths), a.size && `Porte ${SIZE_LABELS[a.size].label.toLowerCase()}`].filter(Boolean).join(" · ");
  return (
    // Só a borda com o feixe dourado (home.css: .mh-glow__border), visível no card do centro do carrossel.
    <article className="mh-pet relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface">
      <span aria-hidden="true" className="mh-glow__border" />
      <div className="relative aspect-[4/3.3] overflow-hidden bg-surface-muted">
        {a.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto reduzida no envio
          <img src={a.photoUrls[0]} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-text-muted">
            <PawPrint aria-hidden="true" className="size-10" strokeWidth={1.5} />
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-extrabold tracking-[.06em] text-primary-foreground uppercase">
          {a.status === "IN_PROCESS" ? "Em processo" : "Adoção"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3.5 pb-4">
        <h3 className="flex items-center gap-1.5 text-xl font-extrabold">
          <span className="truncate">{a.name}</span>
          {a.sex === "female" && (
            <span aria-label="fêmea" className="text-[#f472b6]">
              ♀
            </span>
          )}
          {a.sex === "male" && (
            <span aria-label="macho" className="text-[#60a5fa]">
              ♂
            </span>
          )}
        </h3>
        {a.areaLabel && (
          <p className="flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
            <span className="truncate">{a.areaLabel}</span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Clock aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
          {second}
        </p>
        <Link
          href={`/adocao/${a.code}`}
          className="mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 font-bold text-primary-foreground shadow-primary transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[.98]"
        >
          Ver detalhes<span className="sr-only"> de {a.name}</span>
        </Link>
      </div>
    </article>
  );
}

/** Sem anúncios agora: a fila de interesse continua valendo. */
function QueueInvite() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-primary/50 bg-primary-soft/30 p-7">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Heart aria-hidden="true" className="size-6" strokeWidth={2} />
      </span>
      <h3 className="text-xl font-extrabold">Nenhum animal disponível neste momento</h3>
      <p className="text-text-secondary">
        Cadastre o que você procura e seja avisado quando chegar alguém compatível. Os anúncios aparecem aqui assim que a moderação aprovar.
      </p>
    </div>
  );
}
