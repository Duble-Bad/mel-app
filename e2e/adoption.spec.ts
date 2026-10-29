import { expect, test, type Page } from "@playwright/test";
import { mockGeocoding, SE } from "./support/geo";
import { solidPng } from "./support/png";
import { createUser, deleteUserByEmail, setRole, TEST_PASSWORD } from "./support/users";

test.use({ geolocation: SE, permissions: ["geolocation"] });

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("adoption: listing → moderation → interest opens a chat with the donor → adopted", async ({ page: donorPage, browser }) => {
  test.setTimeout(180_000);
  await mockGeocoding(donorPage);
  const [donor, mod, adopter] = await Promise.all([
    createUser("adopt-donor", { onboarded: true }),
    createUser("adopt-mod", { onboarded: true }),
    createUser("adopt-adopter", { onboarded: true }),
  ]);
  created.push(donor.email, mod.email, adopter.email);
  await setRole(mod.id, "moderator");
  const name = `Biscoito ${Date.now() % 10_000}`;

  // 1. Quem doa publica (entra em análise).
  await signIn(donorPage, donor.email, "/publicar/adocao");
  await expect(donorPage.getByRole("heading", { name: "Colocar para adoção" })).toBeVisible();
  await donorPage.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(donorPage.getByText("Adicione pelo menos uma foto.")).toBeVisible();
  await donorPage.getByLabel("Fotos do animal").setInputFiles({ name: "b.png", mimeType: "image/png", buffer: solidPng() });
  await donorPage.getByLabel("Nome", { exact: true }).fill(name);
  await donorPage.getByRole("radio", { name: "Cachorro" }).check({ force: true });
  await donorPage.getByRole("checkbox", { name: "Dócil" }).check({ force: true });
  await donorPage.getByLabel("Conte sobre ele").fill("Muito carinhoso, adora passear e se dá bem com crianças.");
  await donorPage.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(donorPage.getByTestId("picked-label")).toContainText("perto de");
  await donorPage.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(donorPage).toHaveURL(/\/adocao\/[a-z2-9]{6}\?novo=1$/, { timeout: 30_000 });
  const path = new URL(donorPage.url()).pathname;
  await expect(donorPage.getByText("Anúncio enviado!")).toBeVisible();

  // Ainda não é público.
  const visitor = await browser.newPage({ baseURL: "http://localhost:3100" });
  await visitor.goto(path);
  await expect(visitor.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();

  // 2. Moderação aprova (recusar exige motivo).
  const modCtx = await browser.newContext({ ...test.info().project.use, baseURL: "http://localhost:3100" });
  const modPage = await modCtx.newPage();
  await signIn(modPage, mod.email, "/admin");
  const card = modPage.getByTestId("admin-adoption").filter({ hasText: name });
  await card.getByRole("button", { name: "Recusar" }).click();
  await expect(card.getByText("Explique o motivo para quem está doando.")).toBeVisible();
  await card.getByRole("button", { name: "Aprovar" }).click();
  await expect(modPage.getByText(`${name} publicado para adoção.`)).toBeVisible();
  await modCtx.close();

  // 3. Público vê na lista; "Quero adotar" pede conta e abre a conversa.
  await visitor.goto("/adocao");
  await visitor.getByTestId("adoption-card").filter({ hasText: name }).click();
  await expect(visitor).toHaveURL(new RegExp(`${path}$`));
  await visitor.getByRole("link", { name: new RegExp(`Quero adotar ${name}`) }).click();
  await expect(visitor).toHaveURL(/\/entrar\?next=/);
  await visitor.getByLabel("E-mail").fill(adopter.email);
  await visitor.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await visitor.getByRole("button", { name: "Entrar" }).click();
  await expect(visitor.getByRole("heading", { name: `Quero adotar ${name}` })).toBeVisible();
  await visitor.getByRole("button", { name: "Enviar interesse" }).click();
  await expect(visitor.getByText("Conte onde você mora.")).toBeVisible();
  await visitor.getByRole("radio", { name: "Apartamento" }).check({ force: true });
  await visitor.getByRole("group", { name: "Já tem outros pets?" }).getByRole("radio", { name: "Não" }).check({ force: true });
  await visitor.getByRole("group", { name: "Há crianças em casa?" }).getByRole("radio", { name: "Sim" }).check({ force: true });
  await visitor.getByLabel(/Conte por que você quer adotar/).fill("Trabalho em casa e tenho tempo para passeios diários.");
  await visitor.getByRole("button", { name: "Enviar interesse" }).click();
  await expect(visitor).toHaveURL(/\/conversas\//, { timeout: 30_000 });
  await expect(visitor.getByRole("heading", { name: `Quem está doando ${name}` })).toBeVisible();
  await expect(visitor.getByTestId("chat-message")).toContainText("Moradia: apartamento · Outros pets: não · Crianças em casa: sim");
  await visitor.close();

  // 4. Quem doa vê o interessado e marca como adotado; sai da lista.
  await donorPage.goto(path);
  await expect(donorPage.getByText("1 interessado: ver conversas")).toBeVisible();
  await donorPage.getByRole("button", { name: "Adotado" }).click();
  await expect(donorPage.getByText("Que alegria! Marcado como adotado.")).toBeVisible();
  const check = await browser.newPage({ baseURL: "http://localhost:3100" });
  await check.goto("/adocao");
  await expect(check.getByTestId("adoption-card").filter({ hasText: name })).toHaveCount(0);
  await check.close();
});
