import type { AppSettings, AssetManifest, GenerationConfig, SavedRarity } from "./types";
import { initialRarities, rarityIsValid } from "./rarity";
import { sanitizeFilenameBase } from "./format";

export const STORAGE_KEY = "nft-studio-settings-v1";

function finiteInteger(value: unknown, fallback: number, minimum: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.floor(number)) : fallback;
}

export function defaultSettings(manifest: AssetManifest): AppSettings {
  const dimensions = manifest.commonDimensions ?? manifest.layers[0]?.traits[0] ?? { width: 640, height: 640 };
  return {
    version: 1,
    layerOrder: manifest.layers.map((layer) => layer.id),
    enabledLayers: Object.fromEntries(manifest.layers.map((layer) => [layer.id, true])),
    savedRarities: initialRarities(manifest.layers),
    imageName: "My Collection",
    count: 10,
    mode: "weighted",
    seed: "",
    startingToken: 1,
    width: dimensions.width,
    height: dimensions.height,
    description: "",
    baseImageUri: "",
  };
}

export function mergeSettings(manifest: AssetManifest, input: unknown): AppSettings {
  const defaults = defaultSettings(manifest);
  if (!input || typeof input !== "object") return defaults;
  const saved = input as Partial<AppSettings>;
  const layerIds = new Set(manifest.layers.map((layer) => layer.id));
  const order = [...(saved.layerOrder ?? []).filter((id) => layerIds.has(id)), ...defaults.layerOrder.filter((id) => !(saved.layerOrder ?? []).includes(id))];
  const rarities: SavedRarity = structuredClone(defaults.savedRarities);
  for (const layer of manifest.layers) {
    const savedLayer = saved.savedRarities?.[layer.id];
    if (!savedLayer) continue;
    for (const trait of layer.traits) {
      const value = savedLayer[trait.id];
      if (value && typeof value.percentage === "string") rarities[layer.id][trait.id] = { enabled: Boolean(value.enabled), percentage: value.percentage };
    }
  }
  return {
    ...defaults,
    ...saved,
    version: 1,
    layerOrder: order,
    enabledLayers: Object.fromEntries(manifest.layers.map((layer) => [layer.id, saved.enabledLayers?.[layer.id] ?? true])),
    savedRarities: rarities,
    count: finiteInteger(saved.count, defaults.count, 1),
    startingToken: finiteInteger(saved.startingToken, defaults.startingToken, 0),
    width: finiteInteger(saved.width, defaults.width, 1),
    height: finiteInteger(saved.height, defaults.height, 1),
  };
}

export function enabledRaritiesValid(manifest: AssetManifest, settings: AppSettings): boolean {
  const enabled = manifest.layers.filter((layer) => settings.enabledLayers[layer.id]);
  return enabled.length > 0 && enabled.every((layer) => rarityIsValid(settings.savedRarities[layer.id]));
}

export function toGenerationConfig(manifest: AssetManifest, settings: AppSettings): GenerationConfig {
  const byId = new Map(manifest.layers.map((layer) => [layer.id, layer]));
  const layers = settings.layerOrder
    .map((id) => byId.get(id))
    .filter((layer): layer is NonNullable<typeof layer> => Boolean(layer) && Boolean(settings.enabledLayers[layer!.id]))
    .map((layer) => ({
      ...layer,
      traits: layer.traits.map((trait) => ({ ...trait, ...settings.savedRarities[layer.id][trait.id] })),
    }));
  return {
    layers,
    count: settings.count,
    mode: settings.mode,
    seed: settings.seed,
    imageName: settings.imageName,
    filenameBase: sanitizeFilenameBase(settings.imageName),
    startingToken: settings.startingToken,
    width: settings.width,
    height: settings.height,
    description: settings.description,
    baseImageUri: settings.baseImageUri,
  };
}
