/**
 * Builds the Alphadron brand assets from the supplied logo set (alphadronlogoset.png).
 *
 *   node scripts/make-brand.js "C:/path/to/alphadronlogoset.png"
 *
 * The mascot is lifted off the dark app-icon tile: navy pixels connected to the edge become
 * transparent (with a soft edge); the enclosed dark visor stays opaque.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || 'C:/Users/ronde/Downloads/alphadronlogoset.png';
const OUT = path.join(__dirname, '..', 'assets');
const BRAND = path.join(OUT, 'brand');
fs.mkdirSync(BRAND, { recursive: true });

const NAVY = { r: 14, g: 14, b: 38 };
// Region of the dark icon tile that is free of the tile's rounded corners.
const CROP = { left: 478, top: 556, width: 240, height: 228 };
const SCALE = 3;

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

async function liftMascot() {
  const { data, info } = await sharp(SRC)
    .extract(CROP)
    .resize(CROP.width * SCALE, CROP.height * SCALE, { kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    L[i] = lum(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  const LO = 34;
  const HI = 120;
  const flooded = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (!flooded[i] && L[i] < HI) {
      flooded[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 3] = flooded[i] ? Math.round(255 * smooth(LO, HI, L[i])) : 255;
  }
  const png = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  // Trim the transparent margin so the mark can be placed precisely.
  return sharp(png).trim({ threshold: 1 }).png().toBuffer();
}

async function place(mark, size, markFraction, background) {
  const m = await sharp(mark)
    .resize({ width: Math.round(size * markFraction), height: Math.round(size * markFraction), fit: 'inside' })
    .toBuffer();
  const meta = await sharp(m).metadata();
  const base = sharp({
    create: { width: size, height: size, channels: 4, background: background || { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  return base
    .composite([{ input: m, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png();
}

/** White silhouette: bright parts of the mascot (head, eyes, ears) on transparent. For themed/notification icons. */
async function silhouette(mark, size, fraction) {
  const placed = await (await place(mark, size, fraction)).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = placed;
  for (let i = 0; i < info.width * info.height; i++) {
    const a = data[i * 4 + 3] / 255;
    const l = lum(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    const keep = a * smooth(70, 130, l);
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = Math.round(255 * keep);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

(async () => {
  const mark = await liftMascot();
  const meta = await sharp(mark).metadata();
  console.log('mascot', meta.width + 'x' + meta.height);

  await sharp(mark).resize({ width: 640 }).png().toFile(path.join(BRAND, 'logo-mark.png'));
  const bg = { r: NAVY.r, g: NAVY.g, b: NAVY.b, alpha: 1 };
  (await place(mark, 1024, 0.7, bg)).toFile(path.join(OUT, 'icon.png'));
  (await place(mark, 1024, 0.56)).toFile(path.join(OUT, 'android-icon-foreground.png'));
  (await sharp({ create: { width: 1024, height: 1024, channels: 4, background: bg } }).png()).toFile(path.join(OUT, 'android-icon-background.png'));
  (await silhouette(mark, 1024, 0.56)).toFile(path.join(OUT, 'android-icon-monochrome.png'));
  (await place(mark, 1024, 0.42)).toFile(path.join(OUT, 'splash-icon.png'));
  (await silhouette(mark, 192, 0.86)).toFile(path.join(BRAND, 'notification-icon.png'));
  (await place(mark, 256, 0.8, bg)).toFile(path.join(OUT, 'favicon.png'));
  console.log('brand assets written to', OUT);
})();
