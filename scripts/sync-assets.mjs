import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = process.cwd();
const sourceRoot = path.resolve(process.env.NFT_STUDIO_ASSETS_DIR ?? path.join(projectRoot, "assets"));
const publicRoot = path.resolve(process.env.NFT_STUDIO_PUBLIC_DIR ?? path.join(projectRoot, "public"));
const generatedRoot = path.resolve(publicRoot, "generated-assets");
const supported = new Set([".png", ".webp"]);

function titleCase(value) {
  return value.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stableId(...parts) {
  return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 16);
}

function publicUrl(layer, filename) {
  return `/generated-assets/${encodeURIComponent(layer)}/${encodeURIComponent(filename)}`;
}

async function main() {
  const sourceStat = await readdir(sourceRoot, { withFileTypes: true }).catch(() => null);
  if (!sourceStat) throw new Error(`Protected asset directory is missing: ${sourceRoot}`);

  const layerDirs = sourceStat
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  const manifest = { version: 1, generatedAt: new Date().toISOString(), commonDimensions: null, layers: [] };
  const dimensions = new Set();

  // This is the only directory this script is allowed to replace.
  if (!generatedRoot.startsWith(publicRoot + path.sep)) throw new Error("Unsafe generated asset path.");
  await rm(generatedRoot, { recursive: true, force: true });
  await mkdir(generatedRoot, { recursive: true });

  for (const layerEntry of layerDirs) {
    const layerPath = path.join(sourceRoot, layerEntry.name);
    const targetLayer = path.join(generatedRoot, layerEntry.name);
    const entries = (await readdir(layerPath, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && supported.has(path.extname(entry.name).toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    if (!entries.length) throw new Error(`Layer '${layerEntry.name}' has no PNG or WEBP traits.`);
    await mkdir(targetLayer, { recursive: true });
    const traits = [];
    for (const entry of entries) {
      const source = path.join(layerPath, entry.name);
      const before = await readFile(source);
      const metadata = await sharp(before).metadata();
      if (!metadata.width || !metadata.height || !["png", "webp"].includes(metadata.format ?? "")) {
        throw new Error(`Invalid image: ${layerEntry.name}/${entry.name}`);
      }
      dimensions.add(`${metadata.width}x${metadata.height}`);
      await cp(source, path.join(targetLayer, entry.name), { force: true });
      const after = await readFile(source);
      if (!before.equals(after)) throw new Error(`Protected source asset changed during sync: ${source}`);
      const stem = path.parse(entry.name).name.toLowerCase();
      traits.push({
        id: stableId(layerEntry.name, entry.name),
        filename: entry.name,
        displayName: stem === "none" || stem === "nothing" ? "None" : titleCase(entry.name),
        url: publicUrl(layerEntry.name, entry.name),
        width: metadata.width,
        height: metadata.height,
        isNone: stem === "none" || stem === "nothing",
      });
    }
    manifest.layers.push({
      id: stableId(layerEntry.name),
      folderName: layerEntry.name,
      displayName: titleCase(layerEntry.name),
      traits,
    });
  }

  if (dimensions.size === 1) {
    const [width, height] = [...dimensions][0].split("x").map(Number);
    manifest.commonDimensions = { width, height };
  }
  await writeFile(path.join(generatedRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Synced ${manifest.layers.length} layers and ${manifest.layers.reduce((sum, layer) => sum + layer.traits.length, 0)} traits from protected assets/.`);
  if (!manifest.layers.length) console.warn("No layers found. Add direct layer folders under assets/, then run npm run sync-assets.");
  if (dimensions.size > 1) console.warn(`Found mixed dimensions: ${[...dimensions].join(", ")}. The app will resize with high-quality smoothing.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
