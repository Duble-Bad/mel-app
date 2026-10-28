import { expect, test, type Page } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { mockGeocoding, SE } from "./support/geo";
import { solidPng } from "./support/png";
import { deleteUserByEmail, TEST_PASSWORD } from "./support/users";

test.use({ geolocation: SE, permissions: ["geolocation"] });

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

const cont = (page: Page) => page.getByRole("button", { name: "Continuar", exact: true });

test("'Encontrei um cachorro na rua': no account → Radar finds the lost Yorkshire → chat with the tutor → ownership check stays private", async ({
  browser,
  page: tutorPage,
}) => {
  test.setTimeout(180_000);
  const tutor = await createTutorWithActiveAlert("found-e2e", { petName: "Amora", breed: "Yorkshire Terrier", withPhoto: true });
  created.push(tutor.email);

  // 1. Quem encontrou: navegador limpo, sem conta, começa pela home.
  const ctx = await browser.newContext({ ...test.info().project.use, baseURL: "http://localhost:3100", geolocation: SE, permissions: ["geolocation"] });
  const finder = await ctx.newPage();
  await mockGeocoding(finder);
  await finder.goto("/");
  await finder.getByRole("link", { name: /Encontrei um pet/i }).click();
  await expect(finder).toHaveURL(/\/publicar\/encontrado$/);

  await expect(finder.getByRole("heading", { name: "Tem uma foto dele?" })).toBeVisible();
  await finder.getByLabel("Foto do animal").setInputFiles({ name: "achado.png", mimeType: "image/png", buffer: solidPng() });
  await expect(finder.getByRole("img", { name: "Foto escolhida" })).toBeVisible();
  await cont(finder).click();

  await expect(finder.getByRole("heading", { name: "Onde você encontrou?" })).toBeVisible();
  await cont(finder).click();
  await expect(finder.getByText("Marque no mapa onde você encontrou.")).toBeVisible(); // explica o que falta
  await finder.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(finder.getByTestId("picked-label")).toContainText("perto de");
  await cont(finder).click();

  await finder.getByRole("radio", { name: "Agora" }).check({ force: true });
  await cont(finder).click();

  await expect(finder.getByRole("heading", { name: "Como ele é?" })).toBeVisible();
  await cont(finder).click();
  await expect(finder.getByText("Diga se é cachorro, gato ou outro.")).toBeVisible();
  await finder.getByRole("radio", { name: "Cachorro" }).check({ force: true });
  await finder.getByRole("radio", { name: /^Mini/ }).check({ force: true });
  await finder.getByRole("radio", { name: "Fêmea" }).check({ force: true });
  await cont(finder).click();

  await finder.getByRole("radio", { name: "Está comigo" }).check({ force: true });
  await finder.getByLabel(/Detalhe para conferir/).fill("Mancha branca no peito");
  await cont(finder).click();

  await expect(finder.getByRole("heading", { name: "Confira e publique" })).toBeVisible();
  await finder.getByRole("button", { name: "Publicar" }).click();

  // 2. Radar MEL na hora: o alerta da Mel aparece como possível correspondência.
  await expect(finder).toHaveURL(/\/encontrado\/[a-z2-9]{6}\?novo=1$/, { timeout: 30_000 });
  const foundPath = new URL(finder.url()).pathname;
  await expect(finder.getByText("Publicado.")).toBeVisible();
  // Outros testes em paralelo também têm cachorros perdidos na Sé: filtra pelo alerta deste teste.
  const card = finder.getByTestId("match-card").filter({ hasText: "Amora · perdido" });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(/Possível correspondência · \d+%/);
  await expect(card).toContainText("mesmo porte");
  // A prova de posse: só quem encontrou vê.
  await expect(finder.getByText("Mancha branca no peito")).toBeVisible();

  // 3. Quem encontrou fala com o tutor pelo chat (sem expor telefone).
  await card.getByRole("link", { name: "Falar com o tutor" }).click();
  await finder.getByLabel("Sua mensagem").fill("Encontrei uma Yorkshire parecida com a Amora, está comigo e bem!");
  await finder.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(finder).toHaveURL(/\/conversas\//, { timeout: 30_000 });

  // 4. Tutor: aviso do Radar → correspondências → animal encontrado → conversa.
  await tutorPage.goto(`/entrar?next=${encodeURIComponent("/notificacoes")}`);
  await tutorPage.getByLabel("E-mail").fill(tutor.email);
  await tutorPage.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await tutorPage.getByRole("button", { name: "Entrar" }).click();
  await expect(tutorPage.getByText("Radar MEL: possível correspondência para Amora").first()).toBeVisible();
  await tutorPage.getByText("Radar MEL: possível correspondência para Amora").first().click();
  await expect(tutorPage).toHaveURL(/\/perfil\/correspondencias$/);
  const ownerCard = tutorPage.getByTestId("match-card").filter({ has: tutorPage.locator(`a[href="${foundPath}"]`) });
  await expect(ownerCard).toBeVisible();
  await ownerCard.getByRole("link", { name: "Ver o animal encontrado" }).click();
  await expect(tutorPage).toHaveURL(new RegExp(`${foundPath}$`));
  await expect(tutorPage.getByRole("heading", { name: "Animal encontrado" })).toBeVisible();
  await expect(tutorPage.getByText("Mancha branca no peito")).toHaveCount(0); // privado
  await expect(tutorPage.getByText("Está com quem encontrou")).toBeVisible();

  await tutorPage.goBack();
  // A correspondência deste teste é a que aponta para o encontrado publicado acima.
  const mine = tutorPage.getByTestId("match-card").filter({ has: tutorPage.locator(`a[href="${foundPath}"]`) });
  await mine.getByRole("button", { name: "Falar com quem encontrou" }).click();
  await expect(tutorPage).toHaveURL(/\/conversas\//);
  await expect(tutorPage.getByTestId("chat-message")).toContainText("está comigo e bem");

  // 5. Visitante qualquer: página pública sem a prova de posse e sem o ponto exato.
  const pub = await browser.newPage({ baseURL: "http://localhost:3100" });
  await pub.goto(foundPath);
  await expect(pub.getByRole("heading", { name: "Este pet é seu?" })).toBeVisible();
  await expect(pub.getByText("Mancha branca no peito")).toHaveCount(0);
  await expect(pub.getByTestId("match-card")).toHaveCount(0);
  await pub.close();
  await ctx.close();
});

test("'Vi um pet solto' starts the same flow already marked as 'continua na rua'", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Vi um pet/i }).click();
  await expect(page).toHaveURL(/\/publicar\/encontrado\?vi=1$/);
  await expect(page.getByText("Vi um pet solto")).toBeVisible();
});

test("the API refuses found reports without the anti-robot check", async ({ request }) => {
  const res = await request.post("/api/encontrados", {
    data: { species: "dog", position: { lat: SE.latitude, lng: SE.longitude }, foundAt: new Date().toISOString(), custody: "with_me" },
  });
  expect(res.status()).toBe(403);
});
