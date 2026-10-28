// MEL Design System 1.1 — fonte única dos tokens visuais.
// Paletas fixas + tokens SEMÂNTICOS por tema (light/dark). Componentes usam só
// os semânticos via Tailwind (bg-primary, text-foreground, bg-status-lost-soft…).
// tokens.css é GERADO deste arquivo (`npm run tokens -w @mel/ui-tokens`);
// tokens.test.ts confere a paridade e o contraste WCAG AA de cada tema.

/** Paletas de marca (não mudam com o tema). */
export const palette = {
  // MEL Honey Gold: pelagem dourada/caramelo da Mel. Cor da marca: 500.
  "honey-50": "#fff9ec",
  "honey-100": "#fff0c7",
  "honey-200": "#f9dc91",
  "honey-300": "#efc15d",
  "honey-400": "#dfa33b",
  "honey-500": "#c88924",
  "honey-600": "#a96d18",
  "honey-700": "#875215",
  "honey-800": "#6d4218",
  "honey-900": "#593719",
  "honey-950": "#321c0b",

  // MEL Ink: contraponto sofisticado.
  "ink-950": "#0c1117",
  "ink-900": "#111923",
  "ink-800": "#18212f",
  "ink-700": "#263445",
  "ink-600": "#405066",

  // Coral: apoio emocional (urgência moderada, ilustrações, afeto). Nunca CTA padrão.
  "coral-50": "#fff4f1",
  "coral-100": "#ffe4de",
  "coral-200": "#ffc9be",
  "coral-300": "#ffa596",
  "coral-400": "#ff7968",
  "coral-500": "#f45d4c",
  "coral-600": "#df493a",
  "coral-700": "#bb382d",

  // Teal: conexão, com moderação.
  "teal-50": "#e8f7f4",
  "teal-300": "#65c5b7",
  "teal-500": "#2a9d8f",
  "teal-700": "#217d72",

  // Cores vivas de status (pinos, pontos, ícones): legíveis nos dois temas.
  "status-lost-accent": "#e5484d",
  "status-found-accent": "#1f9d72",
  "status-sighting-accent": "#e9a23b",
  "status-adoption-accent": "#8b5cf6",
  "status-info-accent": "#3b82f6",
} as const;

const light = {
  background: "#fbfaf7",
  surface: "#ffffff",
  "surface-muted": "#f7f4ee",
  "surface-elevated": "#ffffff",
  "surface-warm": "#fff9f0",
  input: "#ffffff",
  border: "#e8e3d9",
  "border-strong": "#d8d1c4",
  "border-input": "#e1dbd0",

  "text-primary": "#18212f",
  "text-secondary": "#667085",
  "text-muted": "#98a2b3",
  "text-inverse": "#ffffff",

  // CTA: honey-600 com branco tem 4,3:1 (reprova AA); honey-700 tem 6,5:1.
  primary: "#875215",
  "primary-hover": "#6d4218",
  "primary-foreground": "#ffffff",
  "primary-soft": "#fff0c7",
  "primary-soft-foreground": "#6d4218",
  link: "#875215",
  // Marca (símbolo, ícones de destaque, ilustração).
  brand: "#c88924",
  "brand-soft": "#fff9ec",
  "brand-ring": "#f9dc91",
  focus: "#a96d18",
  // Mel Beacon (símbolo da empresa): ladrilho Honey + símbolo Ink.
  "beacon-tile": "#c88924",
  "beacon-glyph": "#111923",
  "beacon-ring": "#c88924",

  "inverse-surface": "#18212f",
  "inverse-foreground": "#ffffff",

  // status-* = texto; *-soft = fundo; *-solid = preenchimento com texto branco.
  "status-lost": "#c22a31",
  "status-lost-soft": "#fff1f1",
  "status-lost-solid": "#c22a31",
  "status-found": "#13774f",
  "status-found-soft": "#ecfdf5",
  "status-found-solid": "#13774f",
  "status-sighting": "#9a5b00",
  "status-sighting-soft": "#fff8e8",
  "status-sighting-solid": "#9a5b00",
  "status-adoption": "#6d3fd6",
  "status-adoption-soft": "#f5f1ff",
  "status-adoption-solid": "#6d3fd6",
  "status-info": "#1f5fd1",
  "status-info-soft": "#eff6ff",
  "status-info-solid": "#1f5fd1",

  danger: "#d92d20",
  "danger-solid": "#d92d20",
  success: "#13774f",
  warning: "#9a5b00",
  info: "#1f5fd1",
} as const;

export type SemanticToken = keyof typeof light;

// Escuro quente: superfícies Ink, dourado mais luminoso, texto de status claro.
const dark: Record<SemanticToken, string> = {
  background: "#0d1117",
  surface: "#151b23",
  "surface-muted": "#1b222c",
  "surface-elevated": "#202833",
  "surface-warm": "#111923",
  input: "#1b222c",
  border: "#29313d",
  "border-strong": "#384250",
  "border-input": "#333c49",

  "text-primary": "#f7f4ee",
  "text-secondary": "#b8c0cc",
  "text-muted": "#858f9e",
  "text-inverse": "#ffffff",

  primary: "#dfa33b",
  "primary-hover": "#efc15d",
  "primary-foreground": "#15100a",
  "primary-soft": "#342711",
  "primary-soft-foreground": "#efc15d",
  link: "#efc15d",
  brand: "#dfa33b",
  "brand-soft": "#1d1a14",
  "brand-ring": "#3a2e17",
  focus: "#dfa33b",
  // Escuro: ladrilho Ink com contorno sutil + símbolo Honey luminoso.
  "beacon-tile": "#111923",
  "beacon-glyph": "#dfa33b",
  "beacon-ring": "#384250",

  "inverse-surface": "#2a3340",
  "inverse-foreground": "#f7f4ee",

  "status-lost": "#ff8f8f",
  "status-lost-soft": "#3b1d20",
  "status-lost-solid": "#c22a31",
  "status-found": "#4fd1a0",
  "status-found-soft": "#0f2e22",
  "status-found-solid": "#13774f",
  "status-sighting": "#f2c063",
  "status-sighting-soft": "#3a2a0e",
  "status-sighting-solid": "#9a5b00",
  "status-adoption": "#b9a2ff",
  "status-adoption-soft": "#261d45",
  "status-adoption-solid": "#6d3fd6",
  "status-info": "#8db8ff",
  "status-info-soft": "#15253f",
  "status-info-solid": "#1f5fd1",

  danger: "#ff8f8f",
  "danger-solid": "#d92d20",
  success: "#4fd1a0",
  warning: "#f2c063",
  info: "#8db8ff",
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;

/**
 * Cores para quem não usa CSS (cartazes, pinos do mapa, Expo): paletas +
 * tema claro. Cartazes são sempre claros (impressão e prévia de link).
 */
export const colors = { ...palette, ...light } as const;
export type ColorToken = keyof typeof colors;

export const radii = {
  sm: "10px",
  md: "14px",
  lg: "18px",
  card: "20px",
  hero: "28px",
  pill: "999px",
} as const;

// No escuro, elevação vem de superfície/borda; sombras discretas.
export const shadows: Record<ThemeName, Record<"xs" | "sm" | "md" | "lg" | "primary", string>> = {
  light: {
    xs: "0 1px 2px rgba(16, 24, 40, 0.04)",
    sm: "0 2px 8px rgba(16, 24, 40, 0.06)",
    md: "0 8px 24px rgba(16, 24, 40, 0.08)",
    lg: "0 16px 40px rgba(16, 24, 40, 0.1)",
    primary: "0 1px 2px rgba(109, 66, 24, 0.2)",
  },
  dark: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.3)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.35)",
    md: "0 8px 24px rgba(0, 0, 0, 0.35)",
    lg: "0 16px 40px rgba(0, 0, 0, 0.45)",
    // Brilho dourado quase imperceptível (nunca neon).
    primary: "0 0 0 1px rgba(239, 193, 93, 0.25), 0 8px 30px rgba(223, 163, 59, 0.1)",
  },
};

export const motion = {
  fast: "120ms",
  normal: "200ms",
  slow: "320ms",
  theme: "220ms",
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

export const gradients = {
  // Raro: hero especial, momento de sucesso, detalhes premium. Nunca em botões comuns.
  honey: "linear-gradient(135deg, #a96d18 0%, #c88924 48%, #efc15d 100%)",
} as const;
