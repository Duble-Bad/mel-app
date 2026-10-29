import { expect, test } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { mockGeocoding } from "./support/geo";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

// Região própria (Rio de Janeiro): outros testes criam alertas na Sé e poderiam
// esgotar o limite diário de avisos deste Guardião.
const RIO = { latitude: -22.9068, longitude: -43.1729 };
test.use({ geolocation: RIO, permissions: ["geolocation"] });

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

test("becoming a Guardian: choose area/radius, then an alert activated nearby shows up in the notifications", async ({ page }) => {
  test.setTimeout(120_000);
  await mockGeocoding(page);
  const user = await createUser("guardian-e2e", { onboarded: true });
  created.push(user.email);

  // /guardiao exige conta: passa pelo login.
  await page.goto("/guardiao");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fguardiao/);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Seja um Guardião MEL" })).toBeVisible();

  // Sem área: explica o que falta.
  await page.getByRole("button", { name: "Quero ser Guardião" }).click();
  await expect(page.getByText("Escolha a área que você quer proteger.")).toBeVisible();

  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByTestId("picked-label")).toContainText("perto de");
  await page.getByRole("button", { name: "1 km" }).click();
  await expect(page.getByRole("button", { name: "1 km" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "10 avisos" }).click();
  // Pelo menos um tipo de aviso.
  await page.getByRole("switch", { name: "Pets perdidos" }).click();
  await page.getByRole("switch", { name: "Encontrados e vistos soltos" }).click();
  await page.getByRole("button", { name: "Quero ser Guardião" }).click();
  await expect(page.getByText("Escolha pelo menos um tipo de aviso.")).toBeVisible();
  await page.getByRole("switch", { name: "Pets perdidos" }).click();
  await expect(page.getByRole("switch", { name: "Pets perdidos" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Quero ser Guardião" }).click();
  await expect(page.getByText("Pronto! Você é um Guardião MEL.")).toBeVisible();

  // Recarregar mostra as preferências salvas.
  await page.reload();
  await expect(page.getByRole("switch", { name: "Guardião ativo" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "1 km" })).toHaveAttribute("aria-pressed", "true");
  // Avisos no celular: o cartão sempre explica o estado deste aparelho (nunca fica vazio).
  await expect(page.getByRole("heading", { name: "Avisos no celular" })).toBeVisible();
  await expect(page.getByText("Verificando este aparelho…")).toHaveCount(0);

  // Um tutor ativa um alerta a ~300 m: o Guardião é avisado.
  const tutor = await createTutorWithActiveAlert("guardian-tutor", {
    petName: "Cacau",
    at: { lat: RIO.latitude + 0.002, lng: RIO.longitude + 0.001, label: "Centro, Rio de Janeiro – RJ" },
  });
  created.push(tutor.email);
  await page.goto("/notificacoes");
  const n = page.getByRole("link", { name: /Pet perdido perto de você: Cacau/ });
  await expect(n).toBeVisible();
  await n.click();
  await expect(page).toHaveURL(new RegExp(`/alerta/${tutor.code}$`));
});

test("the push dispatcher refuses visitors without a session", async ({ request }) => {
  const res = await request.post("/api/push/dispatch");
  expect(res.status()).toBe(401);
});
