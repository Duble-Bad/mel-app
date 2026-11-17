import { mkdirSync, writeFileSync } from "node:fs";
import { devices, expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";
import { getMyLostCaseByCode, updateLostCase } from "../packages/data/src/lostCases";
import { createTutorWithActiveAlert, createTutorWithPet } from "./support/alerts";
import { mockGeocoding, SE } from "./support/geo";
import { createApprovedAdoption, createModerator, signedClient } from "./support/partners";
import { patternPng } from "./support/png";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

/**
 * TESTE VISUAL das novidades de 2026-11-16/17. Abre cada tela como uma pessoa usaria, confere o que
 * aparece na tela (layout lado a lado no computador, sem rolagem lateral no celular, fotos de fato
 * carregadas, cores do tema, selo dourado no cartaz) e guarda um print de cada tela no relatório
 * (anexos) e em test-results/visual-novidades/. Não compara pixel a pixel com uma imagem de
 * referência: a fonte do Windows e a do Linux do CI renderizam diferente.
 *
 * - "Vi um pet solto": etapas com ícones, prévia do anúncio ao lado (desktop), foto na revisão.
 * - Bonificação: etapa "Detalhes", bloco dourado no alerta, selo nos cartazes, retirada pelo tutor.
 * - Capa e enquadramento na página do alerta (só o tutor).
 * - Atalho "Ele está desaparecido? Publicar alerta".
 * - Cartões de adoção: fêmea rosa, macho dourado (/adocao e Mural).
 */

// MEL_SLOWMO=400 (ms entre ações) + --headed: rodar devagar e com o navegador visível.
const SLOWMO = Number(process.env.MEL_SLOWMO ?? 0);
test.use({ launchOptions: { slowMo: SLOWMO } });
/** Tempo de cada cenário (mais folga no modo lento, para acompanhar na tela). */
const timeout = (ms: number) => test.setTimeout(SLOWMO ? ms * 4 : ms);

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

const DIR = "test-results/visual-novidades";
mkdirSync(DIR, { recursive: true });

/** Print da tela inteira: anexo no relatório e arquivo em test-results/visual-novidades/. */
async function shot(page: Page, info: TestInfo, name: string) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  const body = await page.screenshot({ fullPage: true, animations: "disabled" });
  writeFileSync(`${DIR}/${name}.png`, body);
  await info.attach(name, { body, contentType: "image/png" });
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "sem rolagem lateral").toBe(true);
}

/** A imagem chegou de verdade (não é um quadro quebrado). */
async function expectLoaded(img: ReturnType<Page["locator"]>) {
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
}

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function desktop(browser: Browser) {
  const ctx = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    permissions: ["geolocation"],
    geolocation: SE,
  });
  return { ctx, page: await ctx.newPage() };
}

const cont = (page: Page) => page.getByRole("button", { name: "Continuar", exact: true });
const states = (page: Page) => page.locator("[data-testid^=etapa-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-state")));
const PHOTO = { name: "pet.png", mimeType: "image/png", buffer: patternPng(1200, 900, [176, 120, 64]) };

/** Percorre "Vi um pet solto" até a revisão (sem publicar: nada é criado). */
async function sightingToReview(page: Page, info: TestInfo, label: string) {
  await mockGeocoding(page);
  await page.goto("/publicar/encontrado?vi=1");
  await expect(page.getByRole("heading", { name: "Tem uma foto dele?" })).toBeVisible();
  await expect.poll(() => states(page)).toEqual(["current", "pending", "pending", "pending", "pending", "pending"]);
  await page.locator('input[type="file"]').setInputFiles(PHOTO);
  await expectLoaded(page.getByRole("img", { name: "Foto escolhida" }));
  await shot(page, info, `${label}-1-foto`);
  await cont(page).click();

  await expect(page.getByRole("heading", { name: "Onde você viu?" })).toBeVisible();
  await page.getByRole("button", { name: /Usar minha localização atual/ }).click();
  await expect(page.getByTestId("picked-label")).toContainText("perto de");
  await cont(page).click();

  await expect(page.getByRole("heading", { name: "Quando foi?" })).toBeVisible();
  await page.getByText("Há uns 15 min").click();
  await cont(page).click();

  await expect(page.getByRole("heading", { name: "Como ele é?" })).toBeVisible();
  // Toca no texto da opção, como uma pessoa faria.
  await page.locator("label").filter({ hasText: /^Cachorro$/ }).click();
  await expect(page.getByRole("radio", { name: "Cachorro" })).toBeChecked();
  await cont(page).click();

  await expect(page.getByRole("heading", { name: "Onde ele está agora?" })).toBeVisible();
  await cont(page).click();

  await expect(page.getByRole("heading", { name: "Confira e publique" })).toBeVisible();
  // Todas as etapas anteriores concluídas (✓) e a última atual.
  await expect.poll(() => states(page)).toEqual(["done", "done", "done", "done", "done", "current"]);
  // A foto que a pessoa escolheu aparece na revisão, com "Trocar foto".
  await expectLoaded(page.getByTestId("review-photo"));
  await expect(page.getByRole("button", { name: "Trocar foto" }).first()).toBeVisible();
  await expect(page.getByText("Cachorro").first()).toBeVisible();
}

test("Vi um pet solto (computador): etapas com ícones, prévia do anúncio ao lado e a foto na revisão", async ({ browser }, info) => {
  timeout(120_000);
  const { ctx, page } = await desktop(browser);
  await sightingToReview(page, info, "vi-um-pet-desktop");

  // Painel da etapa à esquerda e a prévia do anúncio à direita, lado a lado.
  const aside = page.locator("aside").filter({ hasText: "Prévia do anúncio" });
  await expect(aside).toBeVisible();
  const panel = page.getByRole("heading", { name: "Confira e publique" }).locator("xpath=ancestor::div[contains(@class,'lg:rounded-[28px]')][1]");
  const [a, p] = [(await aside.boundingBox())!, (await panel.boundingBox())!];
  expect(a.x, "prévia à direita do painel").toBeGreaterThanOrEqual(p.x + p.width - 1);
  expect(p.width, "painel largo (não é mais a coluna estreita)").toBeGreaterThan(600);
  await expectLoaded(aside.locator("img"));
  await expect(aside).toContainText("Avistado");
  await expect(aside).toContainText("Cachorro");
  // Botões lado a lado: Voltar à esquerda, Publicar à direita.
  const back = (await page.getByRole("button", { name: "Voltar", exact: true }).boundingBox())!;
  const publish = (await page.getByRole("button", { name: "Publicar", exact: true }).boundingBox())!;
  expect(back.x).toBeLessThan(publish.x);
  expect(Math.abs(back.y - publish.y)).toBeLessThan(20);
  await noHorizontalScroll(page);
  await shot(page, info, "vi-um-pet-desktop-2-revisao");
  await ctx.close();
});

test("Vi um pet solto (celular): uma coluna, sem prévia lateral, foto grande na revisão e sem rolagem lateral", async ({ page, context }, info) => {
  timeout(120_000);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(SE);
  await sightingToReview(page, info, "vi-um-pet-celular");
  await expect(page.locator("aside").filter({ hasText: "Prévia do anúncio" })).toBeHidden();
  const photo = (await page.getByTestId("review-photo").boundingBox())!;
  expect(photo.width, "foto ocupa a largura da tela").toBeGreaterThan((page.viewportSize()?.width ?? 400) * 0.8);
  await noHorizontalScroll(page);
  await shot(page, info, "vi-um-pet-celular-2-revisao");
});

/** Quantos pixels do dourado da MEL (#f6b928) a imagem tem. */
async function goldPixels(png: Buffer) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (Math.abs(data[i]! - 246) + Math.abs(data[i + 1]! - 185) + Math.abs(data[i + 2]! - 40) < 45) n++;
  }
  return n;
}

test("Bonificação: bloco dourado no alerta, selo no cartaz, editada na etapa Detalhes e retirada pelo tutor", async ({ page, browser }, info) => {
  timeout(180_000);
  const t = await createTutorWithActiveAlert("visual-bonus", { petName: "Bonus", photoSizes: [[1200, 900]], rewardCents: 50_000 });
  created.push(t.email);

  // Visitante: o bloco aparece em destaque, na cor do tema (dourado), com o aviso.
  await page.goto(`/alerta/${t.code}`);
  const block = page.getByTestId("bonificacao-bloco");
  await expect(block).toContainText("BONIFICAÇÃO OFERECIDA: R$ 500,00");
  await expect(block).toContainText("A MEL não intermedeia pagamentos");
  const [blockBg, primary] = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "bg-primary";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [getComputedStyle(document.querySelector('[data-testid="bonificacao-bloco"]')!).backgroundColor, color];
  });
  expect(blockBg, "bloco na cor primária (dourado)").toBe(primary);
  await block.scrollIntoViewIfNeeded();
  await noHorizontalScroll(page);
  await shot(page, info, "bonificacao-1-alerta-visitante");

  // Cartaz com a bonificação: o selo dourado aparece (bem mais dourado que sem a bonificação).
  const withReward = await (await page.request.get(`/alerta/${t.code}/cartaz/square?estilo=1`)).body();
  await info.attach("bonificacao-2-cartaz-com-selo", { body: withReward, contentType: "image/png" });
  writeFileSync(`${DIR}/bonificacao-2-cartaz-com-selo.png`, withReward);

  // Tutor: a etapa "Detalhes" da edição mostra a bonificação já preenchida.
  const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 7"];
  const tutorCtx = await browser.newContext({ ...pixel, baseURL: test.info().project.use.baseURL, locale: "pt-BR" });
  const tutor = await tutorCtx.newPage();
  await signIn(tutor, t.email, `/alerta/${t.code}/editar`);
  await expect(tutor.getByRole("heading", { name: "Onde ele foi visto pela última vez?" })).toBeVisible({ timeout: 30_000 });
  await cont(tutor).click();
  await expect(tutor.getByRole("heading", { name: "Quando ele sumiu?" })).toBeVisible();
  await cont(tutor).click();
  await expect(tutor.getByRole("heading", { name: /Algum detalhe/ })).toBeVisible();
  const bonus = tutor.getByTestId("bonificacao");
  await expect(bonus.getByRole("radio", { name: "Sim" })).toBeChecked();
  await expect(bonus.getByLabel("Valor da bonificação (R$)")).toHaveValue("500,00");
  await bonus.scrollIntoViewIfNeeded();
  await shot(tutor, info, "bonificacao-3-etapa-detalhes");
  // Valor inválido: a etapa fica marcada com erro e a mensagem aparece.
  await bonus.getByLabel("Valor da bonificação (R$)").fill("");
  await cont(tutor).click();
  await expect(bonus.getByText("Informe o valor da bonificação.")).toBeVisible();
  await expect(tutor.getByTestId("etapa-3")).toHaveAttribute("data-state", "error");
  await shot(tutor, info, "bonificacao-4-erro-valor");
  // Retira a bonificação e salva.
  await bonus.getByText("Não", { exact: true }).click();
  await cont(tutor).click();
  await expect(tutor.getByRole("heading", { name: /Como as pessoas podem falar/ })).toBeVisible();
  await tutor.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(tutor).toHaveURL(new RegExp(`/alerta/${t.code}\\?editado=1$`));
  await expect(tutor.getByTestId("bonificacao-bloco")).toHaveCount(0);

  // A capa e o enquadramento da foto ficam na página do alerta, só para o tutor.
  const editor = tutor.getByTestId("poster-photo-editor");
  await editor.scrollIntoViewIfNeeded();
  await expect(editor.getByRole("heading", { name: /Foto de capa/ })).toBeVisible();
  await expectLoaded(editor.getByTestId("poster-focus-area").locator("img"));
  await shot(tutor, info, "bonificacao-5-alerta-tutor-sem-bonificacao-e-capa");
  await tutorCtx.close();

  // Visitante: sem a bonificação, nem bloco nem controle de capa.
  await page.reload();
  await expect(page.getByTestId("bonificacao-bloco")).toHaveCount(0);
  await expect(page.getByTestId("poster-photo-editor")).toHaveCount(0);
  const withoutReward = await (await page.request.get(`/alerta/${t.code}/cartaz/square?estilo=1`)).body();
  await info.attach("bonificacao-6-cartaz-sem-selo", { body: withoutReward, contentType: "image/png" });
  writeFileSync(`${DIR}/bonificacao-6-cartaz-sem-selo.png`, withoutReward);
  const [gWith, gWithout] = [await goldPixels(withReward), await goldPixels(withoutReward)];
  expect(gWith - gWithout, `selo dourado no cartaz (${gWith} × ${gWithout} pixels dourados)`).toBeGreaterThan(3_000);
});

test("Atalho 'Ele está desaparecido? Publicar alerta': no aviso do cadastro e no topo da página do pet", async ({ page }, info) => {
  timeout(120_000);
  const t = await createTutorWithPet("visual-atalho", "Atalho");
  created.push(t.email);
  await signIn(page, t.email, `/perfil/pets/${t.petId}?novo=1`);
  const link = page.getByRole("link", { name: "Ele está desaparecido agora? Publicar alerta" });
  await expect(link).toBeVisible({ timeout: 30_000 });
  const action = page.getByTestId("pet-lost-action");
  await expect(action).toBeVisible();
  // O botão fica no topo, antes do formulário do pet.
  expect((await action.boundingBox())!.y).toBeLessThan((await page.getByRole("heading", { name: "Atalho", level: 1 }).boundingBox())!.y + 300);
  await noHorizontalScroll(page);
  await shot(page, info, "atalho-1-pagina-do-pet");
  await action.click();
  await expect(page.getByRole("heading", { name: "Onde ele foi visto pela última vez?" })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => states(page)).toEqual(["done", "current", "pending", "pending", "pending", "pending"]);
  await shot(page, info, "atalho-2-alerta-com-pet-escolhido");
});

test("Cartões de adoção: fêmea com a luz rosa e macho com a dourada, em /adocao e no Mural", async ({ browser }, info) => {
  timeout(150_000);
  const owner = await createUser("visual-adocao", { onboarded: true });
  const mod = await createModerator("visual-adocao-mod");
  created.push(owner.email, mod.email);
  const at = { lat: -23.5505, lng: -46.6333, label: "Rua Fictícia, 1", neighborhood: "Sé" };
  const suffix = Date.now().toString(36).slice(-4);
  const [female, male] = [`Rosa${suffix}`, `Ouro${suffix}`];
  await createApprovedAdoption(owner.email, owner.id, mod.client, female, at, "female");
  await createApprovedAdoption(owner.email, owner.id, mod.client, male, at, "male");

  const { ctx, page } = await desktop(browser);
  const glow = (name: string) =>
    page
      .getByTestId("adoption-card")
      .filter({ hasText: name })
      .first()
      .evaluate((el) => getComputedStyle(el.closest(".mel-pet") ?? el).getPropertyValue("--k").trim().toLowerCase());
  for (const url of ["/adocao", "/mural?feed=adoption"]) {
    await page.goto(url);
    await expect(page.getByTestId("adoption-card").filter({ hasText: female }).first()).toBeVisible({ timeout: 30_000 });
    expect(await glow(female), `${url}: fêmea rosa`).toBe("#f472b6");
    expect(await glow(male), `${url}: macho dourado`).toBe("#f6b928");
    // Com o mouse em cima, o cartão da fêmea acende (moldura, aura e pegadas) em rosa.
    const card = page.getByTestId("adoption-card").filter({ hasText: female }).first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await noHorizontalScroll(page);
    await shot(page, info, `adocao-${url === "/adocao" ? "1-pagina" : "2-mural"}`);
  }
  await ctx.close();
});
