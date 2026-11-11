import { expect, test, type Page } from "@playwright/test";
import { mockGeocoding, SE, keepGeolocation } from "./support/geo";
import { createUser, deleteUserByEmail, setRole, TEST_PASSWORD } from "./support/users";

test.use({ geolocation: SE, permissions: ["geolocation"] });
test.beforeEach(({ page }) => keepGeolocation(page, SE));

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

test("partners: signup on /parceiros → moderation → directory; 'Patrocinado' off in the pilot", async ({ page: ownerPage, browser }) => {
  test.setTimeout(150_000);
  await mockGeocoding(ownerPage);
  const [owner, mod] = await Promise.all([createUser("biz-owner", { onboarded: true }), createUser("biz-mod", { onboarded: true })]);
  created.push(owner.email, mod.email);
  await setRole(mod.id, "moderator");
  const name = `Clínica Teste ${Date.now() % 10_000}`;

  // 1. Inscrição na própria página de Parceiros (erros só depois de tentar enviar).
  await signIn(ownerPage, owner.email, "/parceiros#cadastro");
  await expect(ownerPage.getByRole("heading", { name: "Cadastrar minha organização" })).toBeVisible();
  await expect(ownerPage.getByRole("radio", { name: /Empresa ou serviço pet/ })).toBeChecked();
  await ownerPage.getByRole("button", { name: "Enviar para moderação" }).click();
  await expect(ownerPage.getByText("Falta pouco: confira os campos destacados.")).toBeVisible();
  await ownerPage.getByLabel("Nome público").fill(name);
  await ownerPage.getByLabel("Categoria", { exact: true }).selectOption("vet");
  await ownerPage.getByLabel("CNPJ", { exact: true }).fill("11.222.333/0001-82");
  await ownerPage.getByLabel("Razão social").focus();
  await expect(ownerPage.getByText("Confira os 14 caracteres do CNPJ.")).toBeVisible();
  await ownerPage.getByLabel("CNPJ", { exact: true }).fill("11222333000181");
  await ownerPage.getByLabel("Razão social").fill("Clínica Teste Ltda");
  await ownerPage.getByLabel("Sobre a empresa").fill("Atendimento 24 horas com leitor de microchip para pets encontrados.");
  await ownerPage.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(ownerPage.getByTestId("picked-label")).toBeVisible();
  await ownerPage.getByLabel("Endereço como aparece no perfil").fill("Rua Exemplo, 100 – Sé, São Paulo – SP");
  await ownerPage.getByLabel("Telefone").fill("(11) 3333-4444");
  await ownerPage.getByRole("switch", { name: /Ajudo com pets perdidos/ }).click();
  await ownerPage.getByRole("checkbox", { name: /Li e aceito as regras do programa/ }).check();
  await ownerPage.getByRole("button", { name: "Enviar para moderação" }).click();
  await expect(ownerPage.getByRole("heading", { name: "Enviado para moderação" })).toBeVisible({ timeout: 30_000 });
  await ownerPage.getByRole("link", { name: "Acompanhar meu cadastro" }).click();
  await expect(ownerPage).toHaveURL(/\/parceiros\/[a-z2-9]{6}$/, { timeout: 30_000 });
  const path = new URL(ownerPage.url()).pathname;
  await expect(ownerPage.getByText("A equipe da MEL está revisando.")).toBeVisible();
  await expect(ownerPage.getByText("11.222.333/0001-81")).toBeVisible(); // só o dono (e a moderação) vê

  const visitor = await browser.newPage({ baseURL: "http://localhost:3100" });
  await visitor.goto(path);
  await expect(visitor.getByRole("heading", { name: "Ops, esta página se perdeu!" })).toBeVisible();

  // 2. Moderação: tipo e CNPJ "Verificação pendente"; recusar exige motivo; aprova.
  const modCtx = await browser.newContext({ ...test.info().project.use, baseURL: "http://localhost:3100" });
  const modPage = await modCtx.newPage();
  await signIn(modPage, mod.email, "/admin");
  const card = modPage.getByTestId("admin-business").filter({ hasText: name });
  await expect(card).toContainText("Empresa ou serviço pet");
  await expect(card).toContainText("Verificação pendente");
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

  // 4. Piloto sem patrocínio (MEL_SPONSORED_OFFERS desligada): nem a moderação marca.
  await modPage.goto(path);
  await expect(modPage.getByTestId("business-offer")).toBeVisible();
  await expect(modPage.getByRole("button", { name: "Marcar como patrocinada" })).toHaveCount(0);
  await modCtx.close();

  // 5. Público encontra no diretório (filtro de categoria) com contatos, sem CNPJ e sem selo.
  await visitor.goto(`/parceiros?categoria=vet&lat=${SE.latitude}&lng=${SE.longitude}`);
  const listed = visitor.getByTestId("business-card").filter({ hasText: name });
  await expect(listed).toContainText("Ajuda com pets perdidos");
  await expect(listed).not.toContainText("Patrocinado");
  await listed.click();
  await expect(visitor.getByRole("heading", { name })).toBeVisible();
  await expect(visitor.getByText("11.222.333/0001-81")).toHaveCount(0);
  await expect(visitor.getByRole("link", { name: "(11) 3333-4444" })).toHaveAttribute("href", "tel:+551133334444");
  await visitor.goto(`/parceiros?categoria=petshop&lat=${SE.latitude}&lng=${SE.longitude}`);
  await expect(visitor.getByTestId("business-card").filter({ hasText: name })).toHaveCount(0);
  await visitor.close();
});

test("partners: visitor fills the form without an account, signs in with partner context and gets the draft back", async ({ page }) => {
  test.setTimeout(90_000);
  await mockGeocoding(page);
  const user = await createUser("biz-draft", { onboarded: true });
  created.push(user.email);

  await page.goto("/parceiros");
  await expect(page.getByRole("heading", { name: "Seja um parceiro da MEL" })).toBeVisible();
  await page.getByRole("link", { name: "Quero me inscrever" }).click();
  await page.locator("label").filter({ has: page.getByRole("radio", { name: /^ONG/ }) }).click();
  await page.getByLabel("Nome da ONG").fill("Patinhas Rascunho");
  await page.getByLabel("CNPJ", { exact: true }).fill("11.222.333/0001-81");
  await page.getByLabel("Área de atuação").selectOption("Só gatos");
  await page.getByLabel("Pessoa responsável").fill("Maria Teste");
  await page.getByLabel("Sobre a ONG").fill("Resgatamos gatos e buscamos lares responsáveis na região.");
  await page.getByLabel("Bairro").fill("Sé");
  await page.getByLabel("Cidade").fill("São Paulo – SP");
  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByTestId("picked-label")).toBeVisible();
  await page.getByLabel("Instagram").fill("@patinhasrascunho");
  // Sede institucional autorizada: a marcação precisa sobreviver ao login (não publica nada sozinha).
  const consent = page.getByRole("checkbox", { name: /endereço institucional .* autorizo/ });
  await consent.check();
  await page.getByLabel("Endereço como aparece no perfil").fill("Rua Fictícia da Sede, 200 – Sé");
  await page.getByRole("checkbox", { name: /Li e aceito as regras do programa/ }).check();
  await page.getByRole("button", { name: "Enviar para moderação" }).click();

  // Login com o contexto de parceiro (não a tela genérica).
  await expect(page).toHaveURL(/\/entrar\?next=%2Fparceiros%23cadastro&contexto=parceiro/);
  await expect(page.getByRole("heading", { name: "Crie sua conta para enviar a inscrição da sua organização" })).toBeVisible();
  await page.getByRole("tab", { name: "Entrar" }).click();
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // De volta à inscrição, preenchida.
  await expect(page).toHaveURL(/\/parceiros#cadastro$/, { timeout: 30_000 });
  await expect(page.getByText("Recuperamos sua inscrição.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^ONG/ })).toBeChecked();
  await expect(page.getByLabel("Nome da ONG")).toHaveValue("Patinhas Rascunho");
  await expect(page.getByRole("checkbox", { name: /endereço institucional .* autorizo/ })).toBeChecked();
  await expect(page.getByLabel("Endereço como aparece no perfil")).toHaveValue("Rua Fictícia da Sede, 200 – Sé");
});
