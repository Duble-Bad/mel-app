import { expect, test } from "@playwright/test";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email).catch(() => {});
});

test("privacy: download my data, then delete the account for good", async ({ page }) => {
  const user = await createUser("lgpd", { onboarded: true });
  created.push(user.email);

  await page.goto("/entrar?next=/perfil");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("link", { name: "Privacidade e dados" }).click();
  await expect(page.getByRole("heading", { name: "Privacidade e dados" })).toBeVisible();

  // Exportação: um JSON com a própria conta.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar meus dados" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^meus-dados-mel-\d{4}-\d{2}-\d{2}\.json$/);
  const json = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8")));
  expect(json.conta.email).toBe(user.email);

  // Exclusão: pede a palavra de confirmação.
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  const sheet = page.getByRole("dialog", { name: "Excluir sua conta?" });
  await sheet.getByRole("button", { name: "Excluir para sempre" }).click();
  await expect(sheet.getByText("Digite EXCLUIR, em letras maiúsculas ou minúsculas.")).toBeVisible();
  await sheet.getByLabel("Digite EXCLUIR para confirmar").fill("excluir");
  await sheet.getByRole("button", { name: "Excluir para sempre" }).click();
  await expect(page).toHaveURL(/\/conta-excluida$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Sua conta foi excluída" })).toBeVisible();

  // Sessão encerrada e login não funciona mais.
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /senha|e-mail/i })).toBeVisible();
});

test("legal pages are public and linked from the home", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Política de privacidade" }).click();
  await expect(page.getByRole("heading", { name: "Política de privacidade", level: 1 })).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Termos de uso" }).click();
  await expect(page.getByRole("heading", { name: "Termos de uso", level: 1 })).toBeVisible();
});
