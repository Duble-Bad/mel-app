import { expect, test } from "@playwright/test";

test("home communicates the purpose and the four ways to help", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/MEL/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Uma rede inteira procurando com você.");
  await expect(page.getByRole("heading", { name: "Como podemos ajudar?" })).toBeVisible();

  for (const label of ["Perdi meu pet", "Encontrei um pet", "Vi um pet", "Quero adotar"]) {
    // Flows not built yet must be visibly unavailable — never a dead link.
    await expect(page.getByRole("button", { name: new RegExp(label, "i") })).toBeDisabled();
  }
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
