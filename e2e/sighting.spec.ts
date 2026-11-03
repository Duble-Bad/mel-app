import { expect, test, type Page } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { mockGeocoding, SE } from "./support/geo";
import { deleteUserByEmail, TEST_PASSWORD } from "./support/users";

test.use({ geolocation: SE, permissions: ["geolocation"] });

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

async function signInAs(page: Page, email: string, next: string) {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[/]/g, "\\/")));
}

test("a visitor WITHOUT an account reports a sighting; the tutor sees it live, on the timeline and on the map", async ({
  browser,
  page: tutorPage,
}) => {
  // Dois navegadores, login, mapa, captcha e tempo real: mais que os 30 s padrão.
  test.setTimeout(90_000);
  const tutor = await createTutorWithActiveAlert("sight-e2e");
  created.push(tutor.email);
  const alertPath = `/alerta/${tutor.code}`;

  // Tutor está com o alerta aberto. Notificações "ainda não decididas", como num celular
  // novo: o Chromium sem interface sempre responde "denied" (e aí o convite não aparece).
  await tutorPage.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "default" }));
  await signInAs(tutorPage, tutor.email, alertPath);
  await expect(tutorPage.getByText("Ainda não há avistamentos.")).toBeVisible();
  await expect(tutorPage.getByRole("link", { name: /Eu vi este pet/i })).toHaveCount(0); // não para o próprio tutor
  // Convite para avisos no celular: só com um toque do tutor; "Agora não" não atrapalha nada.
  const pushPrompt = tutorPage.getByTestId("tutor-push");
  await expect(pushPrompt).toContainText("Receber avisos no celular");
  await pushPrompt.getByRole("button", { name: "Agora não" }).click();
  await expect(pushPrompt).toHaveCount(0);

  // Visitante: navegador limpo, sem conta.
  const ctx = await browser.newContext({
    baseURL: "http://localhost:3100",
    geolocation: SE,
    permissions: ["geolocation"],
    ...test.info().project.use,
  });
  const visitor = await ctx.newPage();
  await mockGeocoding(visitor);
  await visitor.goto(alertPath);
  await visitor.getByRole("link", { name: /Eu vi este pet/i }).click();
  await expect(visitor.getByRole("heading", { name: "Você viu Mel?" })).toBeVisible();
  // Privacidade de quem ajuda: marcar o pet, não a própria casa.
  await expect(visitor.getByText("Marque onde o pet estava, não onde você está.")).toBeVisible();
  await expect(visitor.getByText("Use só se você estiver no lugar onde viu o pet.")).toBeVisible();
  await expect(visitor.getByText("O ponto exato fica só com o tutor do alerta.", { exact: false })).toBeVisible();
  await expect(visitor.getByText(/Não escreva seu endereço, número da casa, apartamento/)).toBeVisible();

  await visitor.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(visitor.getByTestId("picked-label")).toContainText("perto de Rua Santa Teresa");
  await visitor.getByRole("radio", { name: "Agora" }).check({ force: true });
  await visitor.getByRole("radio", { name: /Norte/ }).check({ force: true });
  await visitor.getByRole("checkbox", { name: "Correndo" }).check({ force: true });
  await visitor.getByRole("checkbox", { name: "Assustado" }).check({ force: true });
  await visitor.getByLabel(/Mais alguma coisa/).fill("Entrou na rua de trás da igreja.");
  await visitor.getByRole("button", { name: /Enviar avistamento/i }).click();

  await expect(visitor.getByText("O tutor já foi avisado.")).toBeVisible({ timeout: 30_000 });
  await expect(visitor.getByText("Não precisa criar conta.")).toHaveCount(0);

  // Tutor: aviso em tempo real, sininho e linha do tempo atualizada sem recarregar.
  await expect(tutorPage.getByRole("status").filter({ hasText: "Novo avistamento de Mel" })).toBeVisible({ timeout: 20_000 });
  await expect(tutorPage.getByTestId("timeline-sighting")).toHaveCount(1);
  await expect(tutorPage.getByTestId("timeline-sighting")).toContainText("Correndo, assustado · seguia para o Norte");
  await expect(tutorPage.getByTestId("timeline-sighting")).toContainText("Entrou na rua de trás da igreja.");
  // ≥ 1: o Radar MEL pode somar avisos de outros testes rodando em paralelo na mesma região.
  await expect(tutorPage.getByTestId("unread-count")).toHaveText(/^[1-9]/);

  // Mapa com o ponto do avistamento ligado ao último local conhecido — exato para o tutor.
  await expect(tutorPage.getByRole("button", { name: /Avistamento: avistamento 1/ })).toBeVisible();
  await expect(tutorPage.getByText(/ligados por linha tracejada em ordem de horário\.$/)).toBeVisible();

  // Outra pessoa (sem sessão): o mesmo avistamento, em localização aproximada.
  const strangerCtx = await browser.newContext({ baseURL: "http://localhost:3100", ...test.info().project.use });
  const stranger = await strangerCtx.newPage();
  await stranger.goto(alertPath);
  await expect(stranger.getByTestId("timeline-sighting")).toHaveCount(1);
  await expect(stranger.getByText(/\(localização aproximada\)/)).toBeVisible();
  await strangerCtx.close();

  // Visitante volta ao alerta e vê a pista publicada.
  await visitor.getByRole("link", { name: "Ver o alerta e a linha do tempo" }).click();
  await expect(visitor.getByTestId("timeline-sighting")).toContainText("Correndo, assustado");

  // O aviso flutuante fecha (e sumiria sozinho em 8 s) sem cobrir a página.
  await tutorPage.getByRole("button", { name: "Fechar" }).click();
  await expect(tutorPage.getByRole("status").filter({ hasText: "Novo avistamento de Mel" })).toHaveCount(0);

  // Tutor oculta (ex.: engano) — some para o público.
  await tutorPage.getByRole("button", { name: /Ocultar/ }).click();
  await expect(tutorPage.getByText("Oculto — só você vê.")).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByTestId("timeline-sighting")).toHaveCount(0);

  // Central de notificações.
  await tutorPage.goto("/notificacoes");
  await expect(tutorPage.getByText("🟡 Novo avistamento de Mel")).toBeVisible();
  await ctx.close();
});

test("the sighting form explains what is missing", async ({ page }) => {
  const tutor = await createTutorWithActiveAlert("sight-validate", "Luna");
  created.push(tutor.email);
  await mockGeocoding(page);
  await page.goto(`/avistamento/${tutor.code}`);
  await page.getByRole("button", { name: /Enviar avistamento/i }).click();
  await expect(page.getByText("Marque onde você viu o pet (use o GPS ou o mapa).")).toBeVisible();
  await expect(page.getByText("Diga quando você viu.")).toBeVisible();
});

test("the server refuses sightings without the anti-robot check", async ({ request }) => {
  const tutor = await createTutorWithActiveAlert("sight-captcha", "Nina");
  created.push(tutor.email);
  const res = await request.post("/api/avistamentos", {
    data: { code: tutor.code, position: { lat: SE.latitude, lng: SE.longitude }, seenAt: new Date().toISOString() },
  });
  expect(res.status()).toBe(403);
  expect((await res.json()).error).toMatch(/não é um robô/);
});
