import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import jsQR from "jsqr";
import sharp from "sharp";
import { getPublicLostCase } from "../packages/data/src/lostCases";
import type { MelClient } from "../packages/data/src/client";
import { createTutorWithActiveAlert } from "./support/alerts";
import { deleteUserByEmail, TEST_PASSWORD } from "./support/users";

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

test("editor prototype (DEV only): swap the main photo, frame one format, the final PNG follows and nothing else changes", async ({ page, request, baseURL }) => {
  test.setTimeout(120_000);
  const t = await createTutorWithActiveAlert("editor-proto", { petName: "Editor", photos: 3 });
  created.push(t.email);
  const before = await getPublicLostCase(anon(), t.code);
  await page.goto(`/alerta/${t.code}/cartaz/editor`);
  const frame = page.getByTestId("editor-moldura");
  await expect(frame.locator("img")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Usar como principal" }).first().click();
  await page.getByRole("slider").fill("2");
  // Arrastar na moldura muda o ponto (mouse; o toque usa os mesmos eventos de ponteiro).
  await frame.scrollIntoViewIfNeeded();
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const preview = page.getByTestId("editor-previa");
  await expect(preview).toHaveAttribute("src", /\/cartaz\/square\?modelo=proposta&fotos=1%2C0%2C2&foco=\d+%2C50&zoom=2\.00$/);
  // Só o formato editado leva enquadramento.
  await page.getByRole("radio", { name: "Stories" }).click();
  await expect(preview).toHaveAttribute("src", /\/cartaz\/story\?modelo=proposta&fotos=1%2C0%2C2$/);
  // A prévia é o próprio PNG final, com QR do alerta.
  await page.getByRole("radio", { name: /Quadrado/ }).click();
  await expect(preview).toHaveAttribute("src", /\/cartaz\/square\?.*zoom=2\.00$/);
  const res = await request.get((await preview.getAttribute("src"))!);
  const png = await res.body();
  expect((await sharp(png).metadata()).width).toBe(1080);
  expect(await readQr(png)).toBe(`${baseURL}/alerta/${t.code}`);
  // Nada gravado: capa, ordem e fotos do alerta continuam iguais.
  expect((await getPublicLostCase(anon(), t.code))!.pet.photos).toEqual(before!.pet.photos);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
