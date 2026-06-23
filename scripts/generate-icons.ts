/**
 * Rasterize public/logo.svg into the favicon and PWA icon set.
 *
 * Run with: bun run icons
 *
 * Note: favicon.ico is written as 32x32 PNG data. The existing favicon.ico is
 * itself PNG data (not true ICO), which browsers accept, so this matches the
 * existing setup without pulling in an ICO encoder.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const source = join(publicDir, "logo.svg");

const targets: { file: string; size: number }[] = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "favicon-48x48.png", size: 48 },
  { file: "favicon.ico", size: 32 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "android-chrome-192x192.png", size: 192 },
  { file: "android-chrome-512x512.png", size: 512 },
];

const svg = await Bun.file(source).arrayBuffer();

for (const { file, size } of targets) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(publicDir, file));
  console.log(`✓ ${file} (${size}x${size})`);
}

console.log(`\nGenerated ${targets.length} icons from ${source}`);
