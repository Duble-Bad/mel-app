import { expect, test } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { deleteUserByEmail } from "./support/users";

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

test("the public lost list filters by species/radius/period, keeps filters in the URL and links to the alert", async ({ page }) => {
  const t = await createTutorWithActiveAlert("map-list", { petName: "Paçoca" }); // cachorro na Praça da Sé (centro padrão)
  created.push(t.email);

  await page.goto("/perdidos");
  await expect(page.getByRole("heading", { name: "Perdidos perto de você" })).toBeVisible();
  await expect(page.getByText(/do centro de São Paulo/)).toBeVisible();
  const card = page.getByTestId("case-card").filter({ hasText: "Paçoca" });
  await expect(card).toBeVisible();

  // Gatos: o alerta do cachorro some; a URL guarda o filtro.
  await page.getByRole("button", { name: "Gatos" }).click();
  await expect(page).toHaveURL(/\/perdidos\?especie=cat$/);
  await expect(page.getByRole("button", { name: "Gatos" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("case-card").filter({ hasText: "Paçoca" })).toHaveCount(0);

  // Cachorros + 1 km + 24 horas: volta a aparecer.
  await page.getByRole("button", { name: "Gatos" }).click();
  await page.getByRole("button", { name: "Cachorros" }).click();
  await page.getByRole("button", { name: "Raio de 1 km" }).click();
  await page.getByRole("button", { name: "24 horas" }).click();
  await expect(page).toHaveURL(/especie=dog/);
  await expect(page).toHaveURL(/periodo=24h/);
  await expect(page).toHaveURL(/raio=1/);
  await expect(page.getByTestId("case-card").filter({ hasText: "Paçoca" })).toBeVisible();

  // Recarregar mantém os filtros (link compartilhável).
  await page.reload();
  await expect(page.getByRole("button", { name: "Cachorros" })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("case-card").filter({ hasText: "Paçoca" }).click();
  await expect(page).toHaveURL(new RegExp(`/alerta/${t.code}$`));
});

test("the map shows pins, opens a card when a pin is tapped and lists the same cases", async ({ page }) => {
  const t = await createTutorWithActiveAlert("map-pins", { petName: "Brigadeiro" });
  created.push(t.email);
  await page.goto("/mapa?tipos=lost&raio=1");
  await expect(page.getByRole("heading", { name: "Mapa da rede MEL" })).toBeVisible();
  await expect(page.getByTestId("map-count")).toContainText(/caso/);
  await expect(page.getByRole("region", { name: /Mapa de casos/ })).toBeVisible();
  const pin = page.getByRole("button", { name: /Perdido: Brigadeiro/ });
  await expect(pin).toBeVisible({ timeout: 20_000 });
  await pin.click();
  await expect(page.getByTestId("map-selected")).toContainText("Brigadeiro");
  await page.getByTestId("map-selected").getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByTestId("map-selected")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Lista de casos" }).getByText("Brigadeiro")).toBeVisible();
});

test("an empty search explains itself and suggests a wider radius", async ({ page }) => {
  // Meio do oceano: nunca há casos.
  await page.goto("/encontrados?lat=-30&lng=-30&raio=1");
  await expect(page.getByText("Nada por aqui com esses filtros")).toBeVisible();
  await expect(page.getByText(/aumentar o raio/)).toBeVisible();
});
