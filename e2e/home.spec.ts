import { expect, test } from "@playwright/test";

test("home communicates the purpose and the four ways to help", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/MEL/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Uma rede inteira procurando com você.");
  await expect(page.getByRole("heading", { name: "Como podemos ajudar?" })).toBeVisible();

  await expect(page.getByRole("link", { name: /Perdi meu pet/i })).toHaveAttribute("href", "/publicar/perdido");
  await expect(page.getByRole("link", { name: /Encontrei um pet/i })).toHaveAttribute("href", "/publicar/encontrado");
  await expect(page.getByRole("link", { name: /Vi um pet/i })).toHaveAttribute("href", "/publicar/encontrado?vi=1");
  await expect(page.getByRole("link", { name: /Quero adotar/i })).toHaveAttribute("href", "/adocao");
});

test("home reports a live connection to the MEL backend", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("system-status")).toHaveAttribute("data-ok", "true");
  await expect(page.getByText("Rede MEL conectada")).toBeVisible();
});

test("health endpoint confirms database and PostGIS", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.postgis).toMatch(/^\d+\.\d+/);
});

test("home has no horizontal scroll on a phone", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the brand story leads to 'Nossa origem' with the real Mel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Conheça a história da Mel" }).click();
  await expect(page).toHaveURL(/\/nossa-origem$/);
  await expect(page.getByRole("heading", { name: "Antes de ser um aplicativo, MEL foi uma busca.", level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: /A Mel, uma pequena Yorkshire/ })).toBeVisible();
  await expect(page.getByText("Porque quando um animal desaparece, ninguém deveria precisar procurá-lo sozinho.")).toBeVisible();
});
