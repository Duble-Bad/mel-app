import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import sharp from "sharp";
import { createTutorWithActiveAlert } from "./support/alerts";
import { deleteUserByEmail } from "./support/users";

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

/** Lê o QR Code de uma imagem PNG (falha se estiver cortado ou ilegível). */
async function readQr(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

test("every poster format is a PNG of the right size whose QR Code opens the alert", async ({ request }) => {
  test.setTimeout(120_000);
  const t = await createTutorWithActiveAlert("poster-qr", {
    petName: "Mel",
    breed: "Yorkshire Terrier",
    uniqueMarks: "Lacinho rosa na cabeça, orelhas em pé, pelo comprido e sedoso que cobre os olhos.",
    withPhoto: true,
    whatsapp: "11900000001",
  });
  created.push(t.email);

  const sizes = { square: [1080, 1080], story: [1080, 1920], landscape: [1920, 1080], og: [1200, 630] } as const;
  for (const [format, [w, h]] of Object.entries(sizes)) {
    const res = await request.get(`/alerta/${t.code}/cartaz/${format}`);
    expect(res.status(), format).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    const png = await res.body();
    writeFileSync(`test-results/cartaz-${format}.png`, png);
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height], format).toEqual([w, h]);
    const qr = await readQr(png);
    expect(qr, `QR do formato ${format}`).toMatch(new RegExp(`/alerta/${t.code}$`));
  }

  const download = await request.get(`/alerta/${t.code}/cartaz/story?baixar=1`);
  expect(download.headers()["content-disposition"]).toBe('attachment; filename="MEL-procura-se-Mel-story.png"');
});

test("the alert page shares the poster as link preview and offers the poster page", async ({ page, request }) => {
  const t = await createTutorWithActiveAlert("poster-page", { petName: "Luna", withPhoto: true });
  created.push(t.email);

  const html = await (await request.get(`/alerta/${t.code}`)).text();
  expect(html).toMatch(new RegExp(`<meta property="og:image" content="http://localhost:3100/alerta/${t.code}/cartaz/og"`));

  await page.goto(`/alerta/${t.code}`);
  await page.getByRole("link", { name: /Cartaz e QR Code/ }).click();
  await expect(page.getByRole("heading", { name: "Cartaz de Luna" })).toBeVisible();
  for (const label of ["Quadrado", "Stories / Status", "Horizontal"]) {
    await expect(page.getByRole("heading", { name: label })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /Baixar quadrado/ })).toHaveAttribute("href", `/alerta/${t.code}/cartaz/square?baixar=1`);

  // A4: QR legível e sem telefone (o tutor não autorizou).
  await page.getByRole("link", { name: /versão para imprimir/ }).click();
  await expect(page.getByRole("heading", { name: "PROCURA-SE" })).toBeVisible();
  await expect(page.getByText(/WhatsApp:|Telefone:/)).toHaveCount(0);
  const qrSrc = await page.getByRole("img", { name: "QR Code do alerta" }).getAttribute("src");
  const qr = await readQr(Buffer.from(qrSrc!.split(",")[1]!, "base64"));
  expect(qr).toMatch(new RegExp(`/alerta/${t.code}$`));
});

test("phone appears on the poster only when the tutor authorized it", async ({ page }) => {
  const t = await createTutorWithActiveAlert("poster-phone", { petName: "Thor", whatsapp: "11900000002" });
  created.push(t.email);
  await page.goto(`/alerta/${t.code}/cartaz/a4`);
  await expect(page.getByText("WhatsApp: (11) 90000-0002")).toBeVisible();
});

test("unknown alerts or formats return 404", async ({ request }) => {
  expect((await request.get("/alerta/zzzzzz/cartaz/square")).status()).toBe(404);
  expect((await request.get("/alerta/abc234/cartaz/a3")).status()).toBe(404);
});
