import { filenameDisplayName } from "./format";
import type { AssetLayer, AssetManifest, AssetTrait, Dimensions } from "./types";

const SUPPORTED_EXTENSIONS = new Set(["png", "webp"]);

export type BrowserAssetResult = {
  manifest: AssetManifest;
  collectionName: string;
  ignoredFiles: number;
};

function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function extension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function isHidden(parts: string[]): boolean {
  return parts.some((part) => part.startsWith(".") || part === "__MACOSX");
}

export async function stableAssetId(...parts: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join("\0"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function dimensionsFor(file: Blob, filename: string): Promise<Dimensions> {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    if (!dimensions.width || !dimensions.height) throw new Error();
    return dimensions;
  } catch {
    throw new Error(`“${filename}” is not a valid PNG or WEBP image.`);
  }
}

function relativePath(file: File): string {
  return file.webkitRelativePath.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function commonDimensions(layers: AssetLayer[]): Dimensions | null {
  const dimensions = new Set(layers.flatMap((layer) => layer.traits.map((trait) => `${trait.width}x${trait.height}`)));
  if (dimensions.size !== 1) return null;
  const [width, height] = [...dimensions][0].split("x").map(Number);
  return { width, height };
}

export async function manifestFromFiles(files: Iterable<File>): Promise<BrowserAssetResult> {
  const candidates = [...files];
  if (!candidates.length) throw new Error("That folder is empty. Choose a collection folder containing layer folders.");

  const grouped = new Map<string, File[]>();
  const roots = new Set<string>();
  let ignoredFiles = 0;
  for (const file of candidates) {
    const parts = relativePath(file).split("/").filter(Boolean);
    if (parts.length && !isHidden(parts)) roots.add(parts[0]);
    if (parts.length !== 3 || isHidden(parts) || !SUPPORTED_EXTENSIONS.has(extension(parts.at(-1)!))) {
      ignoredFiles += 1;
      continue;
    }
    const [, layerName] = parts;
    grouped.set(layerName, [...(grouped.get(layerName) ?? []), file]);
  }

  if (roots.size !== 1 || !grouped.size) {
    throw new Error("Choose one collection folder whose direct subfolders are layers containing PNG or WEBP files.");
  }

  const layers: AssetLayer[] = [];
  const createdUrls: string[] = [];
  try {
    for (const [folderName, layerFiles] of [...grouped.entries()].sort(([left], [right]) => naturalCompare(left, right))) {
      const traits: AssetTrait[] = [];
      for (const file of layerFiles.sort((left, right) => naturalCompare(left.name, right.name))) {
        const dimensions = await dimensionsFor(file, `${folderName}/${file.name}`);
        const stem = file.name.replace(/\.[^.]+$/, "").toLowerCase();
        const url = URL.createObjectURL(file);
        createdUrls.push(url);
        traits.push({
          id: await stableAssetId(folderName, file.name),
          filename: file.name,
          displayName: stem === "none" || stem === "nothing" ? "None" : filenameDisplayName(file.name),
          url,
          ...dimensions,
          isNone: stem === "none" || stem === "nothing",
        });
      }
      layers.push({
        id: await stableAssetId(folderName),
        folderName,
        displayName: filenameDisplayName(folderName),
        traits,
      });
    }
  } catch (error) {
    createdUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }

  return {
    manifest: { version: 1, generatedAt: new Date().toISOString(), commonDimensions: commonDimensions(layers), layers },
    collectionName: [...roots][0],
    ignoredFiles,
  };
}

function canvasBlob(draw: (drawing: CanvasRenderingContext2D, size: number) => void): Promise<Blob> {
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const drawing = canvas.getContext("2d");
  if (!drawing) throw new Error("This browser cannot create demo artwork.");
  draw(drawing, size);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create demo artwork.")), "image/png"));
}

type DemoTrait = { filename: string; draw?: (drawing: CanvasRenderingContext2D, size: number) => void };

const DEMO_LAYERS: Array<{ folderName: string; traits: DemoTrait[] }> = [
  { folderName: "backgrounds", traits: [
    { filename: "violet_night.png", draw: (drawing, size) => { const gradient = drawing.createLinearGradient(0, 0, size, size); gradient.addColorStop(0, "#25164d"); gradient.addColorStop(1, "#090915"); drawing.fillStyle = gradient; drawing.fillRect(0, 0, size, size); } },
    { filename: "coral_sunset.png", draw: (drawing, size) => { const gradient = drawing.createLinearGradient(0, 0, 0, size); gradient.addColorStop(0, "#ff8c78"); gradient.addColorStop(1, "#53275f"); drawing.fillStyle = gradient; drawing.fillRect(0, 0, size, size); } },
    { filename: "mint_fog.png", draw: (drawing, size) => { drawing.fillStyle = "#b8ead8"; drawing.fillRect(0, 0, size, size); drawing.fillStyle = "rgba(255,255,255,.28)"; drawing.beginPath(); drawing.arc(50, 70, 110, 0, Math.PI * 2); drawing.fill(); } },
  ] },
  { folderName: "bodies", traits: [
    { filename: "lilac.png", draw: (drawing) => { drawing.fillStyle = "#a78bfa"; drawing.beginPath(); drawing.arc(160, 180, 108, 0, Math.PI * 2); drawing.fill(); } },
    { filename: "gold.png", draw: (drawing) => { drawing.fillStyle = "#fbbf24"; drawing.beginPath(); drawing.roundRect(56, 72, 208, 218, 70); drawing.fill(); } },
    { filename: "aqua.png", draw: (drawing) => { drawing.fillStyle = "#4dd8c0"; drawing.beginPath(); drawing.moveTo(160, 47); drawing.lineTo(274, 186); drawing.lineTo(160, 300); drawing.lineTo(46, 186); drawing.closePath(); drawing.fill(); } },
  ] },
  { folderName: "eyes", traits: [
    { filename: "happy.png", draw: (drawing) => { drawing.strokeStyle = "#17121f"; drawing.lineWidth = 13; drawing.lineCap = "round"; drawing.beginPath(); drawing.arc(118, 166, 22, Math.PI, 0); drawing.stroke(); drawing.beginPath(); drawing.arc(202, 166, 22, Math.PI, 0); drawing.stroke(); } },
    { filename: "curious.png", draw: (drawing) => { for (const x of [116, 204]) { drawing.fillStyle = "white"; drawing.beginPath(); drawing.arc(x, 164, 25, 0, Math.PI * 2); drawing.fill(); drawing.fillStyle = "#17121f"; drawing.beginPath(); drawing.arc(x + 3, 167, 10, 0, Math.PI * 2); drawing.fill(); } } },
    { filename: "sleepy.png", draw: (drawing) => { drawing.strokeStyle = "#17121f"; drawing.lineWidth = 12; drawing.lineCap = "round"; drawing.beginPath(); drawing.moveTo(91, 168); drawing.lineTo(137, 168); drawing.moveTo(183, 168); drawing.lineTo(229, 168); drawing.stroke(); } },
  ] },
  { folderName: "hats", traits: [
    { filename: "crown.png", draw: (drawing) => { drawing.fillStyle = "#ffe08a"; drawing.beginPath(); drawing.moveTo(82, 100); drawing.lineTo(105, 40); drawing.lineTo(160, 88); drawing.lineTo(215, 40); drawing.lineTo(238, 100); drawing.closePath(); drawing.fill(); drawing.fillRect(82, 94, 156, 24); } },
    { filename: "beanie.png", draw: (drawing) => { drawing.fillStyle = "#fb7185"; drawing.beginPath(); drawing.arc(160, 103, 78, Math.PI, 0); drawing.fill(); drawing.beginPath(); drawing.roundRect(72, 94, 176, 38, 14); drawing.fill(); } },
    { filename: "nothing.png" },
  ] },
];

export async function createDemoManifest(): Promise<AssetManifest> {
  const layers: AssetLayer[] = [];
  for (const layer of DEMO_LAYERS) {
    const traits: AssetTrait[] = [];
    for (const trait of layer.traits) {
      const blob = await canvasBlob(trait.draw ?? (() => undefined));
      traits.push({
        id: await stableAssetId(layer.folderName, trait.filename),
        filename: trait.filename,
        displayName: trait.filename === "nothing.png" ? "None" : filenameDisplayName(trait.filename),
        url: URL.createObjectURL(blob),
        width: 320,
        height: 320,
        isNone: trait.filename === "nothing.png",
      });
    }
    layers.push({ id: await stableAssetId(layer.folderName), folderName: layer.folderName, displayName: filenameDisplayName(layer.folderName), traits });
  }
  return { version: 1, generatedAt: new Date().toISOString(), commonDimensions: { width: 320, height: 320 }, layers };
}

export function releaseManifest(manifest: AssetManifest | null): void {
  manifest?.layers.flatMap((layer) => layer.traits).forEach((trait) => {
    if (trait.url.startsWith("blob:")) URL.revokeObjectURL(trait.url);
  });
}
