import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { createTutorWithActiveAlert } from "./support/alerts";
import { deleteUserByEmail } from "./support/users";

// "Ajude compartilhando": WhatsApp e Facebook levam o link do alerta; Instagram e TikTok
// levam o cartaz (Stories 9:16) para a pessoa publicar no app — nada é publicado sozinho.
const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

/** Troca window.open e o menu nativo por gravadores (sem abrir sites externos). */
async function recordShares(page: Page, { canShareFiles }: { canShareFiles: boolean }) {
  await page.addInitScript((canShareFiles) => {
    const w = window as unknown as { __opened: string[]; __shared: { title?: string; text?: string; url?: string; files?: { name: string; type: string; size: number; width: number; height: number }[] }[] };
    w.__opened = [];
    w.__shared = [];
    window.open = (url?: string | URL) => {
      w.__opened.push(String(url));
      return null;
    };
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: ShareData) => {
        const files = d.files
          ? await Promise.all(d.files.map(async (f) => { const b = await createImageBitmap(f); return { name: f.name, type: f.type, size: f.size, width: b.width, height: b.height }; }))
          : undefined;
        w.__shared.push({ title: d.title, text: d.text, url: d.url, files });
      },
    });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (d: ShareData) => !d.files || canShareFiles });
  }, canShareFiles);
}

test("share section: WhatsApp and Facebook links, Instagram/TikTok poster flows, and the existing options keep working", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const t = await createTutorWithActiveAlert("share", { petName: "Compartilha", withPhoto: true });
  created.push(t.email);
  const alertUrl = `${baseURL}/alerta/${t.code}`;

  const ctx = await browser.newContext({ ...test.info().project.use, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await recordShares(page, { canShareFiles: true });
  await page.goto(`/alerta/${t.code}`);
  const section = page.locator('section[aria-labelledby="compartilhar"]');
  await expect(section.getByRole("heading", { name: "Ajude compartilhando" })).toBeVisible();

  // Quatro redes com nome visível, alvos de toque ≥ 44 px, numa linha no celular.
  const names = ["WhatsApp", "Facebook", "TikTok", "Instagram"];
  const tiles = section.getByTestId("share-networks").getByRole("button");
  await expect(tiles).toHaveCount(4);
  for (const [i, name] of names.entries()) {
    await expect(tiles.nth(i)).toContainText(name);
    const box = (await tiles.nth(i).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const opened = () => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  const shared = () => page.evaluate(() => (window as unknown as { __shared: { title?: string; text?: string; url?: string; files?: { name: string; type: string; size: number; width: number; height: number }[] }[] }).__shared);

  // WhatsApp: o mesmo texto de antes, com o link do alerta.
  await section.getByRole("button", { name: "Compartilhar no WhatsApp" }).click();
  const wa = new URL((await opened())[0]!);
  expect(wa.origin + wa.pathname).toBe("https://wa.me/");
  expect(wa.searchParams.get("text")).toContain("Compartilha");
  expect(wa.searchParams.get("text")).toContain(alertUrl);

  // Facebook: compartilhamento oficial pela web, só o link do alerta.
  await section.getByRole("button", { name: "Compartilhar no Facebook" }).click();
  const fb = new URL((await opened())[1]!);
  expect(fb.origin + fb.pathname).toBe("https://www.facebook.com/sharer/sharer.php");
  expect(fb.searchParams.get("u")).toBe(alertUrl);

  // Instagram: escolhe o formato; com envio de arquivos (celular), o cartaz certo vai ao menu do sistema.
  const instagram = section.getByRole("button", { name: "Publicar no Instagram" });
  await instagram.click();
  await expect(instagram).toHaveAttribute("aria-expanded", "true");
  const guide = section.getByTestId("share-image-guide");
  await expect(guide).toContainText("Qual formato do Instagram?");
  // Sem ações duplicadas no painel (baixar/copiar ficam nas opções gerais).
  await expect(guide.getByRole("button", { name: /Copiar link|Baixar/ })).toHaveCount(0);
  for (const [option, format, size] of [
    [/^Stories \(9:16/, "story", [1080, 1920]],
    [/^Feed \(4:5/, "portrait", [1080, 1350]],
    [/^Feed quadrado \(1:1/, "square", [1080, 1080]],
  ] as const) {
    await guide.getByRole("button", { name: option }).click();
    await expect(section.getByTestId("share-status")).toHaveText("Cartaz entregue ao app escolhido. Se o Instagram não apareceu na lista, salve a imagem e publique pelo app do Instagram.");
    const sent = (await shared()).at(-1)!;
    expect(sent.files?.[0]).toMatchObject({ type: "image/png", name: `MEL-Compartilha-${format}.png`, width: size[0], height: size[1] });
    expect(sent.text).toContain(alertUrl);
  }

  // TikTok: só o formato que a publicação de foto usa (vertical 9:16); tocar de novo fecha.
  const tiktok = section.getByRole("button", { name: "Publicar no TikTok" });
  await tiktok.click();
  await expect(instagram).toHaveAttribute("aria-expanded", "false");
  await expect(guide).toContainText("Cartaz para publicar no TikTok");
  await expect(guide.getByRole("button")).toHaveCount(1);
  await guide.getByRole("button", { name: /^Foto vertical \(9:16/ }).click();
  await expect(section.getByTestId("share-status")).toContainText("Se o TikTok não apareceu na lista");
  expect((await shared()).at(-1)!.files?.[0]).toMatchObject({ width: 1080, height: 1920 });
  await tiktok.click();
  await expect(guide).toHaveCount(0);

  // Opções que já existiam: Mais opções (menu nativo), Copiar link e Cartaz e QR Code.
  await section.getByRole("button", { name: "Mais opções" }).click();
  expect((await shared()).at(-1)!.url).toBe(alertUrl);
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await section.getByRole("button", { name: "Copiar link" }).last().click();
  await expect(section.getByRole("button", { name: "Link copiado!" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(alertUrl);
  await expect(section.getByRole("link", { name: /Cartaz e QR Code/ })).toHaveAttribute("href", `/alerta/${t.code}/cartaz`);

  // "Eu vi este pet" e o aviso de segurança continuam; nada privado do tutor na página.
  await expect(page.getByRole("link", { name: /EU VI ESTE PET/i }).first()).toBeVisible();
  expect(await page.content()).not.toContain(t.email);
  await ctx.close();
});

test("Instagram/TikTok without file sharing (desktop): the chosen format is downloaded with an honest message", async ({ browser }) => {
  const t = await createTutorWithActiveAlert("share-nofiles", { petName: "SemArquivo", withPhoto: true });
  created.push(t.email);
  const ctx = await browser.newContext({ ...test.info().project.use });
  const page = await ctx.newPage();
  await recordShares(page, { canShareFiles: false });
  await page.goto(`/alerta/${t.code}`);
  const section = page.locator('section[aria-labelledby="compartilhar"]');
  await section.getByRole("button", { name: "Publicar no Instagram" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    section.getByTestId("share-image-guide").getByRole("button", { name: /^Feed \(4:5/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("MEL-SemArquivo-portrait.png");
  const meta = await sharp(await download.createReadStream().then(async (st) => Buffer.concat(await st.toArray()))).metadata();
  expect([meta.width, meta.height]).toEqual([1080, 1350]);
  await expect(section.getByTestId("share-status")).toHaveText("Este navegador não envia imagens direto para o Instagram. Baixamos o cartaz: abra o app do Instagram e publique a partir da galeria.");
  // Nada foi enviado ao menu do sistema (não houve compartilhamento a fingir).
  expect(await page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(0);
  await ctx.close();
});
