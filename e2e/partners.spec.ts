import { expect, test, type Page } from "@playwright/test";
import { mockGeocoding, SE } from "./support/geo";
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

test("partners: signup → moderation → directory, offers with 'Patrocinado' only by moderation", async ({ page: ownerPage, browser }) => {
  test.setTimeout(150_000);
  await mockGeocoding(ownerPage);
  const [owner, mod] = await Promise.all([createUser("biz-owner", { onboarded: true }), createUser("biz-mod", { onboarded: true })]);
  created.push(owner.email, mod.email);
  await setRole(mod.id, "moderator");
  const name = `Clínica Teste ${Date.now() % 10_000}`;

  // 1. Cadastro (erros só depois de tentar enviar).
  await signIn(ownerPage, owner.email, "/publicar/parceiro");
  await expect(ownerPage.getByRole("heading", { name: "Cadastrar empresa parceira" })).toBeVisible();
  await ownerPage.getByRole("button", { name: "Enviar cadastro" }).click();
  await expect(ownerPage.getByText("Falta pouco: confira os campos destacados.")).toBeVisible();
  await ownerPage.getByLabel("Nome da empresa").fill(name);
  await ownerPage.getByRole("radio", { name: "Clínica veterinária" }).check({ force: true });
  await ownerPage.getByLabel("Sobre a empresa").fill("Atendimento 24 horas com leitor de microchip para pets encontrados.");
  await ownerPage.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(ownerPage.getByTestId("picked-label")).toBeVisible();
  await ownerPage.getByLabel("Endereço como aparece no perfil").fill("Rua Exemplo, 100 – Sé, São Paulo – SP");
  await ownerPage.getByLabel("Telefone").fill("(11) 3333-4444");
  await ownerPage.getByRole("switch", { name: /Ajudamos com pets perdidos/ }).click();
  await ownerPage.getByRole("button", { name: "Enviar cadastro" }).click();
  await expect(ownerPage).toHaveURL(/\/parceiros\/[a-z2-9]{6}\?novo=1$/, { timeout: 30_000 });
  const path = new URL(ownerPage.url()).pathname;
  await expect(ownerPage.getByText("Cadastro enviado!")).toBeVisible();

  const visitor = await browser.newPage({ baseURL: "http://localhost:3100" });
  await visitor.goto(path);
  await expect(visitor.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();

  // 2. Moderação: recusar exige motivo; aprova.
  const modCtx = await browser.newContext({ ...test.info().project.use, baseURL: "http://localhost:3100" });
  const modPage = await modCtx.newPage();
  await signIn(modPage, mod.email, "/admin");
  const card = modPage.getByTestId("admin-business").filter({ hasText: name });
  await card.getByRole("button", { name: "Recusar" }).click();
  await expect(card.getByText("Explique o motivo para a empresa.")).toBeVisible();
  await card.getByRole("button", { name: "Aprovar" }).click();
  await expect(modPage.getByText(`${name} aprovado.`)).toBeVisible();

  // 3. Dono publica oferta (sem selo).
  await ownerPage.goto(path);
  await expect(ownerPage.getByText("Sua empresa está publicada no diretório.")).toBeVisible();
  await ownerPage.getByLabel("Título").fill("Microchipagem com 20% off");
  await ownerPage.getByRole("button", { name: "Publicar oferta" }).click();
  await expect(ownerPage.getByTestId("business-offer")).toContainText("Microchipagem com 20% off");
  await expect(ownerPage.getByTestId("business-offer")).not.toContainText("Patrocinado");
  await expect(ownerPage.getByRole("button", { name: "Marcar como patrocinada" })).toHaveCount(0);

  // 4. Moderação marca como patrocinada.
  await modPage.goto(path);
  await modPage.getByRole("button", { name: "Marcar como patrocinada" }).click();
  await expect(modPage.getByTestId("business-offer")).toContainText("Patrocinado");
  await modCtx.close();

  // 5. Público encontra no diretório (filtro de categoria) com contatos.
  await visitor.goto(`/parceiros?categoria=vet&lat=${SE.latitude}&lng=${SE.longitude}`);
  const listed = visitor.getByTestId("business-card").filter({ hasText: name });
  await expect(listed).toContainText("Patrocinado");
  await expect(listed).toContainText("Ajuda com pets perdidos");
  await listed.click();
  await expect(visitor.getByRole("heading", { name })).toBeVisible();
  await expect(visitor.getByRole("link", { name: "(11) 3333-4444" })).toHaveAttribute("href", "tel:+551133334444");
  await visitor.goto(`/parceiros?categoria=petshop&lat=${SE.latitude}&lng=${SE.longitude}`);
  await expect(visitor.getByTestId("business-card").filter({ hasText: name })).toHaveCount(0);
  await visitor.close();
});
