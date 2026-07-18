import { describe, expect, it } from "vitest";
import { planCombinations } from "@/lib/generation";
import { metadataFor } from "@/lib/metadata";
import type { GenerationConfig, GenerationLayer } from "@/lib/types";

function generationLayer(id: string): GenerationLayer {
  return {
    id, folderName: id, displayName: id.toUpperCase(),
    traits: ["one", "two"].map((name) => ({ id: `${id}-${name}`, filename: `${name}.png`, displayName: name, url: `/${name}.png`, width: 8, height: 8, isNone: false, enabled: true, percentage: "50" })),
  };
}

function config(mode: "weighted" | "exact" = "weighted"): GenerationConfig {
  return { layers: [generationLayer("background"), generationLayer("eyes")], count: 4, mode, seed: "fixed", imageName: "My Babies", filenameBase: "my_babies", startingToken: 1, width: 8, height: 8, description: "Test", baseImageUri: "ipfs://CID/" };
}

describe("combination planning", () => {
  it("is reproducible and unique in weighted mode", () => {
    const first = planCombinations(config());
    const second = planCombinations(config());
    expect(first.combinations).toEqual(second.combinations);
    expect(new Set(first.combinations.map((item) => JSON.stringify(item))).size).toBe(4);
  });

  it("preserves exact counts", () => {
    const result = planCombinations(config("exact"));
    for (const layer of config().layers) {
      const counts = result.combinations.reduce<Record<string, number>>((all, item) => ({ ...all, [item[layer.id]]: (all[item[layer.id]] ?? 0) + 1 }), {});
      expect(Object.values(counts).sort()).toEqual([2, 2]);
    }
  });

  it("creates standard and detailed metadata", () => {
    const current = config();
    const combo = { background: "background-one", eyes: "eyes-two" };
    const metadata = metadataFor(current, combo, 7);
    expect(metadata.name).toBe("My Babies #7");
    expect(metadata.image).toBe("ipfs://CID/my_babies_7.png");
    expect(metadata.properties.traits[0]).toMatchObject({ layer: "background", filename: "one.png", configured_rarity_percentage: 50 });
    expect(metadata.properties.combination_probability_percentage).toBe("25");
  });
});
