// MEL Design System 1.0 — fonte única dos tokens visuais.
// Componentes usam as classes Tailwind geradas a partir de tokens.css
// (ex.: bg-brand-primary, text-status-lost). Este objeto existe para quem
// não usa CSS — cartazes/Open Graph, pinos do mapa e o futuro app Expo.
// tokens.test.ts garante que este arquivo e tokens.css não divergem e que
// os pares de texto/fundo atingem WCAG AA.

export const colors = {
  // Paleta MEL Coral (escala completa).
  "primary-50": "#fff4f1",
  "primary-100": "#ffe4de",
  "primary-200": "#ffc9be",
  "primary-300": "#ffa596",
  "primary-400": "#ff7968",
  "primary-500": "#f45d4c",
  "primary-600": "#df493a",
  "primary-700": "#bb382d",
  "primary-800": "#9b322a",
  "primary-900": "#812f29",

  // MEL Ink: títulos, navegação, superfícies escuras.
  "ink-900": "#101720",
  "ink-800": "#18212f",
  "ink-700": "#263445",
  "ink-600": "#405066",

  // MEL Teal: conexão, positivo (com moderação).
  "teal-50": "#e8f7f4",
  "teal-100": "#bfe9e2",
  "teal-300": "#65c5b7",
  "teal-500": "#2a9d8f",
  "teal-700": "#217d72",

  // Papéis da marca.
  // brand-accent = coral #F45D4C (marca, ícones, indicadores, gradiente).
  // brand-primary = coral profundo para AÇÃO com texto branco: o coral 500
  // com texto branco tem contraste 3,2:1 (reprova WCAG AA); o 700 tem 5,6:1.
  "brand-accent": "#f45d4c",
  "brand-primary": "#bb382d",
  "brand-primary-hover": "#9b322a",
  "brand-on-primary": "#ffffff",
  "brand-secondary": "#fff4f1",
  "brand-on-secondary": "#9b322a",

  // Status. *-accent = cor viva do Design System (pinos, pontos, ícones, bordas);
  // status-* = versão AA para texto e preenchimento com texto branco.
  "status-lost-accent": "#e5484d",
  "status-lost": "#c22a31",
  "status-lost-soft": "#fff1f1",
  "status-found-accent": "#1f9d72",
  "status-found": "#13774f",
  "status-found-soft": "#ecfdf5",
  "status-sighting-accent": "#e9a23b",
  "status-sighting": "#9a5b00",
  "status-sighting-soft": "#fff8e8",
  "status-adoption-accent": "#8b5cf6",
  "status-adoption": "#6d3fd6",
  "status-adoption-soft": "#f5f1ff",
  "status-info-accent": "#3b82f6",
  "status-info": "#1f5fd1",
  "status-info-soft": "#eff6ff",

  success: "#16a36a",
  warning: "#d99018",
  danger: "#d92d20",
  info: "#3b82f6",

  background: "#fafaf8",
  surface: "#ffffff",
  "surface-muted": "#f6f5f2",
  "surface-warm": "#fff8f5",
  border: "#e9e7e2",
  "border-strong": "#d9d6cf",
  "border-input": "#e1dfda",

  "text-primary": "#18212f",
  "text-secondary": "#667085",
  "text-muted": "#98a2b3",
  "text-inverse": "#ffffff",

  focus: "#f45d4c",
} as const;

export type ColorToken = keyof typeof colors;

export const radii = {
  sm: "10px",
  md: "14px",
  lg: "18px",
  card: "20px",
  hero: "28px",
  pill: "999px",
} as const;

export const shadows = {
  xs: "0 1px 2px rgba(16,24,40,.04)",
  sm: "0 2px 8px rgba(16,24,40,.06)",
  md: "0 8px 24px rgba(16,24,40,.08)",
  lg: "0 16px 40px rgba(16,24,40,.10)",
} as const;

export const motion = {
  fast: "120ms",
  normal: "200ms",
  slow: "320ms",
  easing: "cubic-bezier(.2,.8,.2,1)",
} as const;

export const gradients = {
  hero: "linear-gradient(135deg, #f45d4c 0%, #ff7867 52%, #ff9a83 100%)",
  soft: "linear-gradient(180deg, #fff8f5 0%, #fafaf8 100%)",
} as const;
