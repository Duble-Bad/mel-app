import { expect, test } from "@playwright/test";
import { mockGeocoding } from "./support/geo";

// Desempenho e resiliência (2026-11-17, itens 04 e 12 da revisão de desempenho):
// - a busca de endereço espera a pessoa parar de digitar e cancela a requisição anterior;
// - um serviço externo fora do ar vira mensagem de erro em segundos, sem travar a tela.

const search = (page: import("@playwright/test").Page) => page.getByLabel("Ou busque pela rua, pelo CEP ou por um lugar");

test("address search: typing a whole word sends one search at the end, not one per letter", async ({ page }) => {
  await mockGeocoding(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://api.maptiler.com/geocoding/") && !/\/-?\d+(\.\d+)?,-?\d+(\.\d+)?\.json/.test(r.url())) calls.push(r.url());
  });
  await page.goto("/publicar/encontrado?vi=1");
  await page.getByRole("button", { name: "Continuar sem foto" }).click();
  await expect(page.getByRole("heading", { name: "Onde você viu?" })).toBeVisible();
  // 11 letras, uma a cada 80 ms (mais rápido que a espera de 350 ms).
  await search(page).pressSequentially("Praca da Se", { delay: 80 });
  await expect(page.getByRole("list", { name: "Resultados da busca" })).toBeVisible({ timeout: 15_000 });
  // Uma busca só = 2 chamadas (endereços + pontos de interesse), todas com o texto completo.
  expect(calls.length, calls.join("\n")).toBe(2);
  for (const url of calls) expect(decodeURIComponent(url)).toContain("Praca da Se");
});

test("map service down: the search shows a clear error within seconds instead of hanging", async ({ page }) => {
  test.setTimeout(60_000);
  // MapTiler que nunca responde (a requisição fica pendurada).
  await page.route("https://api.maptiler.com/geocoding/**", () => new Promise(() => {}));
  await page.goto("/publicar/encontrado?vi=1");
  await page.getByRole("button", { name: "Continuar sem foto" }).click();
  const started = Date.now();
  await search(page).fill("Praca da Se");
  // 5 s de tempo limite + 1 nova tentativa: a mensagem chega em ~11 s, nunca "buscando…" para sempre.
  await expect(page.getByText("A busca de endereço não respondeu. Tente de novo ou marque no mapa.")).toBeVisible({ timeout: 20_000 });
  const seconds = (Date.now() - started) / 1000;
  console.log(`Erro mostrado em ${seconds.toFixed(1)} s`);
  expect(seconds).toBeLessThan(15);
  // A tela continua utilizável: dá para marcar no mapa ou usar a localização.
  await expect(page.getByRole("button", { name: /Usar minha localização atual/ })).toBeEnabled();
});
