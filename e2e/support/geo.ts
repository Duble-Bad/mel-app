import type { Page } from "@playwright/test";
import reverseFixture from "../../packages/core/src/geo/__fixtures__/maptiler-reverse.json" with { type: "json" };
import searchFixture from "../../packages/core/src/geo/__fixtures__/maptiler-search.json" with { type: "json" };

/** GPS simulado: Praça da Sé (local público). */
export const SE = { latitude: -23.55052, longitude: -46.633308 };

/** Busca de endereço com respostas reais gravadas do MapTiler: sem rede e sem gastar cota. */
export async function mockGeocoding(page: Page, status = 200) {
  await page.route("https://api.maptiler.com/geocoding/**", (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    const isReverse = /\/-?\d+(\.\d+)?,-?\d+(\.\d+)?\.json$/.test(path);
    return route.fulfill({ status, json: status === 200 ? (isReverse ? reverseFixture : searchFixture) : {} });
  });
}
