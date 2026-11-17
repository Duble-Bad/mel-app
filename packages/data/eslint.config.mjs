import tseslint from "typescript-eslint";

// Só a complexidade ciclomática (2026-11-17): AVISO acima de 15 por função. Aqui é lógica pura
// (sem JSX), então o número reflete bem o risco. Não trava o build; serve de guia ao mexer.
export default [
  { ignores: ["**/*.test.ts", "**/*.unit.test.ts", "tests/**", "dist/**"] },
  // Comentários eslint-disable de outras regras (ex.: no-control-regex) não viram aviso aqui.
  { linterOptions: { reportUnusedDisableDirectives: "off" } },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    rules: { complexity: ["warn", 15] },
  },
];
