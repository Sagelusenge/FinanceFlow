import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function chunk(name, data) {
  const label = Buffer.from(name);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([label, data]))
    crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, label, data, checksum]);
}

function rounded(x, y, left, top, right, bottom, radius) {
  const nearX = Math.max(left + radius, Math.min(x, right - radius));
  const nearY = Math.max(top + radius, Math.min(y, bottom - radius));
  return Math.hypot(x - nearX, y - nearY) <= radius;
}

function sample(x, y) {
  if (!rounded(x, y, 0, 0, 1, 1, 0.22)) return [0, 0, 0, 0];
  const blend = (x + y) / 2;
  let color = [0, 78 + 90 * blend, 58 + 62 * blend, 255];
  if (rounded(x, y, 0.22, 0.29, 0.77, 0.71, 0.075))
    color = [255, 255, 255, 255];
  if (rounded(x, y, 0.22, 0.27, 0.73, 0.39, 0.052))
    color = [201, 247, 229, 255];
  if (rounded(x, y, 0.58, 0.44, 0.82, 0.61, 0.05))
    color = [188, 241, 220, 255];
  if (Math.hypot(x - 0.68, y - 0.525) < 0.032)
    color = [0, 108, 73, 255];
  return color;
}

function icon(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < 2; sy++)
        for (let sx = 0; sx < 2; sx++) {
          const color = sample((x + (sx + 0.5) / 2) / size, (y + (sy + 0.5) / 2) / size);
          for (let c = 0; c < 4; c++) totals[c] += color[c];
        }
      for (let c = 0; c < 4; c++)
        pixels[row + 1 + x * 4 + c] = Math.round(totals[c] / 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public", { recursive: true });
for (const size of [192, 512])
  writeFileSync(`public/icon-${size}.png`, icon(size));
