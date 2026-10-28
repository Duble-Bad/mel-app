import { expect, test, type Page } from "@playwright/test";
import reverseFixture from "../packages/core/src/geo/__fixtures__/maptiler-reverse.json" with { type: "json" };
import searchFixture from "../packages/core/src/geo/__fixtures__/maptiler-search.json" with { type: "json" };
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

// GPS simulado: Praça da Sé (local público).
const SE = { latitude: -23.55052, longitude: -46.633308 };
test.use({ geolocation: SE, permissions: ["geolocation"] });

/** Busca de endereço com respostas reais gravadas: sem rede e sem gastar cota. */
async function mockGeocoding(page: Page, status = 200) {
  await page.route("https://api.maptiler.com/geocoding/**", (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    const isReverse = /\/-?\d+(\.\d+)?,-?\d+(\.\d+)?\.json$/.test(path);
    return route.fulfill({ status, json: status === 200 ? (isReverse ? reverseFixture : searchFixture) : {} });
  });
}

const output = async (page: Page) => JSON.parse((await page.getByTestId("harness-output").textContent()) || "null");

async function openPicker(page: Page) {
  await mockGeocoding(page);
  await page.goto("/dev/local");
  await expect(page.getByTestId("location-map")).toHaveAttribute("data-map-status", "ready", { timeout: 30_000 });
}

test("GPS marks the current location and shows the approximate address", async ({ page }) => {
  await openPicker(page);
  await expect(page.getByText("Nenhum local marcado ainda.")).toBeVisible();

  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByTestId("picked-label")).toContainText("perto de Rua Santa Teresa, Sé, São Paulo – SP");
  await expect(page.getByTestId("picked-label")).toContainText("GPS: precisão");

  const value = await output(page);
  expect(value.source).toBe("gps");
  expect(value.position.lat).toBeCloseTo(SE.latitude, 5);
  expect(value.position.lng).toBeCloseTo(SE.longitude, 5);
  expect(value.state).toBe("SP");
});

test("address search moves the pin to the chosen result", async ({ page }) => {
  await openPicker(page);
  await page.getByLabel("Ou busque um endereço ou lugar").fill("Praça da Sé");
  await page.getByRole("button", { name: "Praça da Sé, Sé, São Paulo – SP" }).click();

  await expect(page.getByTestId("picked-label")).toContainText("perto de Praça da Sé, Sé, São Paulo – SP");
  const value = await output(page);
  expect(value.source).toBe("search");
  expect(value.position.lat).toBeCloseTo(-23.5507, 3);
  // A lista some depois da escolha.
  await expect(page.getByRole("list", { name: "Resultados da busca" })).toHaveCount(0);
});

test("tapping the map and dragging the pin both mark the place", async ({ page }) => {
  await openPicker(page);
  const map = page.getByTestId("location-map");
  const box = (await map.boundingBox())!;

  await map.click({ position: { x: box.width * 0.25, y: box.height * 0.3 } });
  await expect(page.getByTestId("picked-label")).toContainText("perto de");
  const tapped = await output(page);
  expect(tapped.source).toBe("map");

  // Arrastar o pino para outro ponto.
  const pin = (await page.getByTestId("map-picker-pin").boundingBox())!;
  await page.mouse.move(pin.x + pin.width / 2, pin.y + pin.height / 2);
  await page.mouse.down();
  await page.mouse.move(pin.x + 80, pin.y + 60, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await output(page)).position.lng).not.toBeCloseTo(tapped.position.lng, 5);
});

test("denied GPS permission explains what to do instead", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [], geolocation: undefined, baseURL: "http://localhost:3100" });
  const page = await context.newPage();
  await mockGeocoding(page);
  await page.goto("/dev/local");
  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByText(/Não temos permissão para usar sua localização/)).toBeVisible();
  await context.close();
});

test("search failure is reported, never silent", async ({ page }) => {
  await mockGeocoding(page, 500);
  await page.goto("/dev/local");
  await page.getByLabel("Ou busque um endereço ou lugar").fill("Praça da Sé");
  await expect(page.getByText("A busca de endereço não respondeu. Tente de novo ou marque no mapa.")).toBeVisible();
});

test("if the map cannot load, GPS still works", async ({ page }) => {
  await mockGeocoding(page);
  await page.route("https://api.maptiler.com/maps/**", (route) => route.abort());
  await page.goto("/dev/local");
  await expect(page.getByText("Não conseguimos mostrar o mapa agora.")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByTestId("picked-label")).toContainText("perto de Rua Santa Teresa");
});

test("onboarding fills city and state from the current location", async ({ page }) => {
  await mockGeocoding(page);
  const user = await createUser("onb-geo");
  try {
    await page.goto("/entrar?next=/perfil");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/onboarding/);

    await page.getByRole("button", { name: "Usar minha localização" }).click();
    await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
    await expect(page.getByLabel("Estado")).toHaveValue("SP");
    await expect(page.getByText("Preenchido: São Paulo – SP.")).toBeVisible();
  } finally {
    await deleteUserByEmail(user.email);
  }
});
