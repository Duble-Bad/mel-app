import { expect, test, type Page } from "@playwright/test";
import { getBusiness } from "../packages/data/src/partners";
import { createApprovedAdoption, createApprovedNgo, createModerator, signedClient } from "./support/partners";
import { createUser, deleteUserByEmail, setRole, TEST_PASSWORD } from "./support/users";

// Adoção no mapa da rede (configuração de administrador) e regras de localização
// de ONGs, empresas e pessoas físicas. A configuração é global: o teste roda em
// série e sempre devolve "desligado" no final.
test.describe.configure({ mode: "serial" });

const created: string[] = [];
let adminEmail = "";
test.afterAll(async () => {
  if (adminEmail) await (await signedClient(adminEmail)).rpc("admin_set_map_setting", { p_key: "show_adoption_on_map", p_value: false });
  for (const email of created) await deleteUserByEmail(email);
});

// Local REAL do animal (fictício, Vila Prudente) ≠ sede da ONG (fictícia, Ipiranga, ~3 km).
const ANIMAL = { lat: -23.582213, lng: -46.580617, label: "Rua Fictícia do Lar, 10", neighborhood: "Vila Prudente" };
const SEDE = { lat: -23.586617, lng: -46.610643, label: "Rua Fictícia da Sede, 200 – Ipiranga", neighborhood: "Ipiranga" };
const MAP = `/mapa?lat=-23.582&lng=-46.581&raio=3&periodo=todos`;

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Sessão pronta: saiu da tela de entrar.
  await expect(page).not.toHaveURL(/\/entrar/, { timeout: 30_000 });
}

async function openMapTab(page: Page) {
  await page.goto(MAP);
  const tab = page.getByRole("button", { name: "Mapa", exact: true });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.locator('[role="region"][data-map-status="ready"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("map-count")).not.toHaveText("Procurando…");
}

const suffix = Date.now() % 100_000;
const PET = `Adotável Teste ${suffix}`;
const NGO = `ONG Fictícia ${suffix}`;

test("adoption on the network map: off by default, only admins switch it, gold marker + card at the animal's approximate area (not the NGO's HQ)", async ({ browser, page }) => {
  test.setTimeout(180_000);
  const [owner, user, admin] = await Promise.all([
    createUser("adoc-ong", { onboarded: true }),
    createUser("adoc-comum", { onboarded: true }),
    createUser("adoc-admin", { onboarded: true }),
  ]);
  const mod = await createModerator("adoc-mod");
  created.push(owner.email, user.email, admin.email, mod.email);
  await setRole(admin.id, "admin");
  adminEmail = admin.email;
  await createApprovedNgo(owner.email, owner.id, mod.client, NGO, SEDE, false);
  const code = await createApprovedAdoption(owner.email, owner.id, mod.client, PET, ANIMAL);

  // 1. Desligado (padrão): sem marcador nem legenda de adoção; o anúncio segue na lista e na página de adoção.
  await openMapTab(page);
  await expect(page.getByTestId("map-legend")).not.toContainText("Adoção");
  await expect(page.locator('.mel-area-dot[data-kind="adoption"]')).toHaveCount(0);
  await page.goto("/adocao");
  await expect(page.getByText(PET).first()).toBeVisible();

  // 2. Usuário comum: o banco recusa (não só a tela) e o painel não existe para ele.
  const { error } = await (await signedClient(user.email)).rpc("admin_set_map_setting", { p_key: "show_adoption_on_map", p_value: true });
  expect(error?.code).toBe("42501");
  const userPage = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await signIn(userPage, user.email, "/");
  await userPage.goto("/admin");
  await expect(userPage.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();
  await userPage.close();
  // Moderador (não administrador) não vê a configuração.
  const modPage = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await signIn(modPage, mod.email, "/admin");
  await expect(modPage.getByRole("heading", { name: /Moderação/ })).toBeVisible();
  await expect(modPage.getByTestId("admin-map-settings")).toHaveCount(0);
  await modPage.close();

  // 3. Administrador liga no painel.
  const adminPage = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await signIn(adminPage, admin.email, "/admin");
  const toggle = adminPage.getByTestId("admin-map-settings").getByRole("switch", { name: /Mostrar animais disponíveis para adoção no mapa/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(adminPage.getByText("Adoção aparece no mapa da rede.")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // 4. Visitante: legenda com Adoção e marcador dourado na área APROXIMADA do animal.
  await openMapTab(page);
  await expect(page.getByTestId("map-legend")).toContainText("Adoção");
  const dot = page.locator(`.mel-area-dot[data-kind="adoption"][aria-label*="${PET}"]`);
  await expect(dot).toHaveCount(1);
  expect(await dot.evaluate((e) => e.style.getPropertyValue("--c"))).toBe("#f6b928"); // dourado da adoção
  const [lat, lng] = (await dot.getAttribute("data-area"))!.split(",").map(Number) as [number, number];
  expect(lat === ANIMAL.lat && lng === ANIMAL.lng).toBe(false); // nunca o ponto exato
  expect(Math.hypot((lat - ANIMAL.lat) * 111_320, (lng - ANIMAL.lng) * 102_000)).toBeLessThan(150); // célula de 100 m do animal
  expect(Math.hypot((lat - SEDE.lat) * 111_320, (lng - SEDE.lng) * 102_000)).toBeGreaterThan(1_000); // não é a sede da ONG
  const html = await page.content();
  expect(html).not.toContain(String(ANIMAL.lat));
  expect(html).not.toContain(String(SEDE.lat));

  // Card: foto, nome, categoria, região, instituição (sem afirmar que o animal está na sede) e "Ver detalhes".
  await dot.click();
  const card = page.getByTestId("map-selected");
  await expect(card.getByRole("heading", { name: PET })).toBeVisible();
  await expect(card.locator(".mel-badge")).toHaveText("Adoção");
  await expect(card).toContainText("Vila Prudente, São Paulo – SP");
  await expect(card.getByTestId("map-selected-note")).toHaveText(`Disponível para adoção pela ONG ${NGO}. O animal pode não estar na sede.`);
  await expect(card.getByRole("link", { name: "Ver detalhes" })).toHaveAttribute("href", `/adocao/${code}`);
  await card.getByRole("link", { name: "Ver detalhes" }).click();
  await expect(page.getByTestId("adoption-institution")).toContainText(`Disponível para adoção pela ONG ${NGO}`);
  await expect(page.getByTestId("adoption-institution")).toContainText("O animal pode não estar na sede.");

  // 5. Desligar volta a esconder (no mapa), sem tirar da lista de adoção.
  await adminPage.reload();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await adminPage.close();
  await openMapTab(page);
  await expect(page.locator('.mel-area-dot[data-kind="adoption"]')).toHaveCount(0);
  await expect(page.getByTestId("map-legend")).not.toContainText("Adoção");
});

test("partner addresses: NGO HQ exact only after consent + admin validation; residence, home service and independent protector stay approximate", async ({ browser, page }) => {
  test.setTimeout(150_000);
  const [ngoOwner, homeOwner, protector, admin] = await Promise.all([
    createUser("end-ong", { onboarded: true }),
    createUser("end-casa", { onboarded: true }),
    createUser("end-protetor", { onboarded: true }),
    createUser("end-admin", { onboarded: true }),
  ]);
  const mod = await createModerator("end-mod");
  created.push(ngoOwner.email, homeOwner.email, protector.email, admin.email, mod.email);
  await setRole(admin.id, "admin");

  // ONG que declarou a sede como endereço público e autorizou; outra ONG que NÃO autorizou (atende em casa).
  const sede = await createApprovedNgo(ngoOwner.email, ngoOwner.id, mod.client, `ONG Sede ${suffix}`, SEDE, true);
  const casa = await createApprovedNgo(homeOwner.email, homeOwner.id, mod.client, `ONG Em Casa ${suffix}`, { ...ANIMAL, label: "Rua da Casa da Voluntária, 5" }, false);

  // Antes da validação do administrador: só bairro/cidade e ponto aproximado, também na API pública.
  await page.goto(`/parceiros/${sede}`);
  await expect(page.getByText("Ipiranga, São Paulo – SP").first()).toBeVisible();
  await expect(page.getByText("(região aproximada)").first()).toBeVisible();
  expect(await page.content()).not.toContain(SEDE.label);
  const anon = (await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const before = await getBusiness(anon as never, sede);
  expect(before?.addressPublic).toBe(false);
  expect(before?.position).toEqual({ lat: -23.59, lng: -46.61 });

  // Administrador valida a sede autorizada.
  const adminPage = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await signIn(adminPage, admin.email, `/parceiros/${sede}`);
  await adminPage.getByTestId("admin-public-address").getByRole("button", { name: "Liberar endereço exato no mapa" }).click();
  await expect(adminPage.getByText("Endereço liberado no mapa.")).toBeVisible();
  // A ONG que não autorizou não tem o botão (e o banco recusaria).
  await adminPage.goto(`/parceiros/${casa}`);
  await expect(adminPage.getByTestId("admin-public-address")).toContainText("O parceiro não autorizou mostrar o endereço");
  await expect(adminPage.getByRole("button", { name: "Liberar endereço exato no mapa" })).toHaveCount(0);
  const { error: refused } = await (await signedClient(admin.email)).rpc("admin_set_business_public_address", { p_code: casa, p_public: true });
  expect(refused?.code).toBe("22023");
  await adminPage.close();

  // Visitante: sede com endereço público exato; casa da voluntária só com a região.
  await page.goto(`/parceiros/${sede}`);
  await expect(page.getByText(SEDE.label).first()).toBeVisible();
  await expect(page.getByText("(região aproximada)")).toHaveCount(0);
  const after = await getBusiness(anon as never, sede);
  expect(after?.addressPublic).toBe(true);
  expect(after?.position).toEqual({ lat: SEDE.lat, lng: SEDE.lng });
  await page.goto(`/parceiros/${casa}`);
  await expect(page.getByText("Vila Prudente, São Paulo – SP").first()).toBeVisible();
  await expect(page.getByText("(região aproximada)").first()).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain("Rua da Casa da Voluntária");
  expect(html).not.toContain(String(ANIMAL.lat));

  // Protetor independente (pessoa física) nunca divulga endereço: o banco recusa.
  const { error } = await (await signedClient(protector.email)).from("businesses").insert({
    owner_id: protector.id,
    partner_kind: "independent",
    name: "Protetor Fictício",
    category: "ngo",
    description: "Protetor fictício de teste automatizado (nunca publicado).",
    address_label: "Minha casa, 1",
    lat: -23.53,
    lng: -46.55,
    city: "São Paulo – SP",
    neighborhood: "Penha",
    address_public_consent: true,
  } as never);
  expect(error?.code).toBe("22023");
});
