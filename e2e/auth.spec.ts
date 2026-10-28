import { expect, test } from "@playwright/test";
import { createUser, deleteUserByEmail, TEST_PASSWORD, testEmail } from "./support/users";

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

test("new person signs up, completes onboarding and sees their profile", async ({ page }) => {
  const email = testEmail("signup");
  created.push(email);

  await page.goto("/");
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Ana Exemplo");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  // O nome do cadastro já vem preenchido.
  await expect(page.getByLabel("Como podemos te chamar?")).toHaveValue("Ana Exemplo");
  await page.getByLabel("Cidade").fill("Campinas");
  await page.getByLabel("Estado").selectOption("SP");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByRole("heading", { name: "Ana Exemplo" })).toBeVisible();
  await expect(page.getByText("Campinas, São Paulo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Olá, Ana" })).toBeVisible();
});

test("onboarding explains what is missing instead of failing silently", async ({ page }) => {
  const user = await createUser("onb-errors");
  created.push(user.email);

  await page.goto("/entrar?next=/perfil");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Conte pra gente como podemos te chamar.")).toBeVisible();
  await expect(page.getByText("Qual é a sua cidade?")).toBeVisible();
  await expect(page.getByText("Escolha o seu estado.")).toBeVisible();
});

test("returning person signs in and goes back to where they were", async ({ page }) => {
  const user = await createUser("login", { onboarded: true });
  created.push(user.email);

  await page.goto("/perfil/editar");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fperfil%2Feditar/);

  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/perfil\/editar$/);
  await expect(page.getByLabel("Como podemos te chamar?")).toHaveValue("Bia Teste");
});

test("wrong password shows a human message", async ({ page }) => {
  const user = await createUser("wrongpass", { onboarded: true });
  created.push(user.email);

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("E-mail ou senha não conferem")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});

test("signed-in person edits the profile and signs out", async ({ page }) => {
  const user = await createUser("edit", { onboarded: true });
  created.push(user.email);

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/perfil$/);

  await page.getByRole("link", { name: "Editar perfil" }).click();
  await page.getByLabel("Cidade").fill("Jundiaí");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Jundiaí, São Paulo")).toBeVisible();

  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/entrar/);
});

test("a failed social login is never silent", async ({ page }) => {
  // Formato real devolvido pelo Supabase quando o estado do OAuth expira.
  await page.goto("/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired");
  await expect(page).toHaveURL(/\/entrar\?erro=bad_oauth_state/);
  await expect(page.getByText("O login com Google demorou mais que o esperado e expirou.")).toBeVisible();

  await page.goto("/auth/callback?error=access_denied");
  await expect(page.getByText("O login com Google foi cancelado.")).toBeVisible();
});

test("protected pages redirect visitors to sign in", async ({ page }) => {
  for (const path of ["/perfil", "/onboarding"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/entrar\\?next=${encodeURIComponent(path)}`));
  }
});

test("open redirects through ?next= are blocked", async ({ page }) => {
  const user = await createUser("redirect", { onboarded: true });
  created.push(user.email);

  await page.goto("/entrar?next=https://exemplo-malicioso.com");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/perfil$/);
});

test("sign-in screen: no errors before interaction, eye icon for the password, name on sign up", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Bem-vindo à MEL" })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0); // tela cheia, sem o cabeçalho do app

  // Tocar nos campos e sair sem digitar não deixa nada vermelho.
  await page.getByLabel("E-mail").click();
  await page.getByLabel("Senha", { exact: true }).click();
  await page.getByRole("heading", { name: "Bem-vindo à MEL" }).click();
  await expect(page.locator("[aria-invalid=true]")).toHaveCount(0);

  // Erro aparece ao sair de um campo preenchido errado, e some ao corrigir.
  await page.getByLabel("E-mail").fill("ana@");
  await page.getByLabel("Senha", { exact: true }).click();
  await expect(page.getByText("Confira o e-mail.")).toBeVisible();
  await page.getByLabel("E-mail").fill("ana@exemplo.com");
  await expect(page.getByText("Confira o e-mail.")).toHaveCount(0);

  // Olho dentro do campo mostra/oculta a senha.
  const password = page.getByLabel("Senha", { exact: true });
  await password.fill("segredo123");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await expect(password).toHaveAttribute("type", "password");

  // Criar conta pede o nome; enviar sem ele explica o que falta e foca o campo.
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await expect(page.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Conte pra gente como podemos te chamar.")).toBeVisible();
  await expect(page.getByLabel("Seu nome")).toBeFocused();
});
