import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Testes de integração contra o projeto Supabase de desenvolvimento (RLS, RPCs).
// Lê as chaves de .env.local na raiz do repositório.
const envFile = resolve(import.meta.dirname, "../../.env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
