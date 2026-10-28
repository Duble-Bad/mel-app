import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors } from "./tokens";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const cssVars = Object.fromEntries(
  [...css.matchAll(/--mel-([a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]),
);

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
  it("tokens.css and tokens.ts define exactly the same colors", () => {
    expect(cssVars).toEqual(colors);
  });

  it.each([
    ["text-primary", "background"],
    ["text-secondary", "background"],
    ["text-secondary", "surface"],
    ["brand-on-primary", "brand-primary"],
    ["brand-on-secondary", "brand-secondary"],
    ["text-inverse", "status-lost"],
    ["text-inverse", "status-found"],
    ["text-inverse", "status-sighting"],
    ["text-inverse", "status-adoption"],
    ["status-lost", "status-lost-soft"],
    ["status-found", "status-found-soft"],
    ["status-sighting", "status-sighting-soft"],
    ["status-adoption", "status-adoption-soft"],
  ] as const)("%s on %s meets WCAG AA (4.5:1)", (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
