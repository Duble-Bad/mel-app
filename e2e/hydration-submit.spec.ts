import { expect, test } from "@playwright/test";

// Formulários que dependem de JavaScript: antes de a página ficar interativa,
// um toque em "Enviar" recarregaria a página e o texto digitado sumiria.
// Por isso o botão nasce desabilitado (no HTML do servidor) e libera sozinho.

test.describe("sem JavaScript (página ainda não interativa)", () => {
  test.use({ javaScriptEnabled: false });

  test("o envio fica travado: o clique não recarrega a página nem perde o texto", async ({ page }) => {
    await page.goto("/entrar/recuperar");
    const submit = page.getByRole("button", { name: "Enviar link" });
    await expect(submit).toBeDisabled();
    await page.getByLabel("E-mail").fill("alguem@exemplo.com");
    // Enter num campo também não envia quando o botão padrão está desabilitado.
    await page.getByLabel("E-mail").press("Enter");
    await expect(page).toHaveURL(/\/entrar\/recuperar$/);
    await expect(page.getByLabel("E-mail")).toHaveValue("alguem@exemplo.com");
  });
});

test("com a página pronta, o botão libera sozinho", async ({ page }) => {
  await page.goto("/entrar/recuperar");
  const submit = page.getByRole("button", { name: "Enviar link" });
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveAttribute("data-hydrated", "true");
});
