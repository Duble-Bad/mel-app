// Prova que cada regra de .dependency-cruiser.cjs acusa a violação que promete.
// Planta arquivos temporários (prefixo __deps_teste__) nas camadas reais, roda o
// Dependency Cruiser só neles e apaga tudo no fim, mesmo se o teste falhar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const P = "__deps_teste__";

/** Cada caso: arquivos plantados e a regra que deve acusar (no arquivo `from`). */
const CASES = [
  {
    rule: "sem-ciclos",
    files: {
      [`packages/core/src/${P}a.ts`]: `import { b } from "./${P}b";\nexport const a = () => b;`,
      [`packages/core/src/${P}b.ts`]: `import { a } from "./${P}a";\nexport const b = () => a;`,
    },
    from: `packages/core/src/${P}a.ts`,
  },
  {
    rule: "core-puro",
    files: { [`packages/core/src/${P}banco.ts`]: `import { getPet } from "../../data/src/pets";\nexport const x = getPet;` },
    from: `packages/core/src/${P}banco.ts`,
  },
  {
    rule: "core-sem-node",
    files: { [`packages/core/src/${P}fs.ts`]: `import { readFileSync } from "node:fs";\nexport const x = readFileSync;` },
    from: `packages/core/src/${P}fs.ts`,
  },
  {
    rule: "ui-tokens-isolado",
    files: { [`packages/ui-tokens/${P}x.ts`]: `import { isMelId } from "../core/src/pet/pet";\nexport const x = isMelId;` },
    from: `packages/ui-tokens/${P}x.ts`,
  },
  {
    rule: "data-nao-depende-do-app",
    files: { [`packages/data/src/${P}x.ts`]: `import { siteOrigin } from "../../../apps/web/lib/site";\nexport const x = siteOrigin;` },
    from: `packages/data/src/${P}x.ts`,
  },
  {
    rule: "testes-do-data-so-com-a-cripto-do-app",
    files: { [`packages/data/tests/${P}x.test.ts`]: `import { siteOrigin } from "../../../apps/web/lib/site";\nexport const x = siteOrigin;` },
    from: `packages/data/tests/${P}x.test.ts`,
  },
  {
    rule: "lib-nao-depende-de-telas",
    files: { [`apps/web/lib/${P}x.ts`]: `import { Button } from "@/components/ui/Button";\nexport const x = Button;` },
    from: `apps/web/lib/${P}x.ts`,
  },
  {
    rule: "telas-nao-dependem-de-rotas",
    files: { [`apps/web/components/lost/${P}x.tsx`]: `import Page from "@/app/(app)/mural/page";\nexport const x = Page;` },
    from: `apps/web/components/lost/${P}x.tsx`,
  },
  {
    rule: "ui-base-sem-telas",
    files: { [`apps/web/components/ui/${P}x.tsx`]: `import { LostWizard } from "@/components/lost/LostWizard";\nexport const x = LostWizard;` },
    from: `apps/web/components/ui/${P}x.tsx`,
  },
  {
    rule: "producao-sem-prototipos",
    files: { [`apps/web/components/lost/${P}dev.tsx`]: `import * as Dev from "@/components/dev/microinteracoes/LostDemo";\nexport const x = Dev;` },
    from: `apps/web/components/lost/${P}dev.tsx`,
  },
];

/** Exceções que NÃO podem ser acusadas (o que a regra libera de propósito). */
const ALLOWED = {
  [`packages/data/tests/${P}ok.test.ts`]: `import * as pii from "../../../apps/web/lib/pii/crypto";\nexport const x = pii;`,
  [`apps/web/components/map/${P}ok.tsx`]: `import "@/app/map.css";\nexport const x = 1;`,
  [`apps/web/components/ui/${P}ok.tsx`]: `import * as Brand from "@/components/brand/MelLogo";\nexport const x = Brand;`,
  [`packages/core/src/${P}ok.test.ts`]: `import { readFileSync } from "node:fs";\nexport const x = readFileSync;`,
};

function cruise(paths) {
  let out;
  try {
    out = execFileSync(process.execPath, [resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs"), ...paths, "--config", ".dependency-cruiser.cjs", "--output-type", "json"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    out = err.stdout; // sai com código ≠ 0 quando há violação
  }
  return JSON.parse(out).summary.violations.map((v) => ({ rule: v.rule.name, from: v.from }));
}

function plant(files) {
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true });
    writeFileSync(resolve(root, file), body);
  }
}
const remove = (files) => Object.keys(files).forEach((f) => rmSync(resolve(root, f), { force: true }));

test("cada regra acusa a violação plantada, e as exceções documentadas passam", () => {
  const all = Object.assign({}, ...CASES.map((c) => c.files), ALLOWED);
  try {
    plant(all);
    const found = cruise(Object.keys(all));
    for (const c of CASES) {
      assert.ok(found.some((v) => v.rule === c.rule && v.from === c.from), `a regra "${c.rule}" devia acusar ${c.from}; acusou: ${JSON.stringify(found)}`);
    }
    for (const file of Object.keys(ALLOWED)) {
      assert.deepEqual(found.filter((v) => v.from === file), [], `exceção documentada acusada por engano: ${file}`);
    }
  } finally {
    remove(all);
  }
});
