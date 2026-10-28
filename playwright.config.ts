import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Os testes usam a chave secreta para criar/remover usuários de teste.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3100;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: true,
  // Os testes falam com o Supabase remoto (sa-east-1): limitar o paralelismo
  // evita sobrecarregar o projeto de dev e dar espera realista para auth/uploads.
  workers: 3,
  expect: { timeout: 15_000 },
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  // Mobile-first: o fluxo principal é validado num celular mediano.
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: isCI ? `npm run build -w web && npm run start -w web -- -p ${PORT}` : `npm run dev -w web -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !isCI,
    // Habilita páginas internas de verificação (ex.: /dev/local). Nunca em produção.
    env: { MEL_DEV_ROUTES: "1" },
    timeout: 180_000,
  },
});
