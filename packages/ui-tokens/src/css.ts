import { gradients, motion, palette, radii, shadows, themes, type ThemeName } from "./tokens";

const vars = (entries: Record<string, string>, indent: string) =>
  Object.entries(entries)
    .map(([k, v]) => `${indent}--mel-${k}: ${v};`)
    .join("\n");

const themeBlock = (name: ThemeName, indent: string) =>
  [
    `${indent}color-scheme: ${name};`,
    vars(themes[name], indent),
    vars(Object.fromEntries(Object.entries(shadows[name]).map(([k, v]) => [`shadow-${k}`, v])), indent),
  ].join("\n");

/** Conteúdo de tokens.css, gerado a partir de tokens.ts. */
export function renderTokensCss(): string {
  return `/*
 * MEL Design System 1.1 — ARQUIVO GERADO de tokens.ts. Não edite à mão:
 * rode \`npm run tokens -w @mel/ui-tokens\`.
 *
 * Tema: <html data-theme="light|dark"> (aplicado antes da pintura pelo app).
 * Sem o atributo (ex.: sem JavaScript), segue prefers-color-scheme.
 */
:root {
${vars(palette, "  ")}

${themeBlock("light", "  ")}

${vars(Object.fromEntries(Object.entries(radii).map(([k, v]) => [`radius-${k}`, v])), "  ")}

${vars(Object.fromEntries(Object.entries(motion).map(([k, v]) => [k === "easing" ? "easing" : `duration-${k}`, v])), "  ")}

  --mel-gradient-honey: ${gradients.honey};
  --mel-gradient-soft: linear-gradient(180deg, var(--mel-surface-warm) 0%, var(--mel-background) 100%);

  --mel-page-gutter: 20px;
}

:root[data-theme="dark"] {
${themeBlock("dark", "  ")}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${themeBlock("dark", "    ")}
  }
}

@media (max-width: 359px) {
  :root {
    --mel-page-gutter: 16px;
  }
}
`;
}
