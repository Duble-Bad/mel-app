// Gera todos os ícones da MEL a partir do vetor do Mel Beacon
// (apps/web/components/brand/beacon.json). Rode após alterar o símbolo:
//   npm run brand:icons
// Saídas: favicon (.ico + .svg), ícone Apple, ícones PWA (normal e maskable),
// ícone de notificação (monocromático) e SVGs da marca em public/brand/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps/web");
const sharp = createRequire(resolve(web, "package.json"))("sharp");
const beacon = JSON.parse(readFileSync(resolve(web, "components/brand/beacon.json"), "utf8"));

// Cores da marca (espelho de packages/ui-tokens: honey-500, honey-400, ink-900).
const HONEY = "#c88924";
const HONEY_LIGHT = "#dfa33b";
const INK = "#111923";
const IVORY = "#f7f4ee";

/** Símbolo dentro de um quadrado 512, ocupando `scale` dele, centralizado. */
const glyph = (d, fill, scale) => {
  const offset = (512 * (1 - scale)) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})"><path d="${d}" fill="${fill}" fill-rule="evenodd"/></g>`;
};
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>\n`;
/** Ladrilho (app icon): fundo Honey + símbolo Ink. `rx` 0 = sangrado (o sistema arredonda). */
const tile = ({ d, bg = HONEY, fg = INK, rx = 112, scale = 0.78 }) =>
  svg(`<rect width="512" height="512" rx="${rx}" fill="${bg}"/>${glyph(d, fg, scale)}`);

const png = (source, size) => sharp(Buffer.from(source), { density: 300 }).resize(size, size).png().toBuffer();

/** .ico com PNGs embutidos (formato aceito por todos os navegadores atuais). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

const out = (rel, data) => {
  const file = resolve(web, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log("✓", rel);
};

// Até 32 px: versão simplificada (silhueta + focinho), legível em aba de navegador.
const smallTile = tile({ d: beacon.simple, rx: 120, scale: 0.84 });
out("app/icon.svg", smallTile);
out("app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(smallTile, size) })))));
// iOS aplica o próprio arredondamento: fundo sangrado.
out("app/apple-icon.png", await png(tile({ d: beacon.detailed, rx: 0 }), 180));

// PWA / app (M16 usa no manifest). Maskable: símbolo na zona segura (80%).
out("public/brand/app-icon-192.png", await png(tile({ d: beacon.detailed }), 192));
out("public/brand/app-icon-512.png", await png(tile({ d: beacon.detailed }), 512));
out("public/brand/app-icon-maskable-512.png", await png(tile({ d: beacon.detailed, rx: 0, scale: 0.62 }), 512));
// Notificação (Android): branco sobre transparente; o sistema pinta.
out("public/brand/notification-96.png", await png(svg(glyph(beacon.simple, "#ffffff", 0.9)), 96));

// SVGs da marca: símbolo solto (monocromáticos) e ladrilhos claro/escuro.
out("public/brand/mel-beacon-honey.svg", svg(glyph(beacon.detailed, HONEY, 1)));
out("public/brand/mel-beacon-ink.svg", svg(glyph(beacon.detailed, INK, 1)));
out("public/brand/mel-beacon-white.svg", svg(glyph(beacon.detailed, "#ffffff", 1)));
out("public/brand/mel-beacon-tile-light.svg", tile({ d: beacon.detailed }));
out("public/brand/mel-beacon-tile-dark.svg", tile({ d: beacon.detailed, bg: INK, fg: HONEY_LIGHT }));
out("public/brand/mel-beacon-ivory.svg", svg(glyph(beacon.detailed, IVORY, 1)));
