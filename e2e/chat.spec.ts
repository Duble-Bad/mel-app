import { expect, test, type Browser, type Page } from "@playwright/test";
import { anonymousSighting, createTutorWithActiveAlert } from "./support/alerts";
import { deleteUserByEmail, deleteUserById, TEST_PASSWORD } from "./support/users";

const createdEmails: string[] = [];
const createdIds: string[] = [];
test.afterAll(async () => {
  for (const email of createdEmails) await deleteUserByEmail(email);
  for (const id of createdIds) await deleteUserById(id);
});

async function signInAs(page: Page, email: string, next: string) {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[/]/g, "\\/")));
}

/** Navegador limpo, sem conta (mesmo celular simulado do projeto). */
async function freshVisitor(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100", ...test.info().project.use });
  return { ctx, page: await ctx.newPage() };
}

const composer = (page: Page) => page.getByLabel("Mensagem", { exact: true });
const messages = (page: Page) => page.getByTestId("chat-message");

test("a visitor WITHOUT an account talks to the tutor in real time; no phone is shown; scam warnings appear", async ({
  browser,
  page: tutorPage,
}) => {
  test.setTimeout(120_000);
  const tutor = await createTutorWithActiveAlert("chat-e2e", { petName: "Mel", withPhoto: true });
  createdEmails.push(tutor.email);

  // Visitante abre o alerta e conversa sem criar conta.
  const { ctx, page: visitor } = await freshVisitor(browser);
  await visitor.goto(`/alerta/${tutor.code}`);
  await visitor.getByRole("link", { name: /Conversar com o tutor/ }).click();
  await expect(visitor.getByRole("heading", { name: "Conversar com o tutor de Mel" })).toBeVisible();
  await expect(visitor.getByTestId("anti-scam")).toContainText("A MEL nunca pede pagamento");

  // Mensagem vazia explica o que falta.
  await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(visitor.getByText("Escreva uma mensagem.")).toBeVisible();

  await visitor.getByLabel("Sua mensagem").fill("Oi! Acho que vi a Mel perto da padaria da Rua Direita.");
  await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(visitor).toHaveURL(/\/conversas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const conversationPath = new URL(visitor.url()).pathname;
  await expect(visitor.getByRole("heading", { name: "Tutor(a) de Mel" })).toBeVisible();
  await expect(messages(visitor)).toHaveCount(1);
  await expect(visitor.getByTestId("anti-scam")).toBeVisible();
  await expect(visitor.getByText(/Você está sem cadastro/)).toBeVisible();

  // Voltar ao alerta e tocar de novo em "Conversar" retoma a mesma conversa.
  await visitor.goto(`/alerta/${tutor.code}/conversar`);
  await expect(visitor).toHaveURL(new RegExp(`${conversationPath}$`));

  // Tutor: notificação, lista com não lida, conversa aberta.
  await signInAs(tutorPage, tutor.email, "/notificacoes");
  await expect(tutorPage.getByText("💬 Mensagem sobre Mel")).toBeVisible();
  await tutorPage.goto("/conversas");
  const item = tutorPage.getByTestId("conversation-item");
  await expect(item).toContainText("Visitante sem cadastro");
  await expect(item).toContainText("Oi! Acho que vi a Mel");
  await expect(item).toContainText("1 não lida");
  await item.click();
  await expect(tutorPage).toHaveURL(new RegExp(`${conversationPath}$`));
  await expect(messages(tutorPage)).toHaveCount(1);

  // Tutor responde → visitante recebe sem recarregar.
  await composer(tutorPage).fill("Obrigada!! Ela estava indo para onde?");
  await tutorPage.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(composer(tutorPage)).toHaveValue("");
  await expect(messages(visitor)).toHaveCount(2, { timeout: 20_000 });
  await expect(messages(visitor).last()).toContainText("Ela estava indo para onde?");

  // Visitante pede dinheiro → o tutor vê o alerta de golpe junto da mensagem, em tempo real.
  await composer(visitor).fill("Estou com ela. Manda um PIX de R$ 200 que eu levo.");
  await visitor.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(messages(tutorPage)).toHaveCount(3, { timeout: 20_000 });
  await expect(tutorPage.getByTestId("payment-warning")).toContainText("Nunca pague antes de ver o animal");
  // Quem escreveu não vê o aviso sobre a própria mensagem.
  await expect(visitor.getByTestId("payment-warning")).toHaveCount(0);

  // Nenhum telefone em lugar nenhum da conversa.
  for (const page of [visitor, tutorPage]) {
    await expect(page.getByRole("main")).not.toContainText(/\(\d{2}\) 9?\d{4}-\d{4}/);
  }

  // Denúncia em 1 toque (bloqueia junto) → o visitante não consegue mais enviar.
  await tutorPage.getByRole("button", { name: "Denunciar" }).click();
  const dialog = tutorPage.getByRole("dialog", { name: "Denunciar" });
  await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(dialog.getByText("Escolha o motivo da denúncia.")).toBeVisible();
  await dialog.getByRole("radio", { name: "Pediu dinheiro ou parece golpe" }).check({ force: true });
  await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(tutorPage.getByRole("heading", { name: "Denúncia enviada" })).toBeVisible();
  await tutorPage.getByRole("button", { name: "Fechar" }).click();
  await expect(tutorPage.getByText("Você bloqueou esta pessoa.")).toBeVisible();
  await expect(tutorPage.getByRole("button", { name: "Desbloquear" })).toBeVisible();

  await composer(visitor).fill("Oi?");
  await visitor.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(visitor.getByText("Esta conversa não aceita novas mensagens.")).toBeVisible();
  await expect(messages(visitor)).toHaveCount(3);

  // Outra pessoa não acessa a conversa.
  const { ctx: otherCtx, page: other } = await freshVisitor(browser);
  const outsider = await createTutorWithActiveAlert("chat-outsider", "Thor");
  createdEmails.push(outsider.email);
  await signInAs(other, outsider.email, "/conversas");
  await other.goto(conversationPath);
  await expect(other.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();

  await ctx.close();
  await otherCtx.close();
});

test("the tutor replies to whoever sent an anonymous sighting", async ({ page }) => {
  test.setTimeout(60_000);
  const tutor = await createTutorWithActiveAlert("chat-reply", "Nina");
  createdEmails.push(tutor.email);
  createdIds.push(await anonymousSighting(tutor.code, "Estava perto do metrô."));

  await signInAs(page, tutor.email, `/alerta/${tutor.code}`);
  await expect(page.getByTestId("timeline-sighting")).toContainText("Estava perto do metrô.");
  await page.getByRole("button", { name: /Responder a quem viu/ }).click();
  await expect(page).toHaveURL(/\/conversas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Quem enviou o avistamento" })).toBeVisible();
  await expect(page.getByText(/enviou sem cadastro: ela verá sua mensagem quando voltar/)).toBeVisible();

  await composer(page).fill("Obrigada! Ela estava sozinha?");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(messages(page)).toHaveCount(1);
  await page.goto("/conversas");
  await expect(page.getByTestId("conversation-item")).toContainText("Você: Obrigada! Ela estava sozinha?");
});

test("alerts with the chat turned off do not offer it", async ({ page }) => {
  const tutor = await createTutorWithActiveAlert("chat-off", { petName: "Bolt", contactChat: false, whatsapp: "11900000003" });
  createdEmails.push(tutor.email);
  await page.goto(`/alerta/${tutor.code}`);
  await expect(page.getByRole("link", { name: "WhatsApp do tutor" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Conversar com o tutor/ })).toHaveCount(0);
  await page.goto(`/alerta/${tutor.code}/conversar`);
  await expect(page.getByRole("heading", { name: "O tutor não está recebendo mensagens" })).toBeVisible();
});

test("the API validates the first message and requires a session", async ({ request }) => {
  const tutor = await createTutorWithActiveAlert("chat-api", "Luna");
  createdEmails.push(tutor.email);
  expect((await request.post("/api/conversas", { data: { code: tutor.code, body: "   " } })).status()).toBe(422);
  expect((await request.post("/api/conversas", { data: { code: "nao-existe", body: "oi" } })).status()).toBe(422);
  const res = await request.post("/api/conversas", { data: { code: tutor.code, body: "oi" } });
  expect(res.status()).toBe(401);
});
