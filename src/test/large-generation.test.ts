import { describe, expect, it } from "vitest";
import { planCombinations } from "@/lib/generation";
import { defaultSettings, toGenerationConfig } from "@/lib/settings";
import type { AssetManifest } from "@/lib/types";

describe("large collection planning", () => {
  it("plans 10,000 unique exact-distribution combinations from a synthetic manifest", async () => {
    const counts = [3, 9, 3, 9, 2, 10, 7, 13, 11];
    const manifest: AssetManifest = {
      version: 1,
      generatedAt: "test",
      commonDimensions: { width: 32, height: 32 },
      layers: counts.map((count, layerIndex) => ({
        id: `layer-${layerIndex}`,
        folderName: `layer-${layerIndex}`,
        displayName: `Layer ${layerIndex}`,
        traits: Array.from({ length: count }, (_, traitIndex) => ({
          id: `layer-${layerIndex}-trait-${traitIndex}`,
          filename: `trait_${traitIndex}.png`,
          displayName: `Trait ${traitIndex}`,
          url: `/trait_${traitIndex}.png`,
          width: 32,
          height: 32,
          isNone: false,
        })),
      })),
    };
    const settings = defaultSettings(manifest);
    settings.count = 10_000;
    settings.mode = "exact";
    settings.seed = "ten-thousand-regression";
    const result = planCombinations(toGenerationConfig(manifest, settings));
    expect(result.combinations).toHaveLength(10_000);
    expect(new Set(result.combinations.map((combo) => JSON.stringify(combo))).size).toBe(10_000);
  }, 20_000);
});
