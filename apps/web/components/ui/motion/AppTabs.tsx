"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import "./app-tabs.css";

export interface AppTab {
  id: string;
  label: string;
  /**
   * Nome curto, mostrado só no estilo "orb" (onde todas as abas mostram o nome e o espaço é de uma
   * aba). O nome completo continua sendo o nome acessível do link, escondido só da vista.
   */
  shortLabel?: string;
  icon: ReactNode;
  /** Com `href` a aba é um link (navegação); sem ele, um botão que chama `onSelect`. */
  href?: string;
}

/**
 * - "expand": "Aba que se abre". Só a aba atual mostra o nome, por extenso, numa pílula dourada; as
 *   outras ficam só com o ícone (o nome continua no link, escondido só da vista).
 * - "orb": "Círculo dourado". Um círculo dourado elevado viaja até a aba atual e a barra abre um
 *   recorte para ele; todas as abas mostram o nome.
 * - "auto": o estilo que a pessoa escolheu (atributo data-tabbar no <html>, aplicado antes da
 *   primeira pintura). A marcação é a mesma nos dois estilos; quem escolhe é o CSS (app-tabs.css).
 */
export type AppTabsVariant = "auto" | "expand" | "orb";

/**
 * Barra de abas do aplicativo nos dois estilos aprovados. O componente só marca a aba atual
 * (`aria-current`) e escreve o índice dela em `--i`; o movimento é todo CSS (transições de
 * `transform`, e de largura das abas no estilo "expand"), desligado com "reduzir movimento".
 * `active` que não corresponde a nenhuma aba (tela fora das seções): nenhuma fica marcada.
 */
export function AppTabs({ label, tabs, active, onSelect, variant = "auto" }: { label: string; tabs: readonly AppTab[]; active: string; onSelect?: (id: string) => void; variant?: AppTabsVariant }) {
  const index = tabs.findIndex((t) => t.id === active);
  return (
    <nav aria-label={label} className="mel-tabs" data-variant={variant}>
      <div className="mel-tabs__bar" data-none={index < 0} style={{ "--i": Math.max(index, 0), "--n": tabs.length } as CSSProperties}>
        {/* Só do estilo "orb": o fundo com o recorte e o círculo. No "expand" ficam ocultos pelo CSS. */}
        <span className="mel-tabs__notch" aria-hidden="true">
          <span />
        </span>
        <span className="mel-tabs__orb" aria-hidden="true">
          <span />
        </span>
        {tabs.map((tab, i) => {
          const current = i === index;
          const content = (
            <>
              <span className="mel-tabs__icon" aria-hidden="true">
                {tab.icon}
              </span>
              {tab.shortLabel ? (
                <span className="mel-tabs__label">
                  <span className="mel-tabs__full">{tab.label}</span>
                  <span className="mel-tabs__short" aria-hidden="true">
                    {tab.shortLabel}
                  </span>
                </span>
              ) : (
                <span className="mel-tabs__label">{tab.label}</span>
              )}
            </>
          );
          return tab.href ? (
            <Link key={tab.id} href={tab.href} aria-current={current ? "page" : undefined} className="mel-tabs__tab" onClick={() => onSelect?.(tab.id)}>
              {content}
            </Link>
          ) : (
            <button key={tab.id} type="button" aria-current={current ? "page" : undefined} className="mel-tabs__tab" onClick={() => onSelect?.(tab.id)}>
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
