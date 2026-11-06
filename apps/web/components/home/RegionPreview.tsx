import Link from "next/link";
import { cache } from "react";
import { connection } from "next/server";
import { ChevronRight, MapPin, SearchX, ShieldCheck } from "lucide-react";
import { DEFAULT_CENTER, DEFAULT_CENTER_LABEL, itemHref, itemTitle, timeAgo, type PublicCaseItem, type PublicKind } from "@mel/core";
import { searchPublicCases } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";
import { PetPhoto } from "@/components/ui/PetPhoto";

const KIND: Record<PublicKind, { label: string; color: string }> = {
  lost: { label: "Perdido", color: "var(--color-status-lost-accent)" },
  found: { label: "Encontrado", color: "var(--color-status-found-accent)" },
  sighting: { label: "Visto", color: "var(--color-status-sighting-accent)" },
};

/**
 * Casos públicos (pontos já aproximados pelo banco) mais recentes perto do
 * centro padrão. `cache`: mapa e mural dividem a mesma consulta na requisição.
 */
const latestCases = cache(async (): Promise<PublicCaseItem[] | null> => {
  try {
    const { items } = await searchPublicCases(
      createPublicClient(),
      { kinds: ["lost", "found", "sighting"], species: [], period: "30d", radiusKm: 10, center: DEFAULT_CENTER, hasCenter: false, page: 1 },
      { pageSize: 40 },
    );
    // A busca ordena por distância; aqui interessa o mais novo.
    return items.sort((a, b) => b.at.localeCompare(a.at));
  } catch (error) {
    console.error("[home] prévia da região falhou", error);
    return null;
  }
});

export async function RegionMapPanel() {
  await connection();
  const items = (await latestCases()) ?? [];
  return <MapPreview items={items.slice(0, 7)} />;
}

export async function RegionListPanel() {
  await connection();
  const items = await latestCases();
  if (!items) return <p className="px-5 py-10 text-center text-text-secondary">Não conseguimos carregar agora. Atualize a página em instantes.</p>;
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <SearchX aria-hidden="true" className="size-9 text-text-muted" strokeWidth={1.75} />
        <p className="font-bold">Nenhum caso recente por aqui</p>
        <p className="max-w-[36ch] text-sm text-text-secondary">Isso pode ser uma boa notícia. Quando alguém publicar um perdido, encontrado ou avistamento, ele aparece aqui.</p>
      </div>
    );
  const now = new Date();
  return (
    <ul>
      {items.slice(0, 4).map((item) => {
        const k = KIND[item.kind];
        return (
          <li key={`${item.kind}-${item.code}`} className="border-b border-border last:border-b-0">
            <Link href={itemHref(item)} className="group grid grid-cols-[64px_1fr_auto] items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-muted sm:px-5">
              <span className="size-16 overflow-hidden rounded-xl bg-surface-muted">
                <PetPhoto src={item.photoUrl} alt="" loading="lazy" className="size-full object-cover" iconClassName="size-7" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                {/* Tom escurecido: texto branco legível sobre a cor do status. */}
                <span
                  className="w-fit rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-[.06em] text-white uppercase"
                  style={{ background: `color-mix(in srgb, ${k.color} 78%, black)` }}
                >
                  {k.label}
                </span>
                <strong className="truncate text-[17px]">{itemTitle(item)}</strong>
                <span className="flex items-center gap-1 truncate text-[13px] text-text-secondary">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-primary" strokeWidth={2} />
                  <span className="truncate">
                    {item.areaLabel ?? "Área aproximada"} · {timeAgo(item.at, now)}
                  </span>
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 text-text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const ROADS = (
  <g>
    <path className="mh-map__road mh-map__road--main" strokeWidth="9" d="M-20 140 C 200 120, 380 210, 620 170 S 900 120, 1020 160" />
    <path className="mh-map__road mh-map__road--main" strokeWidth="9" d="M300 -20 C 320 200, 260 380, 330 620 S 360 760, 340 820" />
    <path className="mh-map__road" strokeWidth="5" d="M-20 420 C 240 400, 520 470, 1020 420" />
    <path className="mh-map__road" strokeWidth="5" d="M640 -20 C 600 200, 700 420, 660 820" />
    <path className="mh-map__road" strokeWidth="4" d="M-20 300 L 1020 330 M -20 560 L 1020 590 M 140 -20 L 180 820 M 820 -20 L 860 820 M 460 -20 L 500 820" />
    <path
      className="mh-map__road"
      strokeWidth="2.5"
      d="M-20 80 L1020 60 M-20 220 L1020 250 M-20 500 L1020 520 M-20 680 L1020 700 M60 -20 L 80 820 M230 -20 L 250 820 M390 -20 L 400 820 M560 -20 L 580 820 M740 -20 L 760 820 M920 -20 L 940 820"
    />
  </g>
);

/**
 * Prévia leve do mapa (sem MapLibre e sem requisições ao MapTiler): ruas
 * ilustrativas e as áreas dos casos reais em relação ao centro padrão. Fica
 * identificada como prévia e o cartão inteiro abre o mapa real (/mapa).
 */
function MapPreview({ items }: { items: PublicCaseItem[] }) {
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((DEFAULT_CENTER.lat * Math.PI) / 180);
  const offsets = items.map((i) => ({
    i,
    dx: (i.position.lng - DEFAULT_CENTER.lng) * mPerLng,
    dy: (DEFAULT_CENTER.lat - i.position.lat) * mPerLat,
  }));
  // Escala para caber todos (mínimo de 1,5 km de cada lado), com folga nas bordas.
  const span = Math.max(1500, ...offsets.map((o) => Math.max(Math.abs(o.dx) / 1.15, Math.abs(o.dy) / 0.9)));
  const scale = 400 / span;

  return (
    <Link
      href="/mapa"
      aria-label="Abrir o mapa real da rede MEL (a imagem é só uma prévia ilustrativa)"
      className="mh-map group relative block h-full min-h-[300px] overflow-hidden sm:min-h-[360px]"
    >
      <svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 size-full">
        <path className="mh-map__park" d="M700 460 q 90 -30 160 20 q 30 80 -40 120 q -100 10 -130 -50 z" />
        <path className="mh-map__park" d="M90 600 q 70 -20 120 10 q 10 60 -60 80 q -80 -10 -60 -90z" />
        <path className="mh-map__water" d="M820 -20 q 60 120 200 160 v -180z" />
        {ROADS}
        {offsets.map(({ i, dx, dy }) => {
          const cx = 500 + dx * scale;
          const cy = 400 + dy * scale;
          return (
            <g key={`${i.kind}-${i.code}`} className="mh-area" style={{ "--c": KIND[i.kind].color } as React.CSSProperties}>
              <circle className="zone" cx={cx} cy={cy} r="42" />
              <circle className="pulse" cx={cx} cy={cy} r="42" />
              <circle className="core" cx={cx} cy={cy} r="9" />
            </g>
          );
        })}
        <circle cx="500" cy="400" r="7" fill="var(--color-primary)" />
        <circle cx="500" cy="400" r="16" fill="none" stroke="var(--color-primary)" strokeWidth="2" opacity=".5" />
      </svg>
      <p className="absolute top-3.5 left-3.5 z-[1] flex max-w-[calc(100%-28px)] items-center gap-2 rounded-xl border border-border-strong bg-background/90 px-3 py-2 text-[13px]">
        <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2} />
        Áreas aproximadas (~100 m) para proteger tutores
      </p>
      <p className="absolute bottom-3.5 left-3.5 z-[1] max-w-[calc(100%-190px)] rounded-xl border border-border-strong bg-background/90 px-3 py-2 text-[12.5px] leading-snug text-text-secondary">
        <strong className="text-text-primary">Prévia ilustrativa</strong> (ruas desenhadas) ·{" "}
        {items.length === 0
          ? `nenhum caso recente perto do ${DEFAULT_CENTER_LABEL}`
          : `${items.length === 1 ? "1 caso recente" : `${items.length} casos recentes`} perto do ${DEFAULT_CENTER_LABEL}`}
      </p>
      <span className="absolute right-3.5 bottom-3.5 z-[1] inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-primary transition-transform group-hover:translate-x-0.5">
        Abrir mapa real <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </span>
    </Link>
  );
}
