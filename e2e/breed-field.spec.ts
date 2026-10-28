import { expect, test, type Page } from "@playwright/test";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

async function openNewPetForm(page: Page, label: string) {
  const user = await createUser(label, { onboarded: true });
  created.push(user.email);
  await page.goto("/entrar?next=/perfil/pets/novo");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/perfil\/pets\/novo$/);
}

const breed = (page: Page) => page.getByRole("combobox", { name: /^Raça/ });
// Só as opções da lista de raças (selects nativos da página também têm role "option").
const breedOptions = (page: Page) => page.getByRole("listbox", { name: /^Raça/ }).getByRole("option");
const pickSpecies = (page: Page, name: string) => page.getByRole("radio", { name }).check({ force: true });

test("breed is disabled until a species is chosen", async ({ page }) => {
  await openNewPetForm(page, "breed-disabled");
  const field = page.getByRole("textbox", { name: /^Raça/ });
  await expect(field).toBeDisabled();
  await expect(field).toHaveAttribute("placeholder", "Escolha a espécie primeiro");
});

test("dog list: SRD pinned first, accent-insensitive search, tap to choose", async ({ page }) => {
  await openNewPetForm(page, "breed-search");
  await pickSpecies(page, "Cachorro");

  await breed(page).click();
  const options = breedOptions(page);
  await expect(options.first()).toHaveText("Sem raça definida (SRD)");
  expect(await options.count()).toBeGreaterThan(200);

  await breed(page).fill("sao bern");
  await expect(options).toHaveText(["São Bernardo"]);

  // Toque real (Pixel 7 tem tela de toque), não clique de mouse.
  await breedOptions(page).filter({ hasText: "São Bernardo" }).tap();
  await expect(breed(page)).toHaveValue("São Bernardo");
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("keyboard: arrows move, Enter chooses, Escape cancels", async ({ page }) => {
  await openNewPetForm(page, "breed-keyboard");
  await pickSpecies(page, "Cachorro");

  await breed(page).focus();
  await page.keyboard.press("ArrowDown"); // da opção SRD para a primeira raça
  const activeId = await breed(page).getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${activeId}"]`)).toHaveText("Affenpinscher");
  await page.keyboard.press("Enter");
  await expect(breed(page)).toHaveValue("Affenpinscher");

  await breed(page).fill("york");
  await page.keyboard.press("Enter");
  await expect(breed(page)).toHaveValue("Yorkshire Terrier");

  await breed(page).fill("lab");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(breed(page)).toHaveValue("Yorkshire Terrier");
});

test("typed text is never discarded silently when leaving the field", async ({ page }) => {
  await openNewPetForm(page, "breed-blur");
  await pickSpecies(page, "Cachorro");

  // Texto igual a uma opção (sem acento/maiúscula) é aceito ao sair do campo.
  await breed(page).fill("sao bernardo");
  await page.getByLabel("Nome").click();
  await expect(breed(page)).toHaveValue("São Bernardo");

  // Texto fora da lista: avisa e mantém a escolha anterior.
  await breed(page).fill("Labradoodle");
  await page.getByLabel("Nome").click();
  await expect(page.getByText("“Labradoodle” não está na lista. Escolha uma das opções.")).toBeVisible();
  await expect(breed(page)).toHaveValue("São Bernardo");

  // Sem nenhum resultado, a lista explica o que fazer.
  await breed(page).fill("xyzabc");
  await expect(page.getByText(/Não encontramos essa raça/)).toBeVisible();
});

test("clear button empties the breed", async ({ page }) => {
  await openNewPetForm(page, "breed-clear");
  await pickSpecies(page, "Cachorro");
  await breed(page).fill("pug");
  await page.keyboard.press("Enter");
  await expect(breed(page)).toHaveValue("Pug");

  await page.getByRole("button", { name: "Limpar" }).click();
  await expect(breed(page)).toHaveValue("");
});

test("switching species clears an incompatible breed and swaps the list", async ({ page }) => {
  await openNewPetForm(page, "breed-species");
  await pickSpecies(page, "Cachorro");
  await breed(page).fill("york");
  await page.keyboard.press("Enter");
  await expect(breed(page)).toHaveValue("Yorkshire Terrier");

  await pickSpecies(page, "Gato");
  await expect(breed(page)).toHaveValue("");
  await breed(page).fill("persa");
  await expect(breedOptions(page).filter({ hasText: "Persa" })).toBeVisible();
  await breed(page).fill("yorkshire");
  await expect(breedOptions(page)).toHaveCount(0);

  // SRD vale para as duas espécies e é mantido na troca.
  await breed(page).fill("");
  await breedOptions(page).filter({ hasText: "Sem raça definida (SRD)" }).click();
  await pickSpecies(page, "Cachorro");
  await expect(breed(page)).toHaveValue("Sem raça definida (SRD)");
});

test("'Outro' uses free text and saves it", async ({ page }) => {
  await openNewPetForm(page, "breed-other");
  await page.getByLabel("Nome").fill("Piu");
  await pickSpecies(page, "Outro");
  await page.getByRole("textbox", { name: /^Raça ou tipo/ }).fill("Calopsita");
  await page.getByRole("button", { name: "Cadastrar pet" }).click();
  await expect(page.getByText("Piu está cadastrado(a) na MEL.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Raça ou tipo/ })).toHaveValue("Calopsita");
});
