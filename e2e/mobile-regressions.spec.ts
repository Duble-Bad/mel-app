import { expect, test, type Page } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { SE } from "./support/geo";
import { createUser, deleteUserByEmail } from "./support/users";
import { createClient } from "@supabase/supabase-js";

// Regressões achadas na inspeção real no celular (2026-11-06).
const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

const NAV = ["Início", "Mapa da Rede", "Mural", "Adoção", "Parceiros"];

test("mobile menu shows every item on short and tall phones, and closes", async ({ page }) => {
  test.slow(); // duas alturas de tela, cada uma com carga completa da home
  for (const height of [915, 568]) {
    await page.setViewportSize({ width: 360, height });
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const menu = page.locator("#menu-celular");
    // Antes: o backdrop-filter do cabeçalho prendia o painel em 64 px e só "Início" aparecia.
    for (const label of NAV) {
      const link = menu.getByRole("link", { name: label, exact: true });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
    }
    expect((await menu.boundingBox())!.height).toBeGreaterThan(height / 2);
    await page.getByRole("button", { name: "Fechar menu" }).click();
    await expect(menu).toHaveCount(0);
  }
});

/** Marca o canvas atual: se o mapa for recriado, a marca some. */
async function markMap(page: Page) {
  await page.locator("canvas.maplibregl-canvas").evaluate((c) => c.setAttribute("data-e2e-mark", "1"));
}

test("map tab survives 'Perto de mim' and 'Buscar nesta área' (no remount, no jump back to the list)", async ({ browser }) => {
  test.slow(); // mapa real (blocos do MapTiler) disputa CPU com a suíte em paralelo
  const ctx = await browser.newContext({ ...test.info().project.use, geolocation: SE, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  await page.goto("/mapa");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await markMap(page);

  await page.getByRole("button", { name: /Perto de mim/ }).click();
  await expect(page).toHaveURL(/lat=/);
  // Centro no endereço com no máximo 3 casas (~110 m): o link não revela o ponto exato.
  const lat = new URL(page.url()).searchParams.get("lat")!;
  expect(lat.split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
  await expect(page.getByTestId("map-near-me")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mapa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('canvas[data-e2e-mark="1"]')).toBeVisible();

  // Move o mapa para longe (setas do teclado do MapLibre) e busca ali.
  await page.locator("canvas.maplibregl-canvas").focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Buscar nesta área" }).click();
  await expect(page.getByRole("button", { name: "Buscar nesta área" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mapa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('canvas[data-e2e-mark="1"]')).toBeVisible();
  await ctx.close();
});

test("a photo that fails to load shows a clear placeholder; the mobile detail panel keeps the title and actions on screen", async ({ page }) => {
  test.slow();
  const t = await createTutorWithActiveAlert("photo-fallback", { petName: "Fumaça", withPhoto: true });
  created.push(t.email);
  await page.route("**/storage/v1/object/public/**", (route) => route.abort());

  await page.goto("/mural?tipos=lost");
  const card = page.getByTestId("case-card").filter({ hasText: "Fumaça" });
  await expect(card.getByText("Foto indisponível")).toBeVisible();

  await page.goto("/mapa?tipos=lost");
  await page.getByTestId("case-card").filter({ hasText: "Fumaça" }).click();
  const panel = page.getByTestId("map-selected");
  await expect(panel.getByText("Foto indisponível")).toBeVisible();
  await expect(panel.getByRole("heading", { name: /Fumaça/ })).toBeInViewport();
  await expect(panel.getByRole("link", { name: /Ver alerta/ })).toBeInViewport();
});

test("test cleanup finds and deletes the users it created, even with hundreds of accounts", async () => {
  const { id, email } = await createUser("cleanup-check");
  await deleteUserByEmail(email);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.getUserById(id);
  // Antes, só a 1ª página de 200 contas era lida: usuários novos sobravam e poluíam mapa e mural.
  expect(data.user).toBeNull();
});


test("the home map preview is the real map with real database cases, and opens /mapa", async ({ page }) => {
  test.slow();
  const t = await createTutorWithActiveAlert("home-map", { petName: "Cacau" }); // alerta real no centro padrão
  created.push(t.email);
  await page.goto("/");
  const preview = page.getByTestId("home-map");
  await preview.scrollIntoViewIfNeeded();
  // Mesmos casos do /mapa: o número vem do banco (inclui o alerta criado agora) e o mapa é o MapLibre.
  await expect(preview).toHaveAttribute("data-map-status", "ready", { timeout: 20_000 });
  expect(Number(await preview.getAttribute("data-cases"))).toBeGreaterThan(0);
  await expect(preview.locator("canvas.maplibregl-canvas")).toHaveCount(1);
  await expect(page.getByText(/Prévia ilustrativa|ruas desenhadas/)).toHaveCount(0);
  await preview.getByRole("link", { name: /Abrir o mapa da rede MEL/ }).click();
  await expect(page).toHaveURL(/\/mapa$/);
});

/** Centro (px) de cada ponto e onde a projeção do mapa diz que ele e a sua área deveriam estar. */
async function areaGeometry(page: Page) {
  return page.locator('[role="region"][data-view]').evaluate((map) => {
    const [clat, clng, zoom] = map.dataset.view!.split(",").map(Number) as [number, number, number];
    const world = 512 * 2 ** zoom;
    const merc = (lat: number, lng: number) => [((lng + 180) / 360) * world, ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * world];
    const box = map.getBoundingClientRect();
    const [cx, cy] = merc(clat, clng) as [number, number];
    const toPx = (s: string) => {
      const [lat, lng] = s.split(",").map(Number) as [number, number];
      const [x, y] = merc(lat, lng) as [number, number];
      return { x: box.left + box.width / 2 + x - cx, y: box.top + box.height / 2 + y - cy };
    };
    // 100 m em px neste zoom e latitude (raio do círculo da área).
    const radiusPx = 100 / ((40_075_016.686 * Math.cos((clat * Math.PI) / 180)) / world);
    return [...map.querySelectorAll<HTMLElement>(".mel-area-dot")].map((dot) => {
      const r = dot.getBoundingClientRect();
      const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const pos = toPx(dot.dataset.pos!);
      const area = toPx(dot.dataset.area!);
      return {
        label: dot.getAttribute("aria-label"),
        position: getComputedStyle(dot).position,
        offPx: Math.hypot(at.x - pos.x, at.y - pos.y),
        fromAreaPx: Math.hypot(pos.x - area.x, pos.y - area.y),
        radiusPx,
      };
    });
  });
}

async function expectDotsOnTheirAreas(page: Page) {
  // Espera o fim da animação (centro/zoom estáveis) antes de medir.
  const view = page.locator("[role=region][data-view]");
  await expect
    .poll(async () => {
      const before = await view.getAttribute("data-view");
      await page.waitForTimeout(400);
      return before === (await view.getAttribute("data-view"));
    })
    .toBe(true);
  const dots = await areaGeometry(page);
  expect(dots.length).toBeGreaterThanOrEqual(3);
  for (const d of dots) {
    expect(d.position, d.label!).toBe("absolute");
    // O ponto está onde o mapa projeta a sua coordenada (o círculo usa a mesma projeção)...
    expect(d.offPx, d.label!).toBeLessThan(1.5);
    // ...e dentro do círculo de 100 m da sua célula (casos na mesma célula se abrem ~45 m).
    expect(d.fromAreaPx, d.label!).toBeLessThanOrEqual(d.radiusPx * 0.6 + 0.5);
  }
}

test("map dots sit on their approximate-area circles, also after coming from the home page, panning and zooming", async ({ browser }) => {
  test.slow();
  // Dois casos na mesma célula (abertos em volta do centro) e um noutra célula.
  const near = { lat: -23.5432, lng: -46.6283, label: "Liberdade, São Paulo – SP" };
  for (const [name, at] of [["Geo1", near], ["Geo2", near], ["Geo3", { lat: -23.5531, lng: -46.6402, label: "Sé, São Paulo – SP" }]] as const) {
    const t = await createTutorWithActiveAlert(`geo-${name.toLowerCase()}`, { petName: name, at });
    created.push(t.email);
  }
  const ctx = await browser.newContext({ ...test.info().project.use, geolocation: SE, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  // O bug só aparecia vindo da home: o CSS do mapa carregava depois do MapLibre e tirava o
  // `position: absolute` dos pontos (cada ponto ia 30 px para o lado, longe do seu círculo).
  await page.goto("/");
  const preview = page.getByTestId("home-map");
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute("data-map-status", "ready", { timeout: 20_000 });
  await preview.getByRole("link", { name: /Abrir o mapa da rede MEL/ }).click();
  await expect(page).toHaveURL(/\/mapa$/);
  // Celular: aba Mapa (o clique antes da hidratação não troca; repete até trocar).
  const mapTab = page.getByRole("button", { name: "Mapa", exact: true });
  await expect(async () => {
    await mapTab.click();
    await expect(mapTab).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.locator('[role="region"][data-map-status="ready"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".mel-area-dot")).not.toHaveCount(0);
  await expectDotsOnTheirAreas(page);

  // Zoom (até o círculo tracejado em metros) e movimento: os pontos acompanham as áreas.
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Aproximar" }).click();
  await page.waitForTimeout(800);
  await expectDotsOnTheirAreas(page);
  await page.getByRole("button", { name: "Afastar" }).click();
  await page.locator("canvas.maplibregl-canvas").focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(800);
  await expectDotsOnTheirAreas(page);
  await ctx.close();
});

test("sign-in tabs: the selected tab is MEL gold and the other one is plain, in both states", async ({ page }) => {
  await page.goto("/entrar");
  const signIn = page.getByRole("tab", { name: "Entrar" });
  const signUp = page.getByRole("tab", { name: "Criar conta" });
  // O destaque é o indicador dourado (atrás da aba) + texto escuro em negrito na aba ativa.
  const indicator = page.locator('[role="tablist"] > span[aria-hidden="true"]');
  await expect(indicator).toHaveCSS("background-color", "rgb(246, 185, 40)");
  const look = async () => ({
    in: await signIn.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).fontWeight]),
    up: await signUp.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).fontWeight]),
    x: (await indicator.boundingBox())!.x,
  });
  await expect(signIn).toHaveAttribute("aria-selected", "true");
  const a = await look();
  expect(a.in).toEqual(["rgb(28, 20, 4)", "700"]);
  expect(a.up[0]).not.toBe("rgb(28, 20, 4)");
  expect(Math.abs(a.x - (await signIn.boundingBox())!.x)).toBeLessThan(6);

  await signUp.click();
  await expect(signUp).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Criar conta", exact: true })).toBeVisible(); // lógica do cadastro intacta
  await expect.poll(async () => Math.abs((await indicator.boundingBox())!.x - (await signUp.boundingBox())!.x)).toBeLessThan(6);
  const b = await look();
  expect(b.up).toEqual(["rgb(28, 20, 4)", "700"]);
  expect(b.in[0]).not.toBe("rgb(28, 20, 4)");
});

test("photo gallery: thumbnails, enlarge, next/previous, close (✕ and Esc) and a clear error when a photo fails", async ({ page }) => {
  test.slow();
  const t = await createTutorWithActiveAlert("gallery", { petName: "Galeria", photos: 3 });
  created.push(t.email);
  await page.goto(`/alerta/${t.code}`);
  const gallery = page.getByTestId("photo-gallery");
  await expect(gallery).toHaveAttribute("data-photos", "3");
  await expect(gallery.getByRole("button", { name: /^Mostrar foto/ })).toHaveCount(3);
  // Carrossel automático: corre sozinho e para no botão de pausa (o resto do teste é manual, sem corrida).
  await expect(gallery).toHaveAttribute("data-autoplay", "on");
  await gallery.getByRole("button", { name: "Pausar troca automática das fotos" }).click();
  await expect(gallery).toHaveAttribute("data-autoplay", "off");
  await gallery.getByRole("button", { name: "Mostrar foto 2 de 3 de Galeria" }).click();
  await expect(gallery.locator("img").first()).toHaveAttribute("alt", "Foto 2 de 3 de Galeria");
  // Setas na própria foto grande trocam no lugar (sem abrir a tela cheia).
  await gallery.getByRole("button", { name: "Próxima foto" }).first().click();
  await expect(gallery.locator("img").first()).toHaveAttribute("alt", "Foto 3 de 3 de Galeria");
  await gallery.getByRole("button", { name: "Foto anterior" }).first().click();
  await expect(gallery.locator("img").first()).toHaveAttribute("alt", "Foto 2 de 3 de Galeria");

  await gallery.getByRole("button", { name: /^Ampliar/ }).click();
  const dialog = page.getByRole("dialog", { name: "Fotos de Galeria" });
  await expect(dialog.getByText("2 de 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Próxima foto" }).click();
  await expect(dialog.getByText("3 de 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Próxima foto" }).click(); // volta ao início
  await expect(dialog.getByText("1 de 3")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByText("3 de 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar fotos" }).click();
  await expect(dialog).toBeHidden();
  await gallery.getByRole("button", { name: /^Ampliar/ }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // A foto não carrega: aviso claro, sem ícone quebrado.
  await page.route(/pet-photos/, (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("img", { name: "Foto indisponível" })).toBeVisible();
});

test("detail map opens with the public area name visible, taller, with attribution — directly and from the map side panel", async ({ page }) => {
  test.slow();
  const t = await createTutorWithActiveAlert("detail-map", { petName: "Regiao" });
  created.push(t.email);
  const check = async () => {
    const section = page.locator('section[aria-labelledby="mapa"]');
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('[data-map-status="ready"]')).toBeVisible({ timeout: 20_000 });
    // O bairro aparece sem interação (não depende dos rótulos do estilo no zoom inicial).
    await expect(section.getByTestId("map-area-label")).toHaveText("Sé, São Paulo – SP");
    // Mais alto que antes (224 px) e sem rolagem horizontal.
    expect((await section.locator('[data-map-status="ready"]').boundingBox())!.height).toBeGreaterThanOrEqual(280);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(section.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
  };
  await page.goto(`/alerta/${t.code}`);
  await check();

  // Pelo painel lateral do mapa da rede (navegação no cliente).
  await page.goto("/mapa");
  await page.getByTestId("case-card").filter({ hasText: "Regiao" }).first().click();
  await page.getByTestId("map-selected").getByRole("link", { name: "Ver alerta" }).click();
  await expect(page).toHaveURL(new RegExp(`/alerta/${t.code}`));
  await check();
});
