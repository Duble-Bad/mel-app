import { expect, test } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

// Nada técnico pode chegar à tela: nem a mensagem de RLS, nem tabela, código ou stack.
const TECHNICAL = /row-level|security policy|violates|found_cases|42501|PGRST|stack|Error:|at \w+ \(/i;

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

test("a page that fails to load shows a friendly screen, and 'Tentar novamente' recovers it", async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.addCookies([{ name: "mel-dev-erro", value: "1", url: "http://localhost:3100" }]);
  await page.goto("/dev/erro");

  const heading = page.getByRole("heading", { name: "Não conseguimos carregar esta página" });
  await expect(heading).toBeVisible({ timeout: 45_000 });
  await expect(heading).toBeFocused();
  await expect(page.getByRole("link", { name: "MEL — início" }).first()).toBeVisible(); // o cabeçalho do app continua
  await expect(page.getByRole("link", { name: "Voltar para o início" })).toHaveAttribute("href", "/");
  expect(await page.locator("body").innerText()).not.toMatch(TECHNICAL);

  // A causa passou: tentar de novo recarrega o trecho e a página aparece.
  await context.clearCookies({ name: "mel-dev-erro" });
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Página carregada" })).toBeVisible();
});

test("an action that fails with a raw RLS error shows a friendly inline message and the page stays up", async ({ page }) => {
  test.setTimeout(120_000);
  const tutor = await createTutorWithActiveAlert("err-inline", { petName: "Biscoito" });
  created.push(tutor.email);
  const visitor = await createUser("err-visitor", { onboarded: true });
  created.push(visitor.email);

  await page.goto(`/entrar?next=${encodeURIComponent(`/alerta/${tutor.code}`)}`);
  await page.getByLabel("E-mail").fill(visitor.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Biscoito", level: 1 })).toBeVisible({ timeout: 60_000 });

  // O Supabase responde exatamente como numa violação de RLS.
  await page.route("**/rest/v1/rpc/report_content", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ code: "42501", details: null, hint: null, message: 'new row violates row-level security policy for table "found_cases"' }),
    }),
  );

  await page.getByRole("button", { name: "Denunciar" }).click();
  const sheet = page.getByRole("dialog", { name: "Denunciar este alerta" });
  await sheet.getByText("Pediu dinheiro ou parece golpe").click();
  await sheet.getByRole("button", { name: "Enviar denúncia" }).click();

  await expect(sheet.getByText("Você não tem permissão para fazer isso.")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(TECHNICAL);
  // Erro na ação, não na página: o alerta continua na tela e o formulário pode ser reenviado.
  await expect(page.getByRole("heading", { name: "Biscoito", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Não conseguimos carregar esta página" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Enviar denúncia" })).toBeEnabled();
});
