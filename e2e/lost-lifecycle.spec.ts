import { expect, test } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { deleteUserByEmail, TEST_PASSWORD } from "./support/users";

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

test("the tutor edits an active alert, then closes it without declaring a reunion", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const tutor = await createTutorWithActiveAlert("life-e2e", { petName: "Bolacha", whatsapp: "11900000002" });
  created.push(tutor.email);
  const cont = () => page.getByRole("button", { name: "Continuar", exact: true }).click();

  await page.goto(`/entrar?next=${encodeURIComponent(`/alerta/${tutor.code}`)}`);
  await page.getByLabel("E-mail").fill(tutor.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Bolacha", level: 1 })).toBeVisible({ timeout: 60_000 });

  // Hierarquia: reencontro (positiva), editar (normal), encerrar (secundária).
  await expect(page.getByRole("link", { name: "Meu pet foi encontrado" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar alerta" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Encerrar alerta" })).toBeVisible();

  // Editar: os passos já vêm preenchidos; muda o detalhe e salva.
  await page.getByRole("link", { name: "Editar alerta" }).click();
  await expect(page.getByText(/Editar alerta · Passo 1 de 4/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Onde ele foi visto pela última vez?" })).toBeVisible();
  await cont();
  await expect(page.getByRole("heading", { name: "Quando ele sumiu?" })).toBeVisible();
  await cont();
  await expect(page.getByRole("heading", { name: /Algum detalhe/ })).toBeVisible();
  await page.getByLabel(/Algo importante/).fill("Tem medo de moto. Atende por Bolachinha.");
  await cont();
  await expect(page.getByRole("heading", { name: /Como as pessoas podem falar/ })).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(new RegExp(`/alerta/${tutor.code}\\?editado=1$`));
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect(page.getByText("Tem medo de moto. Atende por Bolachinha.")).toBeVisible();

  // Encerrar: pede confirmação e explica a diferença para o reencontro.
  await page.getByRole("button", { name: "Encerrar alerta" }).click();
  const sheet = page.getByRole("dialog", { name: "Encerrar este alerta?" });
  await expect(sheet.getByText(/Se Bolacha voltou para casa, escolha "Meu pet foi encontrado"/)).toBeVisible();
  await sheet.getByRole("button", { name: "Manter ativo" }).click();
  await expect(page.getByText("Este alerta foi encerrado pelo tutor.")).toHaveCount(0);
  await page.getByRole("button", { name: "Encerrar alerta" }).click();
  await sheet.getByRole("button", { name: "Encerrar alerta" }).click();

  await expect(page.getByText("Este alerta foi encerrado pelo tutor.")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("article header").getByText("Encerrado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Meu pet foi encontrado" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Editar alerta" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Linha do tempo" })).toBeVisible(); // histórico do tutor

  // Visitante: só o histórico (sem "Eu vi", contato, compartilhar ou cartaz).
  const visitor = await browser.newPage({ baseURL: "http://localhost:3100" });
  await visitor.goto(`/alerta/${tutor.code}`);
  await expect(visitor.getByText("Este alerta foi encerrado pelo tutor.")).toBeVisible({ timeout: 30_000 });
  await expect(visitor.getByRole("link", { name: /Eu vi este pet/i })).toHaveCount(0);
  await expect(visitor.getByRole("link", { name: "WhatsApp do tutor" })).toHaveCount(0);
  await expect(visitor.getByRole("heading", { name: "Ajude compartilhando" })).toHaveCount(0);
  await expect(visitor.getByText("Tem medo de moto")).toHaveCount(0);
  const html = await (await visitor.request.get(`/alerta/${tutor.code}`)).text();
  expect(html).toMatch(/<meta name="robots" content="noindex/);
  expect((await visitor.request.get(`/alerta/${tutor.code}/cartaz/og`)).status()).toBe(404);
  await visitor.close();
});
