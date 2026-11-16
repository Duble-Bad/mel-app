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

test("every poster format (models of \"Criar cartaz\") is a PNG of the right size whose QR Code opens the alert", async ({ request }) => {
  test.setTimeout(120_000);
  const t = await createTutorWithActiveAlert("poster-qr", {
    petName: "Mel",
    breed: "Yorkshire Terrier",
    uniqueMarks: "Lacinho rosa na cabeça, orelhas em pé, pelo comprido e sedoso que cobre os olhos.",
    withPhoto: true,
    whatsapp: "11900000001",
  });
  created.push(t.email);

  // "og" (prévia do link) é a foto em destaque, sem QR: conferida em social-posters.spec.ts.
  // Sem ?estilo: o modelo padrão (o gerador antigo saiu em 2026-11-16).
  const sizes = { impressao: [1654, 2339], square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 630] } as const;
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

test("the alert page shares the poster as link preview; visitors open \"Criar cartaz\" and the old poster pages lead there", async ({ page, request }) => {
  const t = await createTutorWithActiveAlert("poster-page", { petName: "Luna", withPhoto: true });
  created.push(t.email);

  const html = await (await request.get(`/alerta/${t.code}`)).text();
  expect(html).toMatch(new RegExp(`<meta property="og:image" content="http://localhost:3100/alerta/${t.code}/cartaz/og"`));

  await page.goto(`/alerta/${t.code}`);
  await page.getByRole("link", { name: /Cartaz e QR Code/ }).click();
  await expect(page).toHaveURL(new RegExp(`/alerta/${t.code}/cartaz/criar$`));
  await expect(page.getByTestId("formato-square")).toBeVisible();

  // Gerador antigo (2026-11-16): a página de cartazes e o A4 em HTML levam ao fluxo novo.
  await page.goto(`/alerta/${t.code}/cartaz`);
  await expect(page).toHaveURL(new RegExp(`/alerta/${t.code}/cartaz/criar$`));
  await page.goto(`/alerta/${t.code}/cartaz/a4`);
  await expect(page).toHaveURL(new RegExp(`/alerta/${t.code}/cartaz/criar\\?formato=impressao$`));
});

test("unknown alerts or formats return 404", async ({ request }) => {
  expect((await request.get("/alerta/zzzzzz/cartaz/square")).status()).toBe(404);
  expect((await request.get("/alerta/abc234/cartaz/a3")).status()).toBe(404);
});
