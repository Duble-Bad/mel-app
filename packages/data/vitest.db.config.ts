import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { assertSafeTarget } from "../../scripts/lib/safe-target.mjs";

// Testes de integração contra o projeto Supabase de desenvolvimento (RLS, RPCs).
// Lê as chaves de .env.local na raiz do repositório.
const envFile = resolve(import.meta.dirname, "../../.env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
// Os testes criam e apagam usuários e dados: só local ou dev listado (nunca produção).
assertSafeTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, "testes de banco");

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
