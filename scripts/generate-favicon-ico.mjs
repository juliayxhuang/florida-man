import { writeFileSync } from "node:fs";

// Minimal ICO generator (single 32x32 32-bit BMP) with a simple right-arrow glyph.
// No external deps; intended for reliable favicon support across browsers.

const size = 32;
const bytesPerPixel = 4;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

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

function makeArrowRGBA() {
  const rgba = [0x00, 0x00, 0x00, 0xff];
  const pixels = Buffer.alloc(size * size * 4, 0x00);

  // A stylized right arrow, similar weight to the SVG.
  // Shaft
  drawLine(pixels, 6, 16, 22, 16, 1, rgba);
  // Head
  drawLine(pixels, 16, 10, 22, 16, 1, rgba);
  drawLine(pixels, 16, 22, 22, 16, 1, rgba);
  // Small dot (like your SVG's circle accent)
  drawCircle(pixels, 22, 8, 2, rgba);

  return pixels;
}

function rgbaToBmpBGRA(rgba) {
  // BMP stores pixels bottom-up; each pixel is BGRA.
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcY = y;
      const dstY = size - 1 - y;
      const si = (srcY * size + x) * 4;
      const di = (dstY * size + x) * 4;
      const r = rgba[si + 0];
      const g = rgba[si + 1];
      const b = rgba[si + 2];
      const a = rgba[si + 3];
      out[di + 0] = b;
      out[di + 1] = g;
      out[di + 2] = r;
      out[di + 3] = a;
    }
  }
  return out;
}

function buildIcoSingle32() {
  const rgba = makeArrowRGBA();
  const bmpPixels = rgbaToBmpBGRA(rgba);

  // AND mask: 1 bit per pixel, padded to 32-bit per row.
  const andStrideBytes = Math.ceil(size / 32) * 4; // for 32px => 4 bytes
  const andMask = Buffer.alloc(andStrideBytes * size, 0x00); // 0 = opaque

  // BITMAPINFOHEADER
  const biSize = 40;
  const biWidth = size;
  const biHeight = size * 2; // color + mask
  const biPlanes = 1;
  const biBitCount = 32;
  const biCompression = 0; // BI_RGB
  const biSizeImage = bmpPixels.length + andMask.length;
  const biXPelsPerMeter = 0;
  const biYPelsPerMeter = 0;
  const biClrUsed = 0;
  const biClrImportant = 0;

  const dib = Buffer.alloc(biSize);
  dib.writeUInt32LE(biSize, 0);
  dib.writeInt32LE(biWidth, 4);
  dib.writeInt32LE(biHeight, 8);
  dib.writeUInt16LE(biPlanes, 12);
  dib.writeUInt16LE(biBitCount, 14);
  dib.writeUInt32LE(biCompression, 16);
  dib.writeUInt32LE(biSizeImage, 20);
  dib.writeInt32LE(biXPelsPerMeter, 24);
  dib.writeInt32LE(biYPelsPerMeter, 28);
  dib.writeUInt32LE(biClrUsed, 32);
  dib.writeUInt32LE(biClrImportant, 36);

  const imageData = Buffer.concat([dib, bmpPixels, andMask]);

  // ICO header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // count

  // Directory entry
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width
  entry.writeUInt8(size, 1); // height
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(imageData.length, 8); // size
  entry.writeUInt32LE(header.length + entry.length, 12); // offset

  return Buffer.concat([header, entry, imageData]);
}

const ico = buildIcoSingle32();
writeFileSync(new URL("../favicon.ico", import.meta.url), ico);
console.log("Wrote favicon.ico (32x32).");

