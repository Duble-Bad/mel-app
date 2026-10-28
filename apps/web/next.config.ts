import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Um único .env.local na raiz do monorepo (também usado pelos testes de banco).
// Não sobrescreve variáveis já definidas (ex.: as da Vercel em produção).
const rootEnv = resolve(import.meta.dirname, "../../.env.local");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pacotes do monorepo são publicados como TypeScript fonte.
  transpilePackages: ["@mel/core", "@mel/data", "@mel/ui-tokens"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
