import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

test("PWA: installable manifest and an offline page when the network drops", async ({ page, context, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "MEL", display: "standalone", start_url: "/" });
  expect(manifest.icons.map((i: { purpose: string }) => i.purpose)).toContain("maskable");

  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Garante que a página já é controlada pelo service worker.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto("/mapa").catch(() => {});
  await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toHaveCount(0);
});
