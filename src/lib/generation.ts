import Decimal from "decimal.js";
import { largestRemainder } from "./rarity";
import { seededRandom, shuffle, weightedChoice, type RandomSource } from "./random";
import type { GenerationConfig, GenerationLayer, SelectedCombination } from "./types";

function activeTraits(layer: GenerationLayer) {
  return layer.traits.filter((trait) => trait.enabled && new Decimal(trait.percentage || 0).greaterThan(0));
}

function keyFor(combo: SelectedCombination, layers: GenerationLayer[]): string {
  return layers.map((layer) => combo[layer.id]).join("\u0000");
}

export function planWeighted(config: GenerationConfig, random: RandomSource): { combinations: SelectedCombination[]; duplicates: number } {
  const seen = new Set<string>();
  const combinations: SelectedCombination[] = [];
  let duplicates = 0;
  const maximumAttempts = Math.max(10_000, config.count * 250);
  for (let attempt = 0; attempt < maximumAttempts && combinations.length < config.count; attempt += 1) {
    const combo: SelectedCombination = {};
    for (const layer of config.layers) {
      const traits = activeTraits(layer);
      const trait = weightedChoice(traits, traits.map((item) => Number(item.percentage)), random);
      combo[layer.id] = trait.id;
    }
    const key = keyFor(combo, config.layers);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    combinations.push(combo);
  }
  if (combinations.length !== config.count) {
    throw new Error(`Only ${combinations.length.toLocaleString()} unique combinations could be created. Reduce the amount or enable more traits.`);
  }
  return { combinations, duplicates };
}

export function planExact(config: GenerationConfig, random: RandomSource): { combinations: SelectedCombination[]; duplicates: number } {
  for (let restart = 0; restart < 100; restart += 1) {
    const columns = config.layers.map((layer) => {
      const traits = activeTraits(layer);
      const counts = largestRemainder(traits.map((trait) => ({ id: trait.id, percentage: trait.percentage })), config.count);
      return shuffle(traits.flatMap((trait) => Array.from({ length: counts[trait.id] }, () => trait.id)), random);
    });
    const combinations = Array.from({ length: config.count }, (_, row) =>
      Object.fromEntries(config.layers.map((layer, column) => [layer.id, columns[column][row]])),
    );
    const keys = combinations.map((combo) => keyFor(combo, config.layers));
    if (new Set(keys).size === config.count) return { combinations, duplicates: 0 };
  }
  throw new Error("Exact target counts could not be arranged into unique images. Try Natural randomness, reduce the amount, or change rarity values.");
}

export function planCombinations(config: GenerationConfig): { combinations: SelectedCombination[]; duplicates: number } {
  if (!config.layers.length) throw new Error("Enable at least one layer.");
  const random = seededRandom(config.seed);
  return config.mode === "exact" ? planExact(config, random) : planWeighted(config, random);
}
