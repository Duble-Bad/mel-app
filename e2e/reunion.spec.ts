import { expect, test, type Page } from "@playwright/test";
import jsQR from "jsqr";
import sharp from "sharp";
import { anonymousSighting, createTutorWithActiveAlert } from "./support/alerts";
import { mockGeocoding, SE } from "./support/geo";
import { solidPng } from "./support/png";
import { createUser, deleteUserByEmail, deleteUserById, TEST_PASSWORD } from "./support/users";

test.use({ geolocation: SE, permissions: ["geolocation"] });

const createdEmails: string[] = [];
const createdIds: string[] = [];
test.afterAll(async () => {
  for (const email of createdEmails) await deleteUserByEmail(email);
  for (const id of createdIds) await deleteUserById(id);
});

async function signInAs(page: Page, email: string, next: string) {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const cont = (page: Page) => page.getByRole("button", { name: "Continuar", exact: true });

test("'Minha cachorrinha sumiu há 15 minutos': alert → anonymous sighting → chat → reunion → helpers thanked", async ({
  page: tutor,
  browser,
}) => {
  test.setTimeout(240_000);
  await mockGeocoding(tutor);

  // 1. Tutor publica o alerta pelo assistente.
  const user = await createUser("reunion-e2e", { onboarded: true });
  createdEmails.push(user.email);
  await signInAs(tutor, user.email, "/publicar/perdido");
  await expect(tutor.getByRole("heading", { name: "Qual pet desapareceu?" })).toBeVisible();
  await tutor.getByLabel("Foto do pet").setInputFiles({ name: "mel.png", mimeType: "image/png", buffer: solidPng() });
  await tutor.getByLabel("Nome do pet").fill("Mel");
  await tutor.getByRole("radio", { name: "Cachorro" }).check({ force: true });
  await tutor.getByRole("button", { name: "Cadastrar e continuar" }).click();
  await tutor.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(tutor.getByTestId("picked-label")).toContainText("perto de");
  await cont(tutor).click();
  await tutor.getByRole("radio", { name: "Agora há pouco" }).check({ force: true });
  await cont(tutor).click();
  await cont(tutor).click(); // detalhes opcionais
  await expect(tutor.getByRole("checkbox", { name: /chat da MEL/ })).toBeChecked(); // chat ligado por padrão
  await cont(tutor).click();
  await tutor.getByRole("button", { name: /Ativar alerta MEL/i }).click();
  await expect(tutor).toHaveURL(/\/alerta\/[a-z2-9]{6}\?novo=1$/);
  const code = new URL(tutor.url()).pathname.split("/").pop()!;

  // 2. Visitante sem conta: avistamento e mensagem ao tutor.
  const ctx = await browser.newContext({ ...test.info().project.use, baseURL: "http://localhost:3100", geolocation: SE, permissions: ["geolocation"] });
  const visitor = await ctx.newPage();
  await mockGeocoding(visitor);
  await visitor.goto(`/avistamento/${code}`);
  await visitor.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(visitor.getByTestId("picked-label")).toContainText("perto de");
  await visitor.getByRole("radio", { name: "Agora" }).check({ force: true });
  await visitor.getByLabel(/Mais alguma coisa/).fill("Entrou no quintal da casa amarela.");
  await visitor.getByRole("button", { name: /Enviar avistamento/i }).click();
  await expect(visitor.getByText("O tutor já foi avisado.")).toBeVisible({ timeout: 30_000 });
  await visitor.getByRole("link", { name: /Mandar mensagem ao tutor/ }).click();
  await visitor.getByLabel("Sua mensagem").fill("Acabei de ver a Mel entrando num quintal!");
  await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(visitor).toHaveURL(/\/conversas\//, { timeout: 30_000 });

  // 3. Tutor encontra a Mel graças à pista e confirma o reencontro (R1–R4).
  await tutor.goto(`/alerta/${code}`);
  await expect(tutor.getByTestId("timeline-sighting")).toContainText("quintal da casa amarela");
  await tutor.getByRole("link", { name: "Meu pet foi encontrado" }).click();
  await expect(tutor.getByRole("heading", { name: "Que notícia maravilhosa!" })).toBeVisible();
  await tutor.getByRole("button", { name: "Sim, Mel está em casa" }).click();
  await expect(tutor.getByText("Passo 1 de 3")).toBeVisible();
  await cont(tutor).click();
  await expect(tutor.getByText("Conte como foi o reencontro.")).toBeVisible(); // explica o que falta
  await tutor.getByRole("radio", { name: "Alguém viu pelo MEL" }).check({ force: true });
  await cont(tutor).click();
  await expect(tutor.getByRole("heading", { name: "Alguma pista ajudou?" })).toBeVisible();
  await tutor.getByRole("radio", { name: /Avistamento|perto de/ }).first().click();
  await cont(tutor).click();
  await tutor.getByLabel(/Onde estava/).fill("Liberdade, perto da praça");
  await tutor.getByLabel(/A história do reencontro/).fill("Uma vizinha viu pela MEL e em 20 minutos ela estava no colo.");
  await tutor.getByRole("button", { name: "Confirmar reencontro" }).click();

  // 4. Página do alerta: ESTÁ EM CASA, timeline preservada, pista destacada, sem pedir avistamento.
  await expect(tutor).toHaveURL(new RegExp(`/alerta/${code}\\?reencontro=1$`));
  await expect(tutor.getByRole("heading", { name: /Mel está em casa/i })).toBeVisible();
  await expect(tutor.getByText("Reencontro confirmado. Avisamos quem ajudou na busca.")).toBeVisible();
  await expect(tutor.getByText("Mel voltou para casa graças a um avistamento na MEL.")).toBeVisible();
  await expect(tutor.getByText("1 pessoa ajudou nesta busca")).toBeVisible();
  await expect(tutor.getByText("Esta pista ajudou no reencontro")).toBeVisible();
  await expect(tutor.getByRole("link", { name: "Meu pet foi encontrado" })).toHaveCount(0);

  // 5. Quem ajudou (sem conta) recebe o obrigado; o público vê o encerramento.
  await visitor.goto("/notificacoes");
  await expect(visitor.getByText("Mel está em casa!")).toBeVisible();
  await expect(visitor.getByText(/A sua pista ajudou no reencontro/)).toBeVisible();
  await visitor.goto(`/alerta/${code}`);
  await expect(visitor.getByText(/Uma vizinha viu pela MEL/)).toBeVisible();
  await expect(visitor.getByRole("link", { name: /Eu vi este pet/i })).toHaveCount(0);
  await expect(visitor.getByRole("link", { name: /Conversar com o tutor/ })).toHaveCount(0);
  await visitor.goto(`/avistamento/${code}`);
  await expect(visitor.getByRole("heading", { name: /já está em casa/ })).toBeVisible();

  // 6. Cartaz "ENCONTRADO!" para compartilhar (QR ainda abre o alerta).
  const png = await (await tutor.request.get(`/alerta/${code}/cartaz/square`)).body();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toMatch(new RegExp(`/alerta/${code}$`));
  const download = await tutor.request.get(`/alerta/${code}/cartaz/story?baixar=1`);
  expect(download.headers()["content-disposition"]).toContain("MEL-encontrado-Mel-story.png");

  await ctx.close();
});

test("only the tutor reaches the reunion flow, and only while the alert is active", async ({ page }) => {
  const t = await createTutorWithActiveAlert("reunion-guard", "Thor");
  createdEmails.push(t.email);
  createdIds.push(await anonymousSighting(t.code));
  const other = await createUser("reunion-other", { onboarded: true });
  createdEmails.push(other.email);
  await signInAs(page, other.email, `/alerta/${t.code}/reencontro`);
  await expect(page).toHaveURL(new RegExp(`/alerta/${t.code}$`));
  await expect(page.getByRole("link", { name: "Meu pet foi encontrado" })).toHaveCount(0);
});
