import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Complexidade ciclomática (2026-11-17): AVISO, não erro, acima de 25 nas telas e rotas. Em
  // componentes React cada "cond && <Bloco/>" e "a ? b : c" do JSX conta como decisão, então o
  // limite é maior que no core/data. Guia para quebrar funções ao mexer nelas; não trava o build.
  { files: ["**/*.{ts,tsx}"], rules: { complexity: ["warn", 25] } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worker do MapLibre copiado no build (código de terceiros).
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
