import { expect, test, type Page } from "@playwright/test";
import { mockGeocoding, SE } from "./support/geo";
import { solidPng } from "./support/png";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

test.use({ geolocation: SE, permissions: ["geolocation"] });

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

async function signIn(page: Page, label: string, next: string) {
  const user = await createUser(label, { onboarded: true });
  created.push(user.email);
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  return user;
}

const cont = (page: Page) => page.getByRole("button", { name: "Continuar", exact: true });

test("'Minha cachorrinha sumiu há 15 minutos': from zero to a shareable alert in under 2 minutes", async ({ page, browser }) => {
  await mockGeocoding(page);
  const started = Date.now();

  // Home → PERDI MEU PET → login → fluxo.
  await page.goto("/");
  await page.getByRole("link", { name: /Perdi meu pet/i }).click();
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpublicar%2Fperdido/);
  const user = await createUser("lost-e2e", { onboarded: true });
  created.push(user.email);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/publicar\/perdido$/);

  // 1 — Pet (sem pets: cadastro relâmpago com foto).
  await expect(page.getByRole("heading", { name: "Qual pet desapareceu?" })).toBeVisible();
  await page.getByLabel("Foto do pet").setInputFiles({ name: "mel.png", mimeType: "image/png", buffer: solidPng() });
  await page.getByLabel("Nome do pet").fill("Mel");
  await page.getByRole("radio", { name: "Cachorro" }).check({ force: true });
  await page.getByRole("radio", { name: /Mini/ }).check({ force: true });
  await page.getByRole("radio", { name: "Caramelo" }).check({ force: true });
  await page.getByRole("button", { name: "Cadastrar e continuar" }).click();

  // 2 — Onde (GPS).
  await expect(page.getByRole("heading", { name: "Onde ele foi visto pela última vez?" })).toBeVisible();
  await expect(page.getByText("✓ Rascunho salvo")).toBeVisible();
  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByTestId("picked-label")).toContainText("perto de Rua Santa Teresa");
  await cont(page).click();

  // 3 — Quando.
  await expect(page.getByRole("heading", { name: "Quando ele sumiu?" })).toBeVisible();
  await page.getByRole("radio", { name: "Agora há pouco" }).check({ force: true });
  await cont(page).click();

  // 4 — Detalhes.
  await expect(page.getByRole("heading", { name: /Algum detalhe/ })).toBeVisible();
  await page.getByRole("checkbox", { name: "Coleira" }).check({ force: true });
  await page.getByLabel(/Algo importante/).fill("É medrosa, atende pelo nome.");
  await cont(page).click();

  // 5 — Contato (número fictício).
  await expect(page.getByRole("heading", { name: /Como as pessoas podem falar/ })).toBeVisible();
  await expect(page.getByText(/Desconfie de quem pedir PIX/)).toBeVisible();
  await page.getByRole("checkbox", { name: /WhatsApp/ }).check();
  await page.getByLabel("Seu celular com DDD").fill("(11) 90000-0001");
  await cont(page).click();

  // 6 — Revisão e ATIVAR.
  await expect(page.getByRole("heading", { name: "Confira e ative o alerta" })).toBeVisible();
  await expect(page.getByText("perto de Rua Santa Teresa, Sé, São Paulo – SP")).toBeVisible();
  await expect(page.getByText(/local aproximado · Sé, São Paulo – SP/)).toBeVisible();
  await page.getByRole("button", { name: /Ativar alerta MEL/i }).click();

  // Alerta publicado.
  await expect(page).toHaveURL(/\/alerta\/[a-z2-9]{6}\?novo=1$/);
  await expect(page.getByText("Alerta MEL ativado.")).toBeVisible();
  await expect(page.locator("article header").getByText("Perdido")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mel", level: 1 })).toBeVisible();
  await expect(page.getByText(/Desapareceu agora há pouco/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Compartilhar no WhatsApp" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Foto de Mel" })).toBeVisible();

  const elapsed = (Date.now() - started) / 1000;
  console.log(`Fluxo completo (inclui login e upload de foto): ${elapsed.toFixed(1)} s`);
  expect(elapsed).toBeLessThan(120);

  // Visitante: vê o alerta, o WhatsApp autorizado, e nada privado.
  const alertUrl = new URL(page.url()).pathname;
  const visitor = await browser.newPage({ baseURL: "http://localhost:3100" });
  await visitor.goto(alertUrl);
  await expect(visitor.getByRole("heading", { name: "Mel", level: 1 })).toBeVisible();
  await expect(visitor.getByText("Visto por último perto de")).toContainText("Sé, São Paulo – SP");
  await expect(visitor.getByRole("link", { name: "WhatsApp do tutor" })).toHaveAttribute("href", /wa\.me\/5511900000001/);
  await expect(visitor.getByText("Alerta MEL ativado.")).toHaveCount(0);
  const html = await (await visitor.request.get(alertUrl)).text();
  expect(html).not.toContain("Santa Teresa");
  expect(html).toContain("PERDIDO: Mel"); // título / Open Graph
  expect(html).toMatch(/<meta property="og:image" content="[^"]+pet-photos/);
  expect(html).toMatch(/<meta name="robots" content="noindex/);
  await visitor.close();

  // Perfil mostra o alerta ativo.
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { name: "Meus alertas" })).toBeVisible();
  await expect(page.getByText(/Publicado/)).toBeVisible();
});

test("the draft is saved and the flow resumes where it stopped", async ({ page }) => {
  await mockGeocoding(page);
  await signIn(page, "lost-draft", "/publicar/perdido");
  await page.getByLabel("Nome do pet").fill("Thor");
  await page.getByRole("radio", { name: "Cachorro" }).check({ force: true });
  await page.getByRole("button", { name: "Cadastrar e continuar" }).click();
  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByTestId("picked-label")).toContainText("perto de");
  await cont(page).click();
  await expect(page.getByRole("heading", { name: "Quando ele sumiu?" })).toBeVisible();

  // A pessoa fecha o app e volta depois.
  await page.goto("/perfil");
  await expect(page.getByText("Rascunho — toque para continuar")).toBeVisible();
  await page.getByText("Rascunho — toque para continuar").click();
  await expect(page.getByRole("heading", { name: "Quando ele sumiu?" })).toBeVisible();
  await expect(page.getByText("Passo 3 de 6")).toBeVisible();
});

test("each step explains what is missing", async ({ page }) => {
  await mockGeocoding(page);
  await signIn(page, "lost-validate", "/publicar/perdido");
  await page.getByRole("button", { name: "Cadastrar e continuar" }).click();
  await expect(page.getByText("Qual é o nome do seu pet?")).toBeVisible();

  await page.getByLabel("Nome do pet").fill("Luna");
  await page.getByRole("radio", { name: "Gato" }).check({ force: true });
  await page.getByRole("button", { name: "Cadastrar e continuar" }).click();

  await cont(page).click();
  await expect(page.getByText("Marque no mapa onde ele foi visto pela última vez.")).toBeVisible();
  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByTestId("picked-label")).toContainText("perto de");
  await cont(page).click();

  await cont(page).click();
  await expect(page.getByText("Diga quando ele sumiu (mesmo que aproximado).")).toBeVisible();
  await page.getByRole("radio", { name: "Agora há pouco" }).check({ force: true });
  await cont(page).click();
  await cont(page).click(); // detalhes são opcionais

  await page.getByRole("checkbox", { name: /botão para ligar/ }).check();
  await cont(page).click();
  await expect(page.getByText("Informe um celular com DDD, por exemplo (11) 98765-4321.")).toBeVisible();
});

test("unknown alert codes show a friendly not-found page", async ({ page }) => {
  for (const code of ["zzzzzz", "nao-existe"]) {
    await page.goto(`/alerta/${code}`);
    await expect(page.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();
  }
});
