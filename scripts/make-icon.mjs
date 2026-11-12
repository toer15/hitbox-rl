import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 1024;
const SS = 2;
const W = SIZE * SS;
const pixels = new Uint8ClampedArray(W * W * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const index = (y * W + x) * 4;
  const sourceAlpha = a / 255;
  const targetAlpha = pixels[index + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outAlpha === 0) return;
  pixels[index] = (r * sourceAlpha + pixels[index] * targetAlpha * (1 - sourceAlpha)) / outAlpha;
  pixels[index + 1] = (g * sourceAlpha + pixels[index + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha;
  pixels[index + 2] = (b * sourceAlpha + pixels[index + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha;
  pixels[index + 3] = outAlpha * 255;
}

function inRoundedRect(px, py, x, y, w, h, radius) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + radius), x + w - radius);
  const cy = Math.min(Math.max(py, y + radius), y + h - radius);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function fillRounded(x, y, w, h, radius, color) {
  const [r, g, b, a = 255] = color;
  const left = Math.floor(x * SS);
  const top = Math.floor(y * SS);
  const right = Math.ceil((x + w) * SS);
  const bottom = Math.ceil((y + h) * SS);
  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      if (inRoundedRect(px, py, x * SS, y * SS, w * SS, h * SS, radius * SS)) {
        setPixel(px, py, r, g, b, a);
      }
    }
  }
}

function fillRect(x, y, w, h, color) {
  fillRounded(x, y, w, h, 0, color);
}

const BG = [10, 15, 20];
const EDGE = [34, 48, 62];
const BLUE = [63, 155, 255];
const ORANGE = [255, 122, 47];
const WHITE = [237, 244, 251];

// Outer plate and inset face.
fillRounded(28, 28, 968, 968, 218, EDGE);
fillRounded(36, 36, 952, 952, 210, BG);

// Faint inner plate.
fillRounded(228, 228, 568, 568, 94, [15, 25, 36]);

// Hitbox corner brackets.
const inset = 178;
const length = 178;
const thickness = 27;
fillRect(inset, inset, length, thickness, BLUE);
fillRect(inset, inset, thickness, length, BLUE);
fillRect(SIZE - inset - length, inset, length, thickness, BLUE);
fillRect(SIZE - inset - thickness, inset, thickness, length, BLUE);
fillRect(inset, SIZE - inset - thickness, length, thickness, BLUE);
fillRect(inset, SIZE - inset - length, thickness, length, BLUE);
fillRect(SIZE - inset - length, SIZE - inset - thickness, length, thickness, BLUE);
fillRect(SIZE - inset - thickness, SIZE - inset - length, thickness, length, BLUE);

// H mark.
fillRect(394, 330, 70, 364, WHITE);
fillRect(560, 330, 70, 364, WHITE);
fillRect(464, 477, 96, 70, WHITE);

// Orange registration mark.
fillRect(394, 746, 236, 24, ORANGE);

// Downsample with a 2x box filter.
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const index = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        r += pixels[index];
        g += pixels[index + 1];
        b += pixels[index + 2];
        a += pixels[index + 3];
      }
    }
    const count = SS * SS;
    const index = (y * SIZE + x) * 4;
    out[index] = Math.round(r / count);
    out[index + 1] = Math.round(g / count);
    out[index + 2] = Math.round(b / count);
    out[index + 3] = Math.round(a / count);
  }
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

const rows = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y += 1) {
  rows[y * (SIZE * 4 + 1)] = 0;
  out.copy(rows, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(rows, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(path.join(root, 'build'), { recursive: true });
writeFileSync(path.join(root, 'build', 'icon.png'), png);
console.log(`Wrote build/icon.png (${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} KB)`);
