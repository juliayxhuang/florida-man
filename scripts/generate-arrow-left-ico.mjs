import { writeFileSync } from "node:fs";

// Minimal ICO generator (single 32x32 32-bit BMP) for a left arrow favicon.
// No external deps.

const size = 32;
const bytesPerPixel = 4;
const rgbaBlack = [0x00, 0x00, 0x00, 0xff];

function setPixel(buf, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * bytesPerPixel;
  buf[i + 0] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function drawCircle(buf, cx, cy, radius, rgba) {
  const [r, g, b, a] = rgba;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) setPixel(buf, x, y, r, g, b, a);
    }
  }
}

function drawLine(buf, x0, y0, x1, y1, thickness, rgba) {
  const [r, g, b, a] = rgba;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;

  while (true) {
    for (let oy = -thickness; oy <= thickness; oy++) {
      for (let ox = -thickness; ox <= thickness; ox++) {
        if (ox * ox + oy * oy <= thickness * thickness) {
          setPixel(buf, x + ox, y + oy, r, g, b, a);
        }
      }
    }

    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function makeArrowLeftRGBA() {
  const pixels = Buffer.alloc(size * size * 4, 0x00);

  // Shaft
  drawLine(pixels, 10, 16, 26, 16, 1, rgbaBlack);
  // Head
  drawLine(pixels, 10, 16, 16, 10, 1, rgbaBlack);
  drawLine(pixels, 10, 16, 16, 22, 1, rgbaBlack);
  // Dot accent (top-left-ish)
  drawCircle(pixels, 10, 8, 2, rgbaBlack);

  return pixels;
}

function rgbaToBmpBGRA(rgba) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dstY = size - 1 - y;
      const si = (y * size + x) * 4;
      const di = (dstY * size + x) * 4;
      out[di + 0] = rgba[si + 2]; // B
      out[di + 1] = rgba[si + 1]; // G
      out[di + 2] = rgba[si + 0]; // R
      out[di + 3] = rgba[si + 3]; // A
    }
  }
  return out;
}

function buildIcoSingle32(pixelsRGBA) {
  const bmpPixels = rgbaToBmpBGRA(pixelsRGBA);
  const andStrideBytes = Math.ceil(size / 32) * 4;
  const andMask = Buffer.alloc(andStrideBytes * size, 0x00);

  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(0, 16);
  dib.writeUInt32LE(bmpPixels.length + andMask.length, 20);
  dib.writeInt32LE(0, 24);
  dib.writeInt32LE(0, 28);
  dib.writeUInt32LE(0, 32);
  dib.writeUInt32LE(0, 36);

  const imageData = Buffer.concat([dib, bmpPixels, andMask]);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(imageData.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, imageData]);
}

const ico = buildIcoSingle32(makeArrowLeftRGBA());
writeFileSync(new URL("../arrow-left.ico", import.meta.url), ico);
console.log("Wrote arrow-left.ico (32x32).");

