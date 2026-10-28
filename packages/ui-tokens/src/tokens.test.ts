import { describe, expect, it } from "vitest";
import { renderTokensCss } from "./css";
import { palette, themes, type SemanticToken, type ThemeName } from "./tokens";

/** Razão de contraste WCAG 2.x entre duas cores hex. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("design tokens", () => {
  it("tokens.css is generated from tokens.ts (run `npm run tokens -w @mel/ui-tokens` after editing)", async () => {
    await expect(renderTokensCss()).toMatchFileSnapshot("./tokens.css");
  });

  it("both themes define exactly the same semantic tokens", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  const STATUSES = ["lost", "found", "sighting", "adoption", "info"] as const;
  // Texto (4,5:1) — vale para os dois temas.
  const TEXT_PAIRS: [SemanticToken, SemanticToken][] = [
    ["text-primary", "background"],
    ["text-primary", "surface"],
    ["text-primary", "surface-elevated"],
    ["text-primary", "surface-warm"],
    ["text-primary", "input"],
    ["text-secondary", "background"],
    ["text-secondary", "surface"],
    ["text-secondary", "surface-muted"],
    ["text-secondary", "surface-warm"],
    ["primary-foreground", "primary"],
    ["primary-foreground", "primary-hover"],
    ["primary-soft-foreground", "primary-soft"],
    ["link", "surface"],
    ["link", "background"],
    ["inverse-foreground", "inverse-surface"],
    ["text-inverse", "danger-solid"],
    ["danger", "surface"],
    ["danger", "input"],
    ...STATUSES.flatMap((s): [SemanticToken, SemanticToken][] => [
      [`status-${s}`, `status-${s}-soft`],
      [`status-${s}`, "surface"],
      ["text-inverse", `status-${s}-solid`],
    ]),
  ];
  // Não-texto (3:1): anel de foco, contorno de campo em foco.
  const UI_PAIRS: [SemanticToken, SemanticToken][] = [
    ["focus", "surface"],
    ["focus", "background"],
    ["focus", "input"],
    ["beacon-glyph", "beacon-tile"],
  ];

  for (const theme of ["light", "dark"] as ThemeName[]) {
    const t = themes[theme];
    it.each(TEXT_PAIRS)(`[${theme}] %s on %s meets WCAG AA (4.5:1)`, (fg, bg) => {
      expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
    });
    it.each(UI_PAIRS)(`[${theme}] %s on %s meets 3:1 (non-text)`, (fg, bg) => {
      expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
    });
    it(`[${theme}] status pins/icons stand out from the surface (3:1)`, () => {
      for (const s of ["lost", "found", "adoption"] as const) {
        expect(contrast(palette[`status-${s}-accent`], t.surface), s).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
