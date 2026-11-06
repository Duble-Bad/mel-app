import { expect, test, type Page } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { SE } from "./support/geo";
import { createUser, deleteUserByEmail } from "./support/users";
import { createClient } from "@supabase/supabase-js";

// Regressões achadas na inspeção real no celular (2026-11-06).
const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

const NAV = ["Início", "Mapa da Rede", "Mural", "Adoção", "Parceiros"];

test("mobile menu shows every item on short and tall phones, and closes", async ({ page }) => {
  test.slow(); // duas alturas de tela, cada uma com carga completa da home
  for (const height of [915, 568]) {
    await page.setViewportSize({ width: 360, height });
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const menu = page.locator("#menu-celular");
    // Antes: o backdrop-filter do cabeçalho prendia o painel em 64 px e só "Início" aparecia.
    for (const label of NAV) {
      const link = menu.getByRole("link", { name: label, exact: true });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
    }
    expect((await menu.boundingBox())!.height).toBeGreaterThan(height / 2);
    await page.getByRole("button", { name: "Fechar menu" }).click();
    await expect(menu).toHaveCount(0);
  }
});

/** Marca o canvas atual: se o mapa for recriado, a marca some. */
async function markMap(page: Page) {
  await page.locator("canvas.maplibregl-canvas").evaluate((c) => c.setAttribute("data-e2e-mark", "1"));
}

test("map tab survives 'Perto de mim' and 'Buscar nesta área' (no remount, no jump back to the list)", async ({ browser }) => {
  test.slow(); // mapa real (blocos do MapTiler) disputa CPU com a suíte em paralelo
  const ctx = await browser.newContext({ ...test.info().project.use, geolocation: SE, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  await page.goto("/mapa");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await markMap(page);

  await page.getByRole("button", { name: /Perto de mim/ }).click();
  await expect(page).toHaveURL(/lat=/);
  // Centro no endereço com no máximo 3 casas (~110 m): o link não revela o ponto exato.
  const lat = new URL(page.url()).searchParams.get("lat")!;
  expect(lat.split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
  await expect(page.getByTestId("map-near-me")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mapa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('canvas[data-e2e-mark="1"]')).toBeVisible();

  // Move o mapa para longe (setas do teclado do MapLibre) e busca ali.
  await page.locator("canvas.maplibregl-canvas").focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Buscar nesta área" }).click();
  await expect(page.getByRole("button", { name: "Buscar nesta área" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mapa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('canvas[data-e2e-mark="1"]')).toBeVisible();
  await ctx.close();
});

test("a photo that fails to load shows a clear placeholder; the mobile detail panel keeps the title and actions on screen", async ({ page }) => {
  test.slow();
  const t = await createTutorWithActiveAlert("photo-fallback", { petName: "Fumaça", withPhoto: true });
  created.push(t.email);
  await page.route("**/storage/v1/object/public/**", (route) => route.abort());

  await page.goto("/mural?tipos=lost");
  const card = page.getByTestId("case-card").filter({ hasText: "Fumaça" });
  await expect(card.getByText("Foto indisponível")).toBeVisible();

  await page.goto("/mapa?tipos=lost");
  await page.getByTestId("case-card").filter({ hasText: "Fumaça" }).click();
  const panel = page.getByTestId("map-selected");
  await expect(panel.getByText("Foto indisponível")).toBeVisible();
  await expect(panel.getByRole("heading", { name: /Fumaça/ })).toBeInViewport();
  await expect(panel.getByRole("link", { name: /Ver alerta/ })).toBeInViewport();
});

test("test cleanup finds and deletes the users it created, even with hundreds of accounts", async () => {
  const { id, email } = await createUser("cleanup-check");
  await deleteUserByEmail(email);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.getUserById(id);
  // Antes, só a 1ª página de 200 contas era lida: usuários novos sobravam e poluíam mapa e mural.
  expect(data.user).toBeNull();
});

