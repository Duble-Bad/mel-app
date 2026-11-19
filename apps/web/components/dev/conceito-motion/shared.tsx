"use client";

import type { ReactNode } from "react";
import { ForcedReducedMotion, useReducedMotion } from "@/components/ui/motion/useReducedMotion";

export { Magnetic } from "@/components/ui/motion/Magnetic";

/**
 * "Movimento reduzido" do conceito: preferência do sistema OU a chave fixa da página. É o mesmo
 * contexto que os componentes do site consultam, então a chave vale também para eles.
 */
export const ReducedContext = ForcedReducedMotion;
export const useCmReduced = useReducedMotion;

export type CaseStatus = "lost" | "sighting" | "found" | "adoption";

export const STATUS: Record<CaseStatus, { label: string; plural: string; solid: string; text: string; soft: string }> = {
  lost: { label: "Perdido", plural: "Perdidos", solid: "bg-status-lost-solid", text: "text-status-lost", soft: "bg-status-lost-soft" },
  sighting: { label: "Avistado", plural: "Avistados", solid: "bg-status-sighting-solid", text: "text-status-sighting", soft: "bg-status-sighting-soft" },
  found: { label: "Encontrado", plural: "Encontrados", solid: "bg-status-found-solid", text: "text-status-found", soft: "bg-status-found-soft" },
  adoption: { label: "Adoção", plural: "Adoção", solid: "bg-status-adoption-solid", text: "text-status-adoption", soft: "bg-status-adoption-soft" },
};

export type PetPhoto = { src: string; pos: string; zoom?: number; origin?: string };

/** Fotos reais do projeto, com recortes diferentes para render mais de um "pet" fictício. */
export const PHOTOS = {
  mel: { src: "/videos/mel-e-gatinho-poster.webp", pos: "70% 40%" },
  tigrinho: { src: "/videos/mel-e-gatinho-poster.webp", pos: "10% 60%" },
  flor: { src: "/fotos/golden-flor.webp", pos: "50% 36%" },
  pingo: { src: "/404/yorkshire.jpg", pos: "50% 22%" },
  amora: { src: "/fotos/guardiao-escudo.webp", pos: "68% 46%", zoom: 2.5, origin: "72% 44%" },
  thor: { src: "/fotos/guardiao-escudo.webp", pos: "34% 40%", zoom: 2.5, origin: "30% 40%" },
  nina: { src: "/fotos/golden-flor.webp", pos: "50% 34%", zoom: 1.9, origin: "50% 34%" },
  bento: { src: "/videos/mel-e-gatinho-poster.webp", pos: "30% 55%", zoom: 1.5, origin: "36% 52%" },
} satisfies Record<string, PetPhoto>;

export type PetCase = {
  id: string;
  name: string;
  kind: string;
  status: CaseStatus;
  place: string;
  when: string;
  note: string;
  photo: PetPhoto;
  trail: { time: string; text: string }[];
};

/** Casos FICTÍCIOS de demonstração (nomes, bairros e horários inventados). */
export const CASES: PetCase[] = [
  {
    id: "mel", name: "Mel", kind: "Yorkshire · laço amarelo", status: "lost", place: "Vila Madalena", when: "há 2 h",
    note: "Saiu pelo portão durante a entrega. É dócil, atende pelo nome e está com coleira caramelo.",
    photo: PHOTOS.mel,
    trail: [
      { time: "14h32", text: "Vista na Rua Harmonia, perto da praça" },
      { time: "15h10", text: "Guardião a 200 m confirmou a direção" },
      { time: "15h48", text: "Nova foto enviada, sem conta, por quem passava" },
    ],
  },
  {
    id: "tigrinho", name: "Tigrinho", kind: "Gato tigrado · olhos verdes", status: "sighting", place: "Pinheiros", when: "há 18 min",
    note: "Visto em cima do muro de uma casa azul. Parece bem cuidado e assustado com o movimento.",
    photo: PHOTOS.tigrinho,
    trail: [
      { time: "16h02", text: "Avistado na Rua dos Pinheiros" },
      { time: "16h11", text: "Segunda foto, mesmo quarteirão" },
    ],
  },
  {
    id: "flor", name: "Flor", kind: "Golden retriever · filhote", status: "found", place: "Perdizes", when: "ontem",
    note: "Reencontro confirmado pelos dois lados. Ficou 9 horas fora de casa e voltou com a ajuda de 4 avistamentos.",
    photo: PHOTOS.flor,
    trail: [
      { time: "08h20", text: "Alerta enviado a 286 Guardiões" },
      { time: "11h45", text: "Avistada no Parque da Água Branca" },
      { time: "17h05", text: "Reencontro confirmado no chat" },
    ],
  },
  {
    id: "pingo", name: "Pingo", kind: "Yorkshire · 3 anos", status: "adoption", place: "Lapa", when: "há 3 dias",
    note: "Castrado, vacinado e muito companheiro. Procura um lar tranquilo, de preferência com quintal.",
    photo: PHOTOS.pingo,
    trail: [
      { time: "Seg", text: "Anúncio aprovado pela moderação" },
      { time: "Ter", text: "5 pessoas na fila de interesse" },
    ],
  },
  {
    id: "amora", name: "Amora", kind: "Gata laranja e branca", status: "lost", place: "Sumaré", when: "há 5 h",
    note: "Fugiu pela janela do segundo andar. Tímida, costuma se esconder embaixo de carros.",
    photo: PHOTOS.amora,
    trail: [
      { time: "10h15", text: "Alerta enviado a 198 Guardiões" },
      { time: "12h40", text: "Possível avistamento na Rua Capote Valente" },
    ],
  },
  {
    id: "thor", name: "Thor", kind: "Yorkshire · sem coleira", status: "sighting", place: "Butantã", when: "há 41 min",
    note: "Andando sozinho perto da estação. Quem viu ofereceu água e ele ficou por perto.",
    photo: PHOTOS.thor,
    trail: [
      { time: "15h20", text: "Avistado ao lado do ponto de ônibus" },
      { time: "15h39", text: "Guardiã ficou com ele até o tutor responder" },
    ],
  },
  {
    id: "nina", name: "Nina", kind: "Golden · 5 meses", status: "adoption", place: "Pompeia", when: "há 1 semana",
    note: "Resgatada por uma protetora independente. Brincalhona, convive bem com crianças e outros cães.",
    photo: PHOTOS.nina,
    trail: [
      { time: "Qua", text: "Anúncio aprovado pela moderação" },
      { time: "Sex", text: "Visita marcada pelo chat da MEL" },
    ],
  },
  {
    id: "bento", name: "Bento", kind: "Gato tigrado · castrado", status: "found", place: "Vila Mariana", when: "há 2 dias",
    note: "Estava a três quarteirões de casa. O cartaz com QR Code levou a vizinha direto ao chat.",
    photo: PHOTOS.bento,
    trail: [
      { time: "09h00", text: "Cartaz impresso e compartilhado" },
      { time: "13h25", text: "QR Code lido na padaria da esquina" },
      { time: "14h10", text: "Reencontro confirmado no chat" },
    ],
  },
];

/** Cabeçalho de seção: índice, rótulo e título grande. Revela ao rolar (CSS scroll-driven). */
export function SectionHead({ index, kicker, title, lead, id }: { index: string; kicker: string; title: ReactNode; lead?: ReactNode; id: string }) {
  return (
    <header className="cm-head max-w-3xl">
      <p className="cm-kicker">
        <span className="cm-kicker-n">{index}</span>
        <span className="cm-kicker-line" aria-hidden="true" />
        {kicker}
      </p>
      <h2 id={id} className="cm-h2 text-balance">
        {title}
      </h2>
      {lead ? <p className="mt-4 max-w-2xl text-body-lg text-pretty text-text-secondary">{lead}</p> : null}
    </header>
  );
}
