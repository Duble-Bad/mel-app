import "server-only";
import { connection } from "next/server";
import { Eye, Heart, MapPin, Megaphone, PawPrint, Users, type LucideIcon } from "lucide-react";
import { timeAgo, type PublicKind } from "@mel/core";
import type { CSSProperties } from "react";
import { getTotals, type Totals } from "./NetworkStats";
import { mapCases } from "./RegionPreview";

const KIND: Record<PublicKind, { label: string; Icon: LucideIcon; dot: string }> = {
  lost: { label: "Perdido", Icon: Megaphone, dot: "bg-status-lost-solid text-white" },
  found: { label: "Encontrado", Icon: PawPrint, dot: "bg-status-found-solid text-white" },
  sighting: { label: "Visto", Icon: Eye, dot: "bg-status-sighting-solid text-white" },
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

interface Chip {
  pos: "a" | "b" | "c";
  Icon: LucideIcon;
  dot: string;
  title: string;
  text: string;
}

/**
 * Cartões flutuantes do radar do topo, com dados REAIS e atuais: o caso público mais recente e a
 * quantidade de casos no mapa (a mesma consulta do mapa e do mural da home, dividida na requisição
 * pelo `cache` do React) e um total da rede (mesmo cache de horas da faixa de números). Um cartão
 * sem dado não aparece; se nada carregar, o radar fica só com o vídeo.
 */
export async function HeroLiveChips() {
  await connection();
  const [cases, totals] = await Promise.all([
    mapCases(),
    getTotals().catch((error): Totals | null => {
      console.error("[home] totais do radar indisponíveis", error);
      return null;
    }),
  ]);

  const chips: Chip[] = [];
  const latest = cases?.items.length ? [...cases.items].sort((a, b) => b.at.localeCompare(a.at))[0] : undefined;
  if (latest) {
    const k = KIND[latest.kind];
    chips.push({ pos: "a", Icon: k.Icon, dot: k.dot, title: `${k.label} ${timeAgo(latest.at, new Date())}`, text: latest.areaLabel ?? "Área aproximada" });
  }
  if (cases && cases.total > 0) {
    chips.push({
      pos: "c",
      Icon: MapPin,
      dot: "bg-primary text-primary-foreground",
      title: `${fmt(cases.total)} ${cases.total === 1 ? "caso ativo" : "casos ativos"}`,
      text: "no mapa agora",
    });
  }
  if (totals && totals.reunions > 0) {
    chips.push({
      pos: "b",
      Icon: Heart,
      dot: "bg-status-found-solid text-white",
      title: `${fmt(totals.reunions)} ${totals.reunions === 1 ? "reencontro" : "reencontros"}`,
      text: totals.reunions === 1 ? "pet de volta para casa" : "pets de volta para casa",
    });
  } else if (totals && totals.people > 0) {
    chips.push({
      pos: "b",
      Icon: Users,
      dot: "bg-status-found-solid text-white",
      title: `${fmt(totals.people)} ${totals.people === 1 ? "pessoa" : "pessoas"}`,
      text: "já fazem parte da rede",
    });
  }
  if (chips.length === 0) return null;

  return (
    <ul aria-label="Agora na rede MEL" className="mh-chips">
      {chips.map(({ pos, Icon, dot, title, text }, i) => (
        <li key={pos} className={`mh-chip-pos mh-chip-${pos}`}>
          <span className="mh-chip" style={{ "--d": `${0.9 + i * 0.2}s`, "--f": `${-i * 1.6}s` } as CSSProperties}>
            <span className={`mh-chip-dot ${dot}`} aria-hidden="true">
              <Icon size={14} strokeWidth={2.25} />
            </span>
            <span>
              <b>{title}</b>
              <small>{text}</small>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
