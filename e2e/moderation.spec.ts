import { expect, test, type Page } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { createUser, deleteUserByEmail, setRole, TEST_PASSWORD } from "./support/users";

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

test("a visitor reports a scam alert; a moderator hides it and the action is audited", async ({ browser, page: modPage }) => {
  test.setTimeout(120_000);
  const scam = await createTutorWithActiveAlert("mod-scam", { petName: "Trapaça" });
  created.push(scam.email);

  // 1. Visitante sem conta denuncia em 1 toque.
  const ctx = await browser.newContext({ ...test.info().project.use, baseURL: "http://localhost:3100" });
  const visitor = await ctx.newPage();
  await visitor.goto(`/alerta/${scam.code}`);
  await visitor.getByRole("button", { name: "Denunciar" }).click();
  const sheet = visitor.getByRole("dialog", { name: "Denunciar este alerta" });
  await sheet.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(sheet.getByText("Escolha o motivo da denúncia.")).toBeVisible();
  await sheet.getByRole("radio", { name: "Pediu dinheiro ou parece golpe" }).check({ force: true });
  await sheet.getByLabel(/Detalhes/).fill("Pediu PIX para devolver.");
  await sheet.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(visitor.getByText("Denúncia enviada.")).toBeVisible();
  await ctx.close();

  // 2. Moderação: vê a denúncia com contexto e oculta o alerta (com confirmação).
  const mod = await createUser("mod-e2e", { onboarded: true });
  created.push(mod.email);
  await setRole(mod.id, "moderator");
  await signIn(modPage, mod.email, "/admin");
  await expect(modPage.getByRole("heading", { name: "Moderação" })).toBeVisible();
  await expect(modPage.getByText("Denúncias abertas")).toBeVisible();
  const card = modPage.getByTestId("admin-report").filter({ hasText: "Alerta: Trapaça" });
  await expect(card).toContainText("Pediu dinheiro ou parece golpe");
  await expect(card).toContainText("Pediu PIX para devolver.");
  await card.getByRole("button", { name: "Ocultar conteúdo" }).click();
  const confirm = modPage.getByRole("dialog", { name: "Ocultar este conteúdo?" });
  await confirm.getByLabel(/Motivo/).fill("Golpe do PIX");
  await confirm.getByRole("button", { name: "Sim, ocultar" }).click();
  await expect(modPage.getByText("Conteúdo ocultado.").first()).toBeVisible();
  await expect(modPage.getByTestId("admin-report").filter({ hasText: "Alerta: Trapaça" })).toHaveCount(0);
  await expect(modPage.getByText(/Conteúdo ocultado · Alerta: Trapaça/)).toBeVisible();

  // 3. O alerta saiu do ar para o público.
  const pub = await browser.newPage({ baseURL: "http://localhost:3100" });
  await pub.goto(`/alerta/${scam.code}`);
  await expect(pub.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();
  await pub.close();
});

test("the moderation panel does not exist for regular accounts", async ({ page }) => {
  const user = await createUser("mod-regular", { onboarded: true });
  created.push(user.email);
  await signIn(page, user.email, "/admin");
  await expect(page.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();
});
