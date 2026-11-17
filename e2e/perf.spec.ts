import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createTutorWithActiveAlert } from "./support/alerts";
import { mockGeocoding } from "./support/geo";
import { deleteUserByEmail } from "./support/users";

/**
 * CELULAR BÁSICO EM REDE LENTA (desempenho, itens 01 e 31 de 2026-11-17).
 * Chrome DevTools: CPU 4× mais lenta e "4G lenta" (400 ms de latência, ~1,6 Mbps). Em cada tela
 * principal mede quando aparece o primeiro conteúdo (FCP), o maior conteúdo (LCP) e quanto o
 * layout pula (CLS), e lista o que passou de 3 s. Também confere que o esqueleto da página vem
 * no HTML inicial (aparece na hora, antes dos dados).
 *
 * Rodar contra o build de produção (o modo dev compila na hora e mede errado):
 *   $env:CI=1; npx playwright test e2e/perf.spec.ts --reporter=list
 * O resultado fica em test-results/perf-celular-lento.json.
 */

const created: string[] = [];
test.afterAll(async () => {
  for (const email of created) await deleteUserByEmail(email);
});

const LIMIT_MS = 3_000;

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

/** Coleta FCP, LCP e CLS da página (Web Vitals do próprio navegador). */
async function vitals(page: Page) {
  await page.waitForTimeout(1_500); // deixa o LCP e as mudanças de layout assentarem
  return page.evaluate(
    () =>
      new Promise<{ fcp: number; lcp: number; cls: number }>((resolve) => {
        const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1;
        let lcp = -1;
        let cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = e.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve({ fcp: Math.round(fcp), lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000 }), 300);
      }),
  );
}

test("celular básico em rede lenta: telas principais, o que passa de 3 s e quanto o layout pula", async ({ page, request }, info) => {
  test.setTimeout(300_000);
  const t = await createTutorWithActiveAlert("perf-lento", { petName: "Lento", photoSizes: [[1600, 1200]] });
  created.push(t.email);
  await mockGeocoding(page);

  const screens: [string, string][] = [
    ["Início", "/"],
    ["Mural", "/mural"],
    ["Mapa da Rede", "/mapa"],
    ["Adoção", "/adocao"],
    ["Parceiros", "/parceiros"],
    ["Alerta (pet perdido)", `/alerta/${t.code}`],
    ["Vi um pet solto", "/publicar/encontrado?vi=1"],
  ];

  // Esqueleto no HTML inicial: a página já chega com o formato do conteúdo, antes dos dados.
  for (const path of [`/alerta/${t.code}`, "/parceiros", "/publicar/encontrado?vi=1"]) {
    const html = await (await request.get(path)).text();
    expect(html, `${path}: esqueleto no HTML inicial`).toContain('data-testid="page-skeleton"');
  }

  await throttle(page);
  const rows: { tela: string; caminho: string; fcp: number; lcp: number; cls: number; passou3s: boolean }[] = [];
  for (const [tela, path] of screens) {
    await page.goto(path, { waitUntil: "load", timeout: 90_000 });
    const v = await vitals(page);
    rows.push({ tela, caminho: path.replace(t.code, "<código>"), ...v, passou3s: Math.max(v.fcp, v.lcp) > LIMIT_MS });
  }

  const table = rows.map((r) => `${r.passou3s ? "⚠" : "✓"} ${r.tela.padEnd(22)} FCP ${String(r.fcp).padStart(5)} ms  LCP ${String(r.lcp).padStart(5)} ms  CLS ${r.cls}`).join("\n");
  console.log(`\nCPU 4× + 4G lenta (limite ${LIMIT_MS} ms):\n${table}`);
  writeFileSync("test-results/perf-celular-lento.json", JSON.stringify(rows, null, 2));
  await info.attach("perf-celular-lento", { body: table, contentType: "text/plain" });

  // O que trava a experiência: primeiro conteúdo depois de 3 s ou layout pulando muito (CLS > 0,1 = "ruim" no Google).
  for (const r of rows) {
    expect(r.fcp, `${r.tela}: primeiro conteúdo em até 3 s`).toBeLessThanOrEqual(LIMIT_MS);
    expect(r.cls, `${r.tela}: layout estável (CLS ≤ 0,1)`).toBeLessThanOrEqual(0.1);
  }
});
