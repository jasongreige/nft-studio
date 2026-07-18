import { planWeighted } from "./generation";
import { metadataFor } from "./metadata";
import { seededRandom } from "./random";
import type { GenerationConfig, TokenMetadata } from "./types";

const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const image = new Image();
  image.src = url;
  await image.decode();
  imageCache.set(url, image);
  return image;
}

export type PreviewResult = { url: string; metadata: TokenMetadata };

export async function createPreviews(config: GenerationConfig, count: number): Promise<PreviewResult[]> {
  const previewConfig = { ...config, mode: "weighted" as const, count };
  const { combinations } = planWeighted(previewConfig, seededRandom(config.seed || "preview"));
  const canvas = document.createElement("canvas");
  canvas.width = config.width;
  canvas.height = config.height;
  const drawing = canvas.getContext("2d");
  if (!drawing) throw new Error("This browser cannot create previews.");
  drawing.imageSmoothingEnabled = true;
  drawing.imageSmoothingQuality = "high";
  const results: PreviewResult[] = [];
  for (let index = 0; index < combinations.length; index += 1) {
    drawing.clearRect(0, 0, canvas.width, canvas.height);
    for (const layer of config.layers) {
      const trait = layer.traits.find((item) => item.id === combinations[index][layer.id]);
      if (!trait || trait.isNone) continue;
      drawing.drawImage(await loadImage(trait.url), 0, 0, config.width, config.height);
    }
    results.push({
      url: canvas.toDataURL("image/png"),
      metadata: metadataFor(config, combinations[index], config.startingToken + index),
    });
  }
  return results;
}
