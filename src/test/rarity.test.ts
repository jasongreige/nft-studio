import { describe, expect, it } from "vitest";
import { combinedProbability, equalEnabledRarity, equalRarity, largestRemainder, maximumCombinations, normalizeRarity, rarityIsValid, rarityTotal } from "@/lib/rarity";
import type { AssetLayer } from "@/lib/types";

const layer: AssetLayer = {
  id: "layer", folderName: "hats", displayName: "Hats",
  traits: ["red", "blue", "gold"].map((id) => ({ id, filename: `${id}.png`, displayName: id, url: `/${id}.png`, width: 10, height: 10, isNone: false })),
};

describe("rarity math", () => {
  it("distributes exactly 100 percent", () => {
    const rarity = equalRarity(layer);
    expect(rarityTotal(rarity).toString()).toBe("100");
    expect(rarityIsValid(rarity)).toBe(true);
  });

  it("distributes only among enabled traits", () => {
    const rarity = equalEnabledRarity({ red: { enabled: true, percentage: "2" }, blue: { enabled: false, percentage: "90" }, gold: { enabled: true, percentage: "3" } });
    expect(rarity.red.percentage).toBe("50");
    expect(rarity.blue.percentage).toBe("0");
    expect(rarity.gold.percentage).toBe("50");
  });

  it("normalizes decimals without floating point drift", () => {
    const rarity = normalizeRarity({ red: { enabled: true, percentage: "12.5" }, blue: { enabled: true, percentage: "37.5" } });
    expect(rarityTotal(rarity).toString()).toBe("100");
    expect(rarity.red.percentage).toBe("25");
  });

  it("uses largest remainder for exact counts", () => {
    expect(largestRemainder([{ id: "a", percentage: "33.333333" }, { id: "b", percentage: "33.333333" }, { id: "c", percentage: "33.333334" }], 10)).toEqual({ a: 3, b: 3, c: 4 });
  });

  it("calculates combinations and combined probability", () => {
    const rarities = { layer: { red: { enabled: true, percentage: "50" }, blue: { enabled: true, percentage: "50" }, gold: { enabled: false, percentage: "0" } } };
    expect(maximumCombinations([layer], { layer: true }, rarities)).toBe(2);
    expect(combinedProbability(["50", "20", "12.5"])).toBe("1.25");
  });
});
