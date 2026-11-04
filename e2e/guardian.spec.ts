import { expect, test } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { mockGeocoding, keepGeolocation } from "./support/geo";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

// Região própria (Rio de Janeiro): outros testes criam alertas na Sé e poderiam
// esgotar o limite diário de avisos deste Guardião.
const RIO = { latitude: -22.9068, longitude: -43.1729 };
test.use({ geolocation: RIO, permissions: ["geolocation"] });
test.beforeEach(({ page }) => keepGeolocation(page, RIO));

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

test.describe("scheduler (Vercel Cron: GET with Authorization: Bearer)", () => {
  // Segredo desta execução (playwright.config.ts); o servidor de teste não tem a
  // chave VAPID privada: autorizado responde 503 "push desativado", sem push real.
  const secret = process.env.MEL_E2E_SCHEDULER_SECRET!;
  const bearer = { Authorization: `Bearer ${secret}` };

  test("GET without the secret, with a wrong one, or with the secret in the URL is refused", async ({ request }) => {
    for (const res of await Promise.all([
      request.get("/api/push/dispatch"),
      request.get("/api/push/dispatch", { headers: { Authorization: `Bearer ${secret}x` } }),
      request.get("/api/push/dispatch", { headers: { Authorization: "Bearer " } }),
      request.get(`/api/push/dispatch?secret=${secret}`),
      request.get(`/api/push/dispatch?token=${secret}&authorization=Bearer%20${secret}`),
    ])) {
      expect(res.status()).toBe(401);
      expect(await res.text()).not.toContain(secret);
    }
  });

  test("GET and POST with the secret run the job; repeated and simultaneous runs are fine", async ({ request }) => {
    const runs = await Promise.all([
      request.get("/api/push/dispatch", { headers: bearer }),
      request.get("/api/push/dispatch", { headers: bearer }),
      request.post("/api/push/dispatch", { headers: bearer }),
    ]);
    runs.push(await request.get("/api/push/dispatch", { headers: bearer }));
    for (const res of runs) {
      expect(res.status()).toBe(503);
      expect(res.headers()["cache-control"]).toBe("no-store");
      const body = await res.json();
      expect(body).toMatchObject({ sent: 0, disabled: expect.stringContaining("VAPID") });
      // A faxina de fotos órfãs rodou (número) ou falhou sem derrubar o push (null).
      expect(body).toHaveProperty("orphansRemoved");
      expect(JSON.stringify(body)).not.toContain(secret);
    }
  });

  test("a logged-in session does not authorize GET (a link elsewhere can't trigger it)", async ({ page }) => {
    const user = await createUser("sched-get", { onboarded: true });
    created.push(user.email);
    await page.goto("/entrar?next=/perfil");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/perfil");
    // Chamadas de dentro da página logada, como o app faz.
    const call = (method: string) =>
      page.evaluate(async (m) => {
        const res = await fetch("/api/push/dispatch", { method: m });
        return { status: res.status, body: await res.json() };
      }, method);
    // POST com sessão continua disparando o push (sem faxina).
    const post = await call("POST");
    expect(post.status).toBe(503);
    expect(post.body).not.toHaveProperty("orphansRemoved");
    expect((await call("GET")).status).toBe(401);
  });
});
