import { deflateSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * PNG RGB com um "rosto" (círculo escuro com dois olhos claros) no terço de cima e uma
 * faixa em cada borda: nas capturas dá para ver se o recorte preservou o centro de interesse
 * e quanto das bordas sobrou. Foto sintética; nenhuma foto real.
 */
export function patternPng(width: number, height: number, rgb: [number, number, number] = [180, 120, 60]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const cx = width / 2;
  const cy = height * 0.4;
  const r = Math.min(width, height) * 0.22;
  const border = Math.max(4, Math.round(Math.min(width, height) * 0.04));
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const eye = Math.hypot(x - (cx - r * 0.4), y - (cy - r * 0.2)) < r * 0.14 || Math.hypot(x - (cx + r * 0.4), y - (cy - r * 0.2)) < r * 0.14;
      const edge = x < border || y < border || x >= width - border || y >= height - border;
      const shade = 0.75 + 0.25 * (y / height);
      const px: [number, number, number] = edge ? [230, 230, 230] : eye ? [250, 250, 250] : d < r ? [40, 30, 25] : [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade];
      row.writeUInt8(Math.round(px[0]), 1 + x * 3);
      row.writeUInt8(Math.round(px[1]), 2 + x * 3);
      row.writeUInt8(Math.round(px[2]), 3 + x * 3);
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** PNG RGB sólido e válido, para simular a foto de um pet nos testes. */
export function solidPng(width = 64, height = 64, rgb: [number, number, number] = [180, 120, 60]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // profundidade
  ihdr.writeUInt8(2, 9); // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
