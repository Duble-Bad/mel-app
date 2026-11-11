import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import jsQR from "jsqr";
import sharp from "sharp";
import { getPublicLostCase } from "../packages/data/src/lostCases";
import { getPosterDesigns, savePosterDesign } from "../packages/data/src/posterDesigns";
import type { MelClient } from "../packages/data/src/client";
import { createTutorWithActiveAlert } from "./support/alerts";
import { createUser, deleteUserByEmail, TEST_PASSWORD } from "./support/users";

// Prévia do link (Facebook/WhatsApp), propostas de cartaz e enquadramento da foto.
const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } }) as unknown as MelClient;

async function readQr(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

const meta = (html: string, key: string) =>
  new RegExp(`<meta[^>]+(?:property|name)="${key.replace(/:/g, "\\:")}"[^>]+content="([^"]*)"`).exec(html)?.[1] ?? null;

test("link preview (Open Graph): specific title, canonical URL and a 1200×630 image with the pet's photo, readable without login", async ({ request, baseURL }) => {
  const t = await createTutorWithActiveAlert("og", { petName: "Prévia", withPhoto: true });
  created.push(t.email);
  const page = `${baseURL}/alerta/${t.code}`;
  // Como o robô do Facebook: sem cookies, sem JavaScript.
  const res = await request.get(`/alerta/${t.code}`, { headers: { "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" } });
  expect(res.status()).toBe(200);
  const html = await res.text();
  const head = html.split("</head>")[0]!;
  expect(meta(head, "og:title")).toBe("PERDIDO: Prévia — ajude a encontrar");
  expect(meta(head, "og:description")).toContain("visto por último perto de Sé");
  expect(meta(head, "og:url")).toBe(page);
  expect(head).toContain(`<link rel="canonical" href="${page}"`);
  expect(meta(head, "og:site_name")).toBe("MEL");
  expect(meta(head, "og:locale")).toBe("pt_BR");
  expect(meta(head, "og:image")).toBe(`${page}/cartaz/og`);
  expect(meta(head, "og:image:type")).toBe("image/png");
  expect(meta(head, "og:image:width")).toBe("1200");
  expect(meta(head, "og:image:height")).toBe("630");
  expect(meta(head, "twitter:card")).toBe("summary_large_image");

  const img = await request.get(`/alerta/${t.code}/cartaz/og`, { headers: { "User-Agent": "facebookexternalhit/1.1" } });
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
  const png = await img.body();
  expect(png.length).toBeLessThan(8 * 1024 * 1024); // limite do Facebook
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([1200, 630]);
  // A foto ocupa a maior parte (lado esquerdo): o pixel do meio da foto é a cor da foto de teste.
  const at = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
  for (const [x, y] of [[390, 315], [100, 100], [700, 550]]) {
    const [r, g, b] = at(x, y);
    expect(Math.abs(r! - 176) + Math.abs(g! - 120) + Math.abs(b! - 64)).toBeLessThan(30);
  }
});

test("poster proposals: every format has the right resolution and a QR Code that opens the alert (one and several photos)", async ({ request, baseURL }) => {
  test.setTimeout(150_000);
  const one = await createTutorWithActiveAlert("prop1", { petName: "Uma", photos: 1, whatsapp: "11900000001" });
  const many = await createTutorWithActiveAlert("prop3", { petName: "Varias Fotos Grandes", photos: 3, uniqueMarks: "Mancha branca no peito e orelha esquerda dobrada, coleira vermelha com plaquinha." });
  created.push(one.email, many.email);
  const sizes = { impressao: [1654, 2339], square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 630] } as const;
  for (const t of [one, many]) {
    for (const [format, [w, h]] of Object.entries(sizes)) {
      const res = await request.get(`/alerta/${t.code}/cartaz/${format}?modelo=proposta`);
      expect(res.status(), `${t.code} ${format}`).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
      const png = await res.body();
      const m = await sharp(png).metadata();
      expect([m.width, m.height], format).toEqual([w, h]);
      expect(await readQr(png), `${format}: QR legível e do alerta certo`).toBe(`${baseURL}/alerta/${t.code}`);
    }
  }
  // Os modelos atuais continuam (inclusive o novo Feed 4:5) e a página de impressão também.
  for (const format of ["square", "portrait", "story", "landscape"]) {
    const res = await request.get(`/alerta/${one.code}/cartaz/${format}?baixar=1`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain(`MEL-procura-se-Uma-${format}.png`);
  }
  expect((await request.get(`/alerta/${one.code}/cartaz/a4`)).status()).toBe(200);
  expect((await request.get(`/alerta/${one.code}/cartaz/propostas`)).status()).toBe(200);
});

test("internal preview with a real pet (DEV routes only): five sizes, noindex, nothing written", async ({ request }) => {
  const t = await createTutorWithActiveAlert("prev-pet", { petName: "Previa", photos: 2, publicPet: true });
  created.push(t.email);
  const mel = (await getPublicLostCase(anon(), t.code))!.pet.melId!;
  const sizes = { impressao: [1654, 2339], square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 630] } as const;
  for (const [format, [w, h]] of Object.entries(sizes)) {
    const res = await request.get(`/dev/cartaz-pet/${mel}/${format}?fotos=1,0`);
    expect(res.status(), format).toBe(200);
    expect(res.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    const m = await sharp(await res.body()).metadata();
    expect([m.width, m.height], format).toEqual([w, h]);
  }
  expect((await request.get(`/dev/cartaz-pet/${mel}`)).status()).toBe(200);
  expect((await request.get(`/dev/cartaz-pet/MEL-000000/square`)).status()).toBe(404);
});

test("the owner chooses the poster cover and framing; visitors never see the control", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const t = await createTutorWithActiveAlert("enquadra", { petName: "Enquadra", photos: 2 });
  created.push(t.email);

  // Visitante: sem o controle.
  const visitor = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await visitor.goto(`/alerta/${t.code}/cartaz`);
  await expect(visitor.getByRole("heading", { name: /Cartaz de Enquadra/ })).toBeVisible();
  await expect(visitor.getByTestId("poster-photo-editor")).toHaveCount(0);
  await visitor.close();

  // Tutor: toca no canto superior esquerdo da foto e salva.
  await page.goto(`/entrar?next=${encodeURIComponent(`/alerta/${t.code}/cartaz`)}`);
  await page.getByLabel("E-mail").fill(t.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  const editor = page.getByTestId("poster-photo-editor");
  await expect(editor).toBeVisible({ timeout: 30_000 });
  // Fotos de teste têm 400×400: o editor avisa que podem sair borradas no cartaz.
  await expect(editor.getByTestId("poster-small-photo")).toContainText("400×400");
  const area = editor.getByTestId("poster-focus-area");
  // Mede só depois que a foto carregou (antes disso a área muda de tamanho) e repete o toque
  // se ele chegar antes da página ficar interativa.
  await expect.poll(() => area.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  await expect(async () => {
    const box = (await area.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await expect(area).toHaveAttribute("aria-label", /20% da esquerda, 30% do topo/, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await editor.getByRole("button", { name: "Salvar enquadramento" }).click();
  await expect(page.getByText("Enquadramento salvo.")).toBeVisible();
  await expect.poll(async () => (await getPublicLostCase(anon(), t.code))?.pet.photos[0]?.focus).toEqual({ x: 20, y: 30 });

  // Troca a capa para a segunda foto.
  const second = editor.getByRole("button", { name: /^Foto 2/ });
  await second.click();
  await editor.getByRole("button", { name: "Usar como capa" }).click();
  await expect(page.getByText("Capa do cartaz trocada.")).toBeVisible();
  await expect(editor.getByRole("button", { name: /^Foto 1 \(capa atual\)/ })).toBeVisible();
  const after = await getPublicLostCase(anon(), t.code);
  expect(after?.pet.photos[0]?.isPrimary).toBe(true);
  expect(after?.pet.photos[0]?.focus).toBeNull(); // a nova capa ainda está no automático
});

test("comparison page (DEV only): five formats separately, previous × proposal, full size and download", async ({ page }) => {
  const t = await createTutorWithActiveAlert("comparacao", { petName: "Compara", photos: 3 });
  created.push(t.email);
  await page.goto(`/alerta/${t.code}/cartaz/propostas`);
  await expect(page.getByRole("heading", { name: /Cartazes de Compara/ })).toBeVisible();
  for (const f of ["impressao", "square", "portrait", "story", "landscape"]) {
    const section = page.getByTestId(`comparacao-${f}`);
    await expect(section.locator("figcaption").filter({ hasText: /^Versão anterior/ })).toBeVisible();
    await expect(section.locator("figcaption").filter({ hasText: /^Proposta/ })).toBeVisible();
    await expect(section.getByRole("link", { name: "Ver em tamanho real" })).toHaveCount(2);
    await expect(section.getByRole("link", { name: "Baixar proposta" })).toHaveAttribute("href", new RegExp(`/cartaz/${f}\\?modelo=proposta.*&baixar=1$`));
    await expect(section.getByRole("heading", { name: "O que mudou" })).toBeVisible();
  }
  // Combinação de fotos: muda só as propostas.
  await page.getByRole("link", { name: "Só a foto 2" }).click();
  await expect(page).toHaveURL(/\?fotos=1$/);
  await expect(page.getByTestId("comparacao-square").getByRole("link", { name: "Baixar proposta" })).toHaveAttribute("href", /fotos=1&baixar=1$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("poster models: four per format with real files, correct size and a working QR (one vertical photo and three mixed photos)", async ({ request, baseURL }) => {
  test.setTimeout(240_000);
  const one = await createTutorWithActiveAlert("modelos-1", { petName: "Uma", photoSizes: [[900, 1200]] });
  const three = await createTutorWithActiveAlert("modelos-3", { petName: "Tres", photoSizes: [[1600, 1200], [900, 1600], [800, 600]], uniqueMarks: "Mancha branca no peito." });
  // Seis fotos e telefone FICTÍCIO publicado pelo tutor: o cartaz completo (modelo 4) mostra o número.
  const six = await createTutorWithActiveAlert("modelos-6", {
    petName: "Seis",
    photoSizes: [[900, 1200], [1200, 1600], [1600, 1200], [1200, 1200], [900, 1600], [1600, 900]],
    uniqueMarks: "Orelha em pé. Pelo branco no peito.",
    whatsapp: "11987650000",
  });
  created.push(one.email, three.email, six.email);
  const sizes = { impressao: [1654, 2339], square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 630] } as const;
  for (const t of [one, three, six]) {
    for (const [format, [w, h]] of Object.entries(sizes)) {
      for (const estilo of t === six ? [4] : [1, 2, 3, 4]) {
        const res = await request.get(`/alerta/${t.code}/cartaz/${format}?modelo=proposta&estilo=${estilo}`);
        expect(res.status(), `${t.code} ${format} ${estilo}`).toBe(200);
        const png = await res.body();
        const m = await sharp(png).metadata();
        expect([m.width, m.height], `${format} modelo ${estilo}`).toEqual([w, h]);
        expect(await readQr(png), `${format} modelo ${estilo}: QR`).toBe(`${baseURL}/alerta/${t.code}`);
        // Nenhuma foto vira "inteira com laterais desfocadas".
        expect(res.headers()["x-mel-diagnostico"], `${format} modelo ${estilo}`).not.toContain('"inteira"');
      }
    }
  }
  // Os modelos realmente diferem entre si (não são três cópias).
  const bodies = await Promise.all([1, 2, 3, 4].map(async (e) => (await request.get(`/alerta/${three.code}/cartaz/square?modelo=proposta&estilo=${e}`)).body()));
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) expect(bodies[i]!.equals(bodies[j]!), `modelos ${i + 1} e ${j + 1}`).toBe(false);
  // Modelo 4 no A4 com 6 fotos usa até as 6 (o mosaico pode deixar uma de fora para nenhuma ficar estreita).
  const a4 = await request.get(`/alerta/${six.code}/cartaz/impressao?modelo=proposta&estilo=4`);
  expect(JSON.parse(a4.headers()["x-mel-diagnostico"]!).length).toBeGreaterThanOrEqual(5);
  // Com telefone autorizado o cartaz muda (o número entra no rodapé); sem ele, não há número.
  const withPhone = await (await request.get(`/alerta/${six.code}/cartaz/square?modelo=proposta&estilo=4&fotos=0,1,2`)).body();
  await sharp(withPhone).toFile(test.info().outputPath("modelo4-com-telefone.png"));
  // Baixar leva o modelo no nome do arquivo.
  const dl = await request.get(`/alerta/${three.code}/cartaz/story?modelo=proposta&estilo=3&baixar=1`);
  expect(dl.headers()["content-disposition"]).toContain("MEL-procura-se-Tres-story-modelo-3.png");
});

test("create poster flow (DEV): the tutor picks a format, sees three real previews (one recommended), customizes and gets download, print and share", async ({ page, request, baseURL }) => {
  test.setTimeout(180_000);
  const t = await createTutorWithActiveAlert("criar-cartaz", { petName: "Fluxo", photoSizes: [[1600, 1200], [900, 1600], [1200, 1200]] });
  created.push(t.email);
  const before = await getPublicLostCase(anon(), t.code);
  // Só o tutor vê a entrada "Criar cartaz" no alerta.
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(t.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await page.goto(`/alerta/${t.code}`);
  await page.getByTestId("criar-cartaz-link").click();
  await expect(page).toHaveURL(new RegExp(`/alerta/${t.code}/cartaz/criar$`));

  // O indicador mostra a etapa atual, as concluídas e as pendentes (a personalização pulada não aparece como concluída).
  const states = () => page.locator("[data-testid^=etapa-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-state")));
  await expect.poll(states).toEqual(["current", "pending", "pending", "pending"]);
  // 1 — formato
  await page.getByTestId("formato-story").click();
  // 2 — três prévias reais, uma recomendada (com o motivo), ampliáveis
  await expect.poll(states).toEqual(["done", "current", "pending", "pending"]);
  for (const m of [1, 2, 3]) await expect(page.getByTestId(`modelo-${m}`).locator("img")).toHaveAttribute("src", new RegExp(`/cartaz/story\\?modelo=proposta&estilo=${m}$`));
  await expect(page.getByText("Recomendado pela MEL")).toHaveCount(1);
  await expect(page.getByText(/^Por quê:/)).toBeVisible();
  await page.getByTestId("modelo-3").getByRole("button", { name: "Ampliar", exact: true }).click();
  await expect(page.getByTestId("cartaz-ampliado").locator("img")).toHaveAttribute("src", /estilo=3$/);
  await page.keyboard.press("Escape");
  await page.getByTestId("modelo-3").getByRole("button", { name: "Escolher este modelo" }).click();
  // 3 — personalizar é opcional
  await expect.poll(states).toEqual(["done", "done", "current", "pending"]);
  await page.getByRole("button", { name: "Pular personalização" }).click();
  // 4 — usar
  await expect.poll(states).toEqual(["done", "done", "skipped", "current"]);
  await expect(page.getByTestId("cartaz-final")).toHaveAttribute("src", /\/cartaz\/story\?modelo=proposta&estilo=3$/);
  await expect(page.getByRole("link", { name: "Baixar" })).toHaveAttribute("href", /estilo=3&baixar=1$/);
  await expect(page.getByRole("link", { name: "Imprimir" })).toHaveAttribute("href", /\/cartaz\/imprimir\?modelo=proposta&estilo=3&formato=story$/);
  await expect(page.getByRole("button", { name: "Compartilhar" })).toBeVisible();
  // 3 de novo — outra principal, zoom; a prévia é o PNG final
  await page.getByRole("button", { name: "Personalizar novamente" }).click();
  await expect(page.getByTestId("editor-moldura").locator("img")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Usar a foto 2 como principal" }).click();
  // Seleção limitada ao que cabe: neste formato o Modelo 3 mostra 2 destas fotos; a 3ª fica
  // marcada "Não cabe" (não dá para escolher uma foto que não apareceria no cartaz).
  await expect(page.getByTestId("capacidade")).toContainText("mostra até 3 fotos");
  await expect(page.getByRole("button", { name: "Foto 3: não cabe neste modelo" })).toBeDisabled();
  await page.getByRole("slider").fill("2");
  const preview = page.getByTestId("editor-previa");
  // Um enquadramento por foto, na ordem do cartaz (?quadros=x,y,zoom_…; "-" = padrão do modelo).
  await expect(preview).toHaveAttribute("src", /\/cartaz\/story\?modelo=proposta&estilo=3&fotos=1%2C0&quadros=50%2C50%2C2\.00_-$/);
  // A complementar também se enquadra, e pode ficar menor que o espaço (inteira, sobra com o fundo).
  await page.getByRole("radio", { name: /Complementar 1/ }).click();
  await page.getByRole("button", { name: "Caber inteira" }).click();
  await expect(preview).toHaveAttribute("src", /&quadros=50%2C50%2C2\.00_50%2C50%2C\d\.\d\d$/);
  const png = await (await request.get((await preview.getAttribute("src"))!)).body();
  expect((await sharp(png).metadata()).height).toBe(1920);
  expect(await readQr(png)).toBe(`${baseURL}/alerta/${t.code}`);
  // A escolha sobrevive ao recarregar (fica no endereço da página).
  await page.reload();
  await expect(page.getByTestId("editor-previa")).toHaveAttribute("src", /&quadros=50%2C50%2C2\.00_50%2C50%2C\d\.\d\d$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect.poll(states).toEqual(["done", "done", "done", "current"]);
  // Restaurar avisa e permite desfazer.
  await page.getByTestId("etapa-3").getByRole("button").click();
  await page.getByRole("button", { name: "Restaurar o modelo original" }).click();
  await expect(page.getByTestId("editor-previa")).toHaveAttribute("src", /\/cartaz\/story\?modelo=proposta&estilo=3$/);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByTestId("editor-previa")).toHaveAttribute("src", /&quadros=50%2C50%2C2\.00_50%2C50%2C\d\.\d\d$/);
  // Trocar de formato mostra os três modelos do novo formato.
  await page.getByTestId("etapa-1").getByRole("button").click();
  await page.getByTestId("formato-square").click();
  for (const m of [1, 2, 3]) await expect(page.getByTestId(`modelo-${m}`).locator("img")).toHaveAttribute("src", new RegExp(`/cartaz/square\\?modelo=proposta&estilo=${m}$`));
  // Imprimir: página com o cartaz, sem gravar nada.
  expect((await request.get(`/alerta/${t.code}/cartaz/imprimir?estilo=3&formato=impressao`)).status()).toBe(200);
  // Nada gravado: fotos, capa e ordem iguais.
  expect((await getPublicLostCase(anon(), t.code))!.pet.photos).toEqual(before!.pet.photos);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // O editor antigo leva ao fluxo novo.
  await page.goto(`/alerta/${t.code}/cartaz/editor`);
  await expect(page).toHaveURL(new RegExp(`/alerta/${t.code}/cartaz/criar$`));
});

test("saved poster (tutor account): the tutor saves a format and it reopens in a clean session; only the tutor can save", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const t = await createTutorWithActiveAlert("cartaz-salvo", { petName: "Salvo", photoSizes: [[1200, 1600], [1600, 1200], [1200, 1200]] });
  created.push(t.email);
  const before = await getPublicLostCase(anon(), t.code);
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(t.email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await page.goto(`/alerta/${t.code}/cartaz/criar`);
  await page.getByTestId("formato-square").click();
  await page.getByTestId("modelo-3").getByRole("button", { name: "Escolher este modelo" }).click();
  await expect(page.getByTestId("editor-moldura").locator("img")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Usar a foto 2 como principal" }).click();
  await page.getByRole("slider").fill("1.5");
  await page.getByRole("radio", { name: /Complementar 1/ }).click();
  await page.getByRole("slider").fill("1.2");
  await page.getByRole("button", { name: "Continuar" }).click();
  // Salvar na conta: o estado muda para "salvo" e o botão fica indisponível até mudar algo.
  await expect(page.getByTestId("salvar-estado")).toHaveText("Salve para encontrar este cartaz pronto em qualquer aparelho.");
  await page.getByRole("button", { name: "Salvar na minha conta" }).click();
  await expect(page.getByTestId("salvar-estado")).toHaveText("✓ Este é o cartaz salvo na sua conta para este formato.", { timeout: 15_000 });
  const saved = await getPosterDesigns(anon(), t.code);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ format: "square", model: 3 });
  // Enquadramento de cada foto, na ordem salva: a principal e a 1ª complementar.
  expect(saved[0]!.framings.slice(0, 2)).toEqual([
    { x: 50, y: 50, zoom: 1.5 },
    { x: 50, y: 50, zoom: 1.2 },
  ]);
  expect(saved[0]!.photoIds[0]).toBe(before!.pet.photos[1]!.id);
  // Outra sessão do tutor (endereço limpo, sem ajustes na URL): abre com o salvo.
  await page.goto(`/alerta/${t.code}/cartaz/criar`);
  await page.getByTestId("formato-square").click();
  await expect(page.getByTestId("salvo-3")).toBeVisible();
  await page.getByTestId("modelo-3").getByRole("button", { name: "Escolher este modelo" }).click();
  await expect(page.getByTestId("editor-previa")).toHaveAttribute("src", /estilo=3&fotos=1%2C0.*&quadros=50%2C50%2C1\.50_50%2C50%2C1\.20/);
  // Visitante: cria e baixa, mas não vê "Salvar".
  const visitor = await browser.newPage();
  await visitor.goto(`/alerta/${t.code}/cartaz/criar?formato=square&estilo=3`);
  await expect(visitor.getByTestId("cartaz-final")).toBeVisible({ timeout: 30_000 });
  await expect(visitor.getByTestId("salvar-cartaz")).toHaveCount(0);
  await expect(visitor.getByText("Só o tutor pode salvar um cartaz na conta.")).toBeVisible();
  await visitor.close();
  // O banco recusa quem não é o tutor (outra conta) e quem não entrou.
  const other = await createUser("cartaz-outro", { onboarded: true });
  created.push(other.email);
  const otherClient = anon();
  await (otherClient as unknown as ReturnType<typeof createClient>).auth.signInWithPassword({ email: other.email, password: TEST_PASSWORD });
  await expect(savePosterDesign(otherClient, t.code, { format: "story", model: 1, photoIds: [], framings: [] })).rejects.toThrow(/Só o tutor/);
  await expect(savePosterDesign(anon(), t.code, { format: "story", model: 1, photoIds: [], framings: [] })).rejects.toThrow();
  expect(await getPosterDesigns(anon(), t.code)).toHaveLength(1);
  // Fotos, capa e ordem do cadastro continuam iguais.
  expect((await getPublicLostCase(anon(), t.code))!.pet.photos).toEqual(before!.pet.photos);
});

test("reward prototype (DEV only): optional, BRL mask, shown only on active alerts and never as an empty block", async ({ page, request }) => {
  await page.goto("/dev/bonificacao");
  await expect(page.getByTestId("bonificacao-bloco")).toHaveCount(0); // "Não" é o padrão
  await page.getByLabel("Sim").check();
  await page.getByLabel("Valor da bonificação (R$)").pressSequentially("50000");
  await expect(page.getByLabel("Valor da bonificação (R$)")).toHaveValue("500,00");
  await expect(page.getByTestId("bonificacao-bloco")).toContainText("BONIFICAÇÃO OFERECIDA: R$ 500,00");
  await expect(page.getByTestId("bonificacao-bloco")).toContainText("A MEL não intermedeia pagamentos");
  for (const s of ["Encerrado", "Reencontrado"]) {
    await page.getByRole("radio", { name: s }).click();
    await expect(page.getByTestId("bonificacao-bloco")).toHaveCount(0);
  }
  const sizes = { impressao: [1654, 2339], square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 630] } as const;
  for (const [format, [w, h]] of Object.entries(sizes)) {
    const res = await request.get(`/dev/bonificacao/cartaz/${format}?centavos=50000`);
    expect(res.status(), format).toBe(200);
    const m = await sharp(await res.body()).metadata();
    expect([m.width, m.height], format).toEqual([w, h]);
  }
  // Com e sem bonificação, o cartaz muda (o selo só existe com valor).
  const withReward = await (await request.get("/dev/bonificacao/cartaz/square?centavos=50000")).body();
  const without = await (await request.get("/dev/bonificacao/cartaz/square")).body();
  expect(withReward.equals(without)).toBe(false);
});
