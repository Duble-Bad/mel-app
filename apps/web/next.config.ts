import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Um único .env.local na raiz do monorepo (também usado pelos testes de banco).
// Não sobrescreve variáveis já definidas (ex.: as da Vercel em produção).
const rootEnv = resolve(import.meta.dirname, "../../.env.local");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Headers de segurança em todas as respostas. CSP completa (scripts, estilos,
// conexões) fica para a preparação de produção (docs/12-checklist-lancamento.md):
// aqui só `frame-ancestors`, que não restringe nada do que o app carrega.
// Referrer-Policy NÃO pode ser no-referrer: a chave do MapTiler é restrita por
// domínio e depende do Origin/Referer.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // GPS no "Onde você viu?" e câmera (foto) só no próprio app; o resto, desligado.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), browsing-topics=()" },
  // Ignorado em http (localhost); em produção (https) fixa o HTTPS por 1 ano.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
