import { expect, test, type Page } from "@playwright/test";
import { solidPng } from "./support/png";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

// O navegador precisa decodificar a imagem para redimensioná-la.
const PNG = solidPng();

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

async function signIn(page: Page, label: string) {
  const user = await createUser(label, { onboarded: true });
  created.push(user.email);
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  return user;
}

test("tutor registers a pet with photo, private details and a MEL ID", async ({ page }) => {
  await signIn(page, "pet-create");

  await expect(page.getByText("Nenhum pet cadastrado ainda")).toBeVisible();
  await page.getByRole("link", { name: "Cadastrar meu pet" }).click();

  await page.locator('input[type="file"]').setInputFiles({ name: "mel.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("Nome").fill("Mel");
  await page.getByRole("radio", { name: "Cachorro" }).check({ force: true });
  await page.getByRole("radio", { name: "Fêmea" }).check({ force: true });
  await page.getByRole("radio", { name: /Mini/ }).check({ force: true });
  // Lista com busca: digitar parte do nome e escolher a opção.
  await page.getByRole("combobox", { name: /^Raça/ }).fill("york");
  await page.getByRole("option", { name: "Yorkshire Terrier" }).click();
  await expect(page.getByRole("combobox", { name: /^Raça/ })).toHaveValue("Yorkshire Terrier");
  await page.getByRole("group", { name: /Cor principal/ }).getByRole("radio", { name: "Caramelo" }).check({ force: true });
  await page.getByLabel("Peso aproximado (kg)").fill("2,8");
  await page.getByLabel("Sinais que só você conhece").fill("Mancha clara na barriga (teste)");
  await page.getByLabel(/Deixar a página do pet visível/).check();
  await page.getByRole("button", { name: "Cadastrar pet" }).click();

  await expect(page.getByText("Mel está cadastrado(a) na MEL.")).toBeVisible({ timeout: 20_000 });
  const melId = (await page.getByText(/^MEL-[A-Z0-9]{6}$/).first().textContent())!;
  expect(melId).toMatch(/^MEL-/);
  await expect(page.getByText("Principal", { exact: true })).toBeVisible();

  // Página pública mostra o que é público e nunca os dados privados.
  await page.getByRole("link", { name: /Ver página do pet/ }).click();
  await expect(page).toHaveURL(new RegExp(`/pet/${melId}$`));
  // O Next 16 mantém a tela anterior (edição, com os campos privados do próprio
  // dono) escondida no DOM para o "voltar". Recarregar isola a página pública.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mel", level: 1 })).toBeVisible();
  await expect(page.getByText("Cachorro · Yorkshire Terrier · Fêmea · Mini")).toBeVisible();
  await expect(page.getByText("2,8 kg")).toBeVisible();
  await expect(page.getByRole("img", { name: "Foto de Mel" })).toBeVisible();
  await expect(page.getByText("Mancha clara na barriga")).toHaveCount(0);

  // O HTML entregue a um visitante não contém nada privado.
  const html = await (await page.request.fetch(`/pet/${melId}`, { headers: { cookie: "" } })).text();
  expect(html).toContain("Yorkshire");
  expect(html).not.toContain("Mancha clara na barriga");

  // Visitante sem sessão também vê (pet público) e continua sem dados privados.
  const visitor = await page.context().browser()!.newPage();
  await visitor.goto(`/pet/${melId}`);
  await expect(visitor.getByRole("heading", { name: "Mel", level: 1 })).toBeVisible();
  await expect(visitor.getByText("Mancha clara na barriga")).toHaveCount(0);
  await visitor.close();
});

test("required fields are explained and private pets are hidden from visitors", async ({ page, browser }) => {
  await signIn(page, "pet-private");
  await page.goto("/perfil/pets/novo");

  await page.getByRole("button", { name: "Cadastrar pet" }).click();
  await expect(page.getByText("Qual é o nome do seu pet?")).toBeVisible();
  await expect(page.getByText("Escolha cachorro, gato ou outro.")).toBeVisible();

  await page.getByLabel("Nome").fill("Thor");
  await page.getByRole("radio", { name: "Cachorro" }).check({ force: true });
  await page.getByRole("button", { name: "Cadastrar pet" }).click();
  await expect(page.getByText("Thor está cadastrado(a) na MEL.")).toBeVisible();
  const melId = (await page.getByText(/^MEL-[A-Z0-9]{6}$/).first().textContent())!;

  // Dono vê a própria página com aviso; visitante recebe "não encontrada".
  await page.goto(`/pet/${melId}`);
  await expect(page.getByText("Só você vê esta página.")).toBeVisible();

  const visitor = await browser.newPage();
  await visitor.goto(`http://localhost:3100/pet/${melId}`);
  await expect(visitor.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();
  await visitor.close();
});

test("tutor edits a pet and then deletes it after confirming", async ({ page }) => {
  await signIn(page, "pet-edit");
  await page.goto("/perfil/pets/novo");
  await page.getByLabel("Nome").fill("Nina");
  await page.getByRole("radio", { name: "Gato" }).check({ force: true });
  await page.getByRole("button", { name: "Cadastrar pet" }).click();
  await expect(page.getByText("Nina está cadastrado(a) na MEL.")).toBeVisible();

  // "Sem raça definida" fica fixa no topo da lista.
  await page.getByRole("combobox", { name: /^Raça/ }).click();
  await page.getByRole("option", { name: "Sem raça definida (SRD)" }).click();
  await page.getByRole("radio", { name: /Pequeno/ }).check({ force: true });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^Raça/ })).toHaveValue("Sem raça definida (SRD)");

  await page.goto("/perfil");
  await expect(page.getByText("Gato · SRD · Pequeno")).toBeVisible();

  await page.getByRole("link", { name: /Nina/ }).click();
  await page.getByRole("button", { name: "Excluir Nina da MEL" }).click();
  await page.getByRole("button", { name: "Sim, excluir" }).click();
  await expect(page).toHaveURL(/\/perfil\?pet_removido=1/);
  await expect(page.getByText("Pet excluído.")).toBeVisible();
  await expect(page.getByText("Nenhum pet cadastrado ainda")).toBeVisible();
});

test("unknown or malformed MEL IDs show a friendly not-found page", async ({ page }) => {
  for (const id of ["MEL-ZZZZZZ", "qualquer-coisa"]) {
    await page.goto(`/pet/${id}`);
    await expect(page.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();
  }
});
