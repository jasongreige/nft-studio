import Decimal from "decimal.js";
import type { AssetLayer, LayerRarity, SavedRarity } from "./types";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function rarityTotal(rarity: LayerRarity): Decimal {
  return Object.values(rarity).reduce(
    (sum, trait) => (trait.enabled ? sum.plus(new Decimal(trait.percentage || 0)) : sum),
    new Decimal(0),
  );
}

export function rarityIsValid(rarity: LayerRarity): boolean {
  const enabled = Object.values(rarity).filter((trait) => trait.enabled);
  return enabled.length > 0 && enabled.some((trait) => new Decimal(trait.percentage || 0).greaterThan(0)) && rarityTotal(rarity).equals(100);
}

export function equalRarity(layer: AssetLayer): LayerRarity {
  const count = layer.traits.length;
  const base = new Decimal(100).div(count).toDecimalPlaces(6, Decimal.ROUND_DOWN);
  let allocated = new Decimal(0);
  return Object.fromEntries(
    layer.traits.map((trait, index) => {
      const percentage = index === count - 1 ? new Decimal(100).minus(allocated) : base;
      allocated = allocated.plus(percentage);
      return [trait.id, { enabled: true, percentage: percentage.toFixed(6).replace(/\.?0+$/, "") }];
    }),
  );
}

export function equalEnabledRarity(rarity: LayerRarity): LayerRarity {
  const copy = structuredClone(rarity);
  const enabled = Object.entries(copy).filter(([, trait]) => trait.enabled);
  if (!enabled.length) return copy;
  const base = new Decimal(100).div(enabled.length).toDecimalPlaces(6, Decimal.ROUND_DOWN);
  let allocated = new Decimal(0);
  enabled.forEach(([id], index) => {
    const value = index === enabled.length - 1 ? new Decimal(100).minus(allocated) : base;
    allocated = allocated.plus(value);
    copy[id].percentage = value.toFixed(6).replace(/\.?0+$/, "");
  });
  Object.values(copy).filter((trait) => !trait.enabled).forEach((trait) => { trait.percentage = "0"; });
  return copy;
}

export function normalizeRarity(rarity: LayerRarity): LayerRarity {
  const copy = structuredClone(rarity);
  const enabled = Object.entries(copy).filter(([, trait]) => trait.enabled);
  const total = rarityTotal(copy);
  if (!enabled.length) return copy;
  if (total.equals(0)) {
    const base = new Decimal(100).div(enabled.length).toDecimalPlaces(6, Decimal.ROUND_DOWN);
    let allocated = new Decimal(0);
    enabled.forEach(([id], index) => {
      const value = index === enabled.length - 1 ? new Decimal(100).minus(allocated) : base;
      allocated = allocated.plus(value);
      copy[id].percentage = value.toFixed(6).replace(/\.?0+$/, "");
    });
    return copy;
  }
  let allocated = new Decimal(0);
  enabled.forEach(([id, trait], index) => {
    const value = index === enabled.length - 1
      ? new Decimal(100).minus(allocated)
      : new Decimal(trait.percentage || 0).mul(100).div(total).toDecimalPlaces(6, Decimal.ROUND_DOWN);
    allocated = allocated.plus(value);
    copy[id].percentage = value.toFixed(6).replace(/\.?0+$/, "");
  });
  return copy;
}

export function initialRarities(layers: AssetLayer[]): SavedRarity {
  return Object.fromEntries(layers.map((layer) => [layer.id, equalRarity(layer)]));
}

export function maximumCombinations(layers: AssetLayer[], enabledLayers: Record<string, boolean>, rarities: SavedRarity): number {
  let total = 1;
  let found = false;
  for (const layer of layers) {
    if (!enabledLayers[layer.id]) continue;
    found = true;
    const available = layer.traits.filter((trait) => {
      const setting = rarities[layer.id]?.[trait.id];
      return setting?.enabled && new Decimal(setting.percentage || 0).greaterThan(0);
    }).length;
    total *= available;
    if (!Number.isSafeInteger(total)) return Number.MAX_SAFE_INTEGER;
  }
  return found ? total : 0;
}

export function combinedProbability(percentages: string[]): string {
  const probability = percentages.reduce(
    (value, percentage) => value.mul(new Decimal(percentage || 0).div(100)),
    new Decimal(1),
  ).mul(100);
  return probability.toSignificantDigits(16).toFixed();
}

export function largestRemainder(percentages: Array<{ id: string; percentage: string }>, count: number): Record<string, number> {
  const raw = percentages.map((item, index) => {
    const value = new Decimal(item.percentage).mul(count).div(100);
    const floor = value.floor();
    return { ...item, index, floor: floor.toNumber(), remainder: value.minus(floor) };
  });
  const result = Object.fromEntries(raw.map((item) => [item.id, item.floor]));
  let remaining = count - Object.values(result).reduce((sum, value) => sum + value, 0);
  raw.sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);
  for (const item of raw) {
    if (remaining-- <= 0) break;
    result[item.id] += 1;
  }
  return result;
}
