import { defineConfig } from "vitest/config";

// Unitários (sem rede, sem banco). Os testes de banco ficam em vitest.db.config.ts.
export default defineConfig({
  test: {
    include: ["src/**/*.unit.test.ts"],
  },
});
