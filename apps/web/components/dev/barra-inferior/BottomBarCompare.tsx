"use client";

import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Handshake, Heart, House, LayoutGrid, Map as MapIcon, MapPin, Minus, Star } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/MainNav";
import { SlidingPillTabs, type PillTab } from "@/components/ui/motion/SlidingPillTabs";
import "./bottom-bars.css";

const ICONS: Record<string, ReactNode> = {
  "/": <House size={21} strokeWidth={2.1} />,
  "/mapa": <MapIcon size={21} strokeWidth={2.1} />,
  "/mural": <LayoutGrid size={21} strokeWidth={2.1} />,
  "/adocao": <Heart size={21} strokeWidth={2.1} />,
  "/parceiros": <Handshake size={21} strokeWidth={2.1} />,
};

/** As mesmas cinco seções da barra real (NAV_ITEMS), aqui como botões: nada navega nesta página. */
const TABS: PillTab[] = NAV_ITEMS.map((item) => ({ id: item.href, label: item.label, icon: ICONS[item.href] }));

type Variant = "expand" | "orb" | "glass" | "line" | "tag";

interface Option {
  key: "pill" | Variant;
  name: string;
  feel: string;
  pros: string[];
  cons: string[];
  recommended?: string;
}

const OPTIONS: Option[] = [
  {
    key: "pill",
    name: "1. Pílula deslizante (atual)",
    feel: "A barra de hoje: uma pílula dourada que estica no caminho e assenta sob a aba.",
    pros: ["Já está no ar e testada", "Rótulo sempre visível nas cinco abas", "Só transform e largura de um elemento"],
    cons: ["“Mapa da Rede” não cabe: aparece cortado com reticências", "Pílula larga e rótulos pequenos (10,5 px) deixam a barra carregada"],
  },
  {
    key: "expand",
    name: "2. Aba que se abre",
    feel: "Só a aba atual mostra o nome, por extenso; as outras ficam só com o ícone.",
    pros: ["“Mapa da Rede” aparece inteiro, em 13 px", "Barra mais limpa: um rótulo por vez", "Alvos de toque continuam com a altura toda da barra"],
    cons: ["As abas mudam de largura ao trocar (anima layout de 5 itens, custo baixo)", "Quem não conhece os ícones só vê o nome depois de tocar"],
    recommended: "Resolve o problema real da barra (o rótulo comprido) e fica mais elegante e legível; leitor de tela continua lendo os cinco nomes.",
  },
  {
    key: "orb",
    name: "3. Círculo dourado no recorte",
    feel: "Um círculo dourado elevado viaja até a aba, e a barra abre um recorte para ele.",
    pros: ["A mais marcante: cara de aplicativo", "A aba atual fica impossível de não ver"],
    cons: ["Rótulos continuam pequenos e “Mapa da Rede” corta", "O recorte anima uma máscara (repinta a barra a cada quadro)", "O círculo invade 18 px do conteúdo acima da barra"],
  },
  {
    key: "glass",
    name: "4. Cápsula de vidro",
    feel: "Cápsula translúcida com desfoque; uma “lente” dourada desliza sobre a aba.",
    pros: ["Leve e moderna: o conteúdo aparece por trás", "Só transform na lente"],
    cons: ["Desfoque de fundo pesa em celular simples ao rolar", "Contraste depende do que passa por trás (fotos claras)", "“Mapa da Rede” corta"],
  },
  {
    key: "line",
    name: "5. Linha de brilho",
    feel: "Barra encostada na base, sóbria: uma linha dourada com brilho desliza no topo e o ícone se preenche.",
    pros: ["A mais discreta e a mais barata de animar", "Barra de ponta a ponta: mais espaço por aba", "Padrão conhecido (parece nativo)"],
    cons: ["Menos personalidade que as outras", "“Mapa da Rede” ainda fica apertado em telas de 360 px"],
  },
  {
    key: "tag",
    name: "6. Etiqueta flutuante",
    feel: "Barra só de ícones; o nome da aba atual aparece numa etiqueta dourada acima dela.",
    pros: ["“Mapa da Rede” inteiro, sem apertar a barra", "Barra baixa (56 px): sobra tela"],
    cons: ["A etiqueta cobre um pouco do conteúdo acima", "Nome longe do ícone: lê-se em dois lugares", "Só ícones nas abas inativas"],
  },
];

function Bar({ variant }: { variant: Variant }) {
  const [active, setActive] = useState(0);
  return (
    <nav aria-label="Seções (exemplo)" className="bb-nav">
      <div className="bb-bar" data-v={variant} style={{ "--i": active } as CSSProperties}>
        {variant === "orb" && (
          <>
            <span className="bb-notch" aria-hidden="true">
              <span />
            </span>
            <span className="bb-slide bb-orb" aria-hidden="true">
              <span />
            </span>
          </>
        )}
        {variant === "glass" && <span className="bb-lens" aria-hidden="true" />}
        {variant === "line" && (
          <span className="bb-slide bb-line" aria-hidden="true">
            <span />
          </span>
        )}
        {variant === "tag" && (
          <>
            <span className="bb-tag" aria-hidden="true">
              {TABS[active]?.label}
            </span>
            <span className="bb-slide bb-dot" aria-hidden="true">
              <span />
            </span>
          </>
        )}
        {TABS.map((tab, i) => (
          <button key={tab.id} type="button" className="bb-tab" aria-current={i === active ? "page" : undefined} onClick={() => setActive(i)}>
            <span className="bb-icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="bb-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function PillBar() {
  const [active, setActive] = useState("/");
  return (
    <div className="bb-nav bb-nav-pill">
      <SlidingPillTabs label="Seções (exemplo)" tabs={TABS} active={active} onSelect={setActive} />
    </div>
  );
}

const FEED = [
  { name: "Mel", badge: "Perdido", tone: "bg-status-lost-solid", place: "Vila Madalena · há 2 horas", src: "/videos/mel-e-gatinho-poster.webp", pos: "70% 40%" },
  { name: "Flor", badge: "Encontrado", tone: "bg-status-found-solid", place: "Perdizes · ontem", src: "/fotos/golden-flor.webp", pos: "50% 36%" },
  { name: "Pingo", badge: "Adoção", tone: "bg-status-adoption-solid", place: "Lapa · há 3 dias", src: "/404/yorkshire.jpg", pos: "50% 22%" },
];

/** Conteúdo de mentira com cara de mural (fotos do próprio projeto), para a barra ter o que cobrir. */
function FakeScreen() {
  return (
    <div className="bb-screen" aria-hidden="true">
      <p className="text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
        Mural da <span className="text-primary">MEL</span>
      </p>
      <p className="text-sm text-text-secondary">Pets perto de você (exemplo fictício)</p>
      {FEED.map((f) => (
        <div key={f.name} className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="relative h-36">
            <Image src={f.src} alt="" fill sizes="360px" style={{ objectFit: "cover", objectPosition: f.pos }} />
            <span className={`absolute bottom-2 left-2 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-[.06em] text-white uppercase ${f.tone}`}>{f.badge}</span>
          </div>
          <div className="flex flex-col gap-0.5 px-3.5 py-2.5">
            <span className="text-lg font-extrabold">{f.name}</span>
            <span className="flex items-center gap-1 text-[13px] text-text-secondary">
              <MapPin size={14} className="text-primary" />
              {f.place}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Comparação INTERNA de barras inferiores para o celular. Cada opção fica numa moldura de 390 px,
 * sobre um mural fictício que rola, e funciona de verdade (toque nas abas). A opção 1 é o componente
 * real do site; as demais são protótipos em CSS (bottom-bars.css): a aba ativa vira `--i` na barra e
 * os indicadores andam com `transform`. Nada aqui muda a barra real (components/layout/AppTabBar).
 */
export function BottomBarCompare() {
  return (
    <ul className="grid justify-center gap-x-6 gap-y-12 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),380px))]">
      {OPTIONS.map((o) => (
        <li key={o.key} className="flex min-w-0 flex-col gap-3">
          <div className="flex min-h-[92px] flex-col gap-1">
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold tracking-[-0.02em]">
              {o.name}
              {o.recommended && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-extrabold text-primary-foreground">
                  <Star size={12} fill="currentColor" aria-hidden="true" />
                  Recomendado
                </span>
              )}
            </h2>
            <p className="text-sm text-text-secondary">{o.feel}</p>
          </div>

          <div className="bb-frame" data-option={o.key}>
            <FakeScreen />
            {o.key === "pill" ? <PillBar /> : <Bar variant={o.key} />}
          </div>

          {o.recommended && <p className="rounded-lg border border-primary/50 bg-primary-soft/40 p-3 text-sm font-semibold">Por quê: {o.recommended}</p>}
          <ul className="flex flex-col gap-1.5 text-sm">
            {o.pros.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-status-found" aria-hidden="true" />
                <span>
                  <span className="sr-only">A favor: </span>
                  {t}
                </span>
              </li>
            ))}
            {o.cons.map((t) => (
              <li key={t} className="flex items-start gap-2 text-text-secondary">
                <Minus size={16} className="mt-0.5 shrink-0 text-status-lost" aria-hidden="true" />
                <span>
                  <span className="sr-only">Contra: </span>
                  {t}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
