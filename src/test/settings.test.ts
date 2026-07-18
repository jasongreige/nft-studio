import { describe, expect, it } from "vitest";
import { defaultSettings, enabledRaritiesValid, mergeSettings, toGenerationConfig } from "@/lib/settings";
import type { AssetManifest } from "@/lib/types";

const manifest: AssetManifest = {
  version: 1, generatedAt: "now", commonDimensions: { width: 640, height: 640 },
  layers: [{ id: "hats", folderName: "hats", displayName: "Hats", traits: [{ id: "crown", filename: "crown.png", displayName: "Crown", url: "/crown.png", width: 640, height: 640, isNone: false }] }],
};

describe("settings", () => {
  it("starts with valid saved rarities and detected dimensions", () => {
    const settings = defaultSettings(manifest);
    expect(enabledRaritiesValid(manifest, settings)).toBe(true);
    expect(settings.width).toBe(640);
  });

  it("reconciles stale settings against the asset manifest", () => {
    const settings = mergeSettings(manifest, { ...defaultSettings(manifest), layerOrder: ["missing"], imageName: "Babies" });
    expect(settings.layerOrder).toEqual(["hats"]);
    expect(toGenerationConfig(manifest, settings).filenameBase).toBe("babies");
  });
});
