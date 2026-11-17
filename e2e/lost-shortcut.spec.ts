import { expect, test } from "@playwright/test";
import { createTutorWithPet } from "./support/alerts";
import { deleteUserByEmail, TEST_PASSWORD } from "./support/users";

// Atalho "Ele está desaparecido? Publicar alerta" (decisão do proprietário, 2026-11-17):
// no aviso de pet cadastrado e na página do pet; abre "Perdi meu pet" com o pet já escolhido.
const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

test("from the pet page, 'Ele está desaparecido?' opens the lost alert with the pet already chosen", async ({ page }) => {
  test.setTimeout(120_000);
  const t = await createTutorWithPet("atalho-alerta", "Atalho");
  created.push(t.email);
  await page.goto(`/entrar?next=${encodeURIComponent(`/perfil/pets/${t.petId}?novo=1`)}`);
  await page.getByLabel("E-mail").fill(t.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Logo depois do cadastro: o aviso já oferece o atalho; no topo, o botão.
  await expect(page.getByRole("link", { name: "Ele está desaparecido agora? Publicar alerta" })).toBeVisible({ timeout: 30_000 });
  const action = page.getByTestId("pet-lost-action");
  await expect(action).toHaveText("Ele está desaparecido? Publicar alerta");
  await action.click();

  // Pula o passo do pet: já começa em "Onde", com o pet escolhido.
  await expect(page).toHaveURL(new RegExp(`/publicar/perdido\\?pet=${t.petId}$`));
  await expect(page.getByRole("heading", { name: "Onde ele foi visto pela última vez?" })).toBeVisible({ timeout: 30_000 });
  // O passo do pet já aparece concluído no indicador.
  await expect(page.getByTestId("etapa-1")).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("etapa-2")).toHaveAttribute("data-state", "current");

  // Rascunho criado: a página do pet passa a oferecer continuar.
  await page.goto(`/perfil/pets/${t.petId}`);
  await expect(page.getByTestId("pet-lost-action")).toHaveText("Continuar o alerta de desaparecido");
});
