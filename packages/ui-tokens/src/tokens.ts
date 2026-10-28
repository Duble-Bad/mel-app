// Fonte única das cores da MEL.
// Componentes usam as classes Tailwind geradas a partir de tokens.css
// (ex.: bg-brand-primary, text-status-lost). Este objeto existe para quem
// não usa CSS — geração de cartazes/Open Graph e o futuro app Expo.
// tokens.test.ts garante que este arquivo e tokens.css não divergem.

export const colors = {
  "brand-primary": "#8a4510",
  "brand-primary-hover": "#6f370c",
  "brand-on-primary": "#ffffff",
  "brand-secondary": "#f6e7d2",
  "brand-on-secondary": "#4a2508",

  "status-lost": "#b42d22",
  "status-lost-soft": "#fbe9e7",
  "status-found": "#23704a",
  "status-found-soft": "#e5f3eb",
  "status-sighting": "#8a5a00",
  "status-sighting-soft": "#fdf1d6",
  "status-adoption": "#a6305f",
  "status-adoption-soft": "#fae8ef",

  success: "#23704a",
  warning: "#8a5a00",
  danger: "#b42318",
  info: "#1f5f99",

  background: "#fbf8f4",
  surface: "#ffffff",
  "surface-muted": "#f3ede6",
  border: "#e3d9ce",
  "border-strong": "#b9ab9c",

  "text-primary": "#1f1a16",
  "text-secondary": "#5a5048",
  "text-inverse": "#ffffff",

  focus: "#1f5f99",
} as const;

export type ColorToken = keyof typeof colors;

export const radii = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  full: "9999px",
} as const;
