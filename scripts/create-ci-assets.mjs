import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

if (process.env.CI !== "true") {
  throw new Error("This script creates disposable artwork and may only run in CI.");
}

const root = path.resolve(process.env.NFT_STUDIO_ASSETS_DIR ?? path.join(process.cwd(), "assets"));
const existingImages = [];

async function findImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await findImages(target);
    else if ([".png", ".webp"].includes(path.extname(entry.name).toLowerCase())) existingImages.push(target);
  }
}

await findImages(root);
if (existingImages.length) throw new Error("Refusing to create CI fixtures because assets/ already contains artwork.");

const layers = {
  "back accessories": 3,
  backgrounds: 9,
  bodies: 3,
  clothes: 9,
  ears: 2,
  eyes: 10,
  "hand accessories": 7,
  hats: 13,
  mouth: 12,
};

let colorIndex = 1;
for (const [layer, count] of Object.entries(layers)) {
  const directory = path.join(root, layer);
  await mkdir(directory, { recursive: true });
  for (let index = 1; index <= count; index += 1) {
    const filename = index === count && ["back accessories", "ears", "hand accessories", "hats"].includes(layer)
      ? "nothing.png"
      : `trait_${index}.png`;
    const color = { r: colorIndex * 47 % 255, g: colorIndex * 83 % 255, b: colorIndex * 131 % 255, alpha: 0.85 };
    await sharp({ create: { width: 32, height: 32, channels: 4, background: color } }).png().toFile(path.join(directory, filename));
    colorIndex += 1;
  }
}

console.log("Created 9 disposable CI layers with 68 traits.");
