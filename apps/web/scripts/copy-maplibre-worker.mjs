// O MapLibre 6 roda o processamento do mapa num web worker separado
// (maplibre-gl-worker.mjs). Depois do bundle do Next, o caminho que ele calcula
// sozinho não existe, então servimos o worker como arquivo estático e
// informamos o endereço com setWorkerUrl (ver lib/map/maplibre.ts).
// Roda automaticamente antes de `dev` e `build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
const target = join(import.meta.dirname, "..", "public", "vendor");

mkdirSync(target, { recursive: true });
copyFileSync(join(pkgDir, "dist", "maplibre-gl-worker.mjs"), join(target, "maplibre-gl-worker.mjs"));
console.log("maplibre-gl-worker.mjs copiado para public/vendor/");
