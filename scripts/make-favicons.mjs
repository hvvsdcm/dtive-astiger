// Crops the large "8" from brand/logo-source.png into favicon assets.
// Usage: npm run favicons  (re-run after replacing the source logo; adjust CROP if the artwork changes)
// Only source pixels are used: the crop keeps the largest connected glyph and blanks fragments of
// neighbouring letters to the sampled background colour.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = `${root}brand/logo-source.png`;
const out = (name) => `${root}public/${name}`;

// Region of the large "8" in the 1704x923 source (left, top, width, height).
const CROP = { left: 1134, top: 52, width: 350, height: 456 };
// Square padding around the crop, as a fraction of the crop height.
const PAD = 0.1;
// Channel value above which a pixel counts as the solid body of a glyph.
const INK_THRESHOLD = 96;
// Pixels within this distance of the kept glyph survive (preserves anti-aliased edges).
const EDGE_RADIUS = 3;

const { data } = await sharp(source)
  .extract({ left: 2, top: 2, width: 1, height: 1 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const background = { r: data[0], g: data[1], b: data[2], alpha: 1 };

async function isolateLargestGlyph() {
  const { data: px, info } = await sharp(source)
    .extract(CROP)
    .flatten({ background })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const label = new Int32Array(width * height);
  const sizes = [0];
  const ink = (i) => {
    const o = i * channels;
    return Math.max(px[o], px[o + 1], px[o + 2]) > INK_THRESHOLD;
  };
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let start = 0; start < width * height; start++) {
    if (label[start] || !ink(start)) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const i = stack.pop();
      count++;
      const x = i % width;
      const y = (i - x) / width;
      for (const [dx, dy] of steps) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (!label[n] && ink(n)) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    sizes.push(count);
  }
  const keep = sizes.indexOf(Math.max(...sizes.slice(1)));
  const near = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (label[i] !== keep) continue;
    const x = i % width;
    const y = (i - x) / width;
    for (let dy = -EDGE_RADIUS; dy <= EDGE_RADIUS; dy++) {
      for (let dx = -EDGE_RADIUS; dx <= EDGE_RADIUS; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) near[ny * width + nx] = 1;
      }
    }
  }
  for (let i = 0; i < width * height; i++) {
    if (near[i]) continue;
    const o = i * channels;
    px[o] = background.r;
    px[o + 1] = background.g;
    px[o + 2] = background.b;
  }
  return sharp(px, { raw: { width, height, channels } });
}

const side = Math.round(CROP.height * (1 + PAD * 2));
const padX = side - CROP.width;
const padY = side - CROP.height;

const square = await (
  await isolateLargestGlyph()
)
  .extend({
    left: Math.floor(padX / 2),
    right: Math.ceil(padX / 2),
    top: Math.floor(padY / 2),
    bottom: Math.ceil(padY / 2),
    background,
  })
  .png()
  .toBuffer();

const sizes = [
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];
for (const [name, size] of sizes) {
  await sharp(square)
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(out(name));
}

// favicon.ico: ICO container wrapping 16/32/48 PNG frames.
const icoSizes = [16, 32, 48];
const frames = await Promise.all(
  icoSizes.map((s) => sharp(square).resize(s, s, { kernel: 'lanczos3' }).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const entry = 6 + i * 16;
  const s = icoSizes[i];
  header.writeUInt8(s, entry);
  header.writeUInt8(s, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(out('favicon.ico'), Buffer.concat([header, ...frames]));

console.log(
  `favicons written from ${CROP.width}x${CROP.height} crop, background rgb(${background.r} ${background.g} ${background.b})`,
);
