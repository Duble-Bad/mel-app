"use client";

import { NetworkStory as Story, type StoryStep } from "@/components/home/NetworkStory";
import { SectionHead } from "./shared";

const STEPS: StoryStep[] = [
  { tone: "lost", tag: "Perdi", title: "O alerta sai em 2 minutos", text: "Foto, nome e o ponto onde o pet sumiu. O pino entra no mapa e o radar começa a varrer a vizinhança." },
  { tone: "brand", tag: "A rede acorda", title: "312 Guardiões avisados, em ondas", text: "Quem está mais perto recebe primeiro. O aviso se espalha como um pulso, quarteirão por quarteirão." },
  { tone: "sighting", tag: "Avistamentos", title: "Cada foto vira uma pista", text: "Quem vê o pet registra o avistamento, mesmo sem conta. Os pontos se ligam e desenham o caminho." },
  { tone: "found", tag: "Reencontro", title: "O caminho de volta para casa", text: "O contato acontece pelo chat seguro da MEL. O endereço nunca aparece, e a história termina em abraço." },
];

/**
 * 2. "A rede se ativando": a mesma seção que o site usa em "Como funciona"
 * (components/home/NetworkStory), aqui com o contador fictício de Guardiões.
 */
export function NetworkStory() {
  return (
    <section id="rede" aria-labelledby="cm-rede-title" className="cm-section">
      <div className="mel-container mb-7">
        <SectionHead
          id="cm-rede-title"
          index="01"
          kicker="A rede se ativando"
          title={<>Do susto ao reencontro, em quatro movimentos.</>}
          lead="Role devagar: a própria rolagem conduz a história. Cada ponto dourado é um Guardião que recebeu o alerta."
        />
      </div>
      <Story steps={STEPS} guardians={312} caption="Raio do alerta: 2 km" />
    </section>
  );
}
