import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

async function assetDigest(root: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else { hash.update(path.relative(root, target)); hash.update(await readFile(target)); }
    }
  }
  await walk(root);
  return hash.digest("hex");
}

describe("asset synchronization", () => {
  it("creates a valid empty manifest for a fresh public clone", async () => {
    const root = process.cwd();
    const temporary = await mkdtemp(path.join(os.tmpdir(), "nft-studio-empty-"));
    const assets = path.join(temporary, "assets");
    const output = path.join(temporary, "public");
    try {
      await mkdir(assets, { recursive: true });
      const result = spawnSync(process.execPath, ["scripts/sync-assets.mjs"], { cwd: root, encoding: "utf8", env: { ...process.env, NFT_STUDIO_ASSETS_DIR: assets, NFT_STUDIO_PUBLIC_DIR: output } });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("Synced 0 layers and 0 traits");
      const manifest = JSON.parse(await readFile(path.join(output, "generated-assets/manifest.json"), "utf8"));
      expect(manifest.layers).toEqual([]);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("detects layers and never changes protected sources", async () => {
    const root = process.cwd();
    const temporary = await mkdtemp(path.join(os.tmpdir(), "nft-studio-sync-"));
    const assets = path.join(temporary, "assets");
    const output = path.join(temporary, "public");
    try {
      for (const [layer, names] of Object.entries({ backgrounds: ["blue.png", "red.png"], hats: ["crown.png", "nothing.png"] })) {
        await mkdir(path.join(assets, layer), { recursive: true });
        for (const [index, name] of names.entries()) await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: index * 100, g: 30, b: 180, alpha: 1 } } }).png().toFile(path.join(assets, layer, name));
      }
      const before = await assetDigest(assets);
      const result = spawnSync(process.execPath, ["scripts/sync-assets.mjs"], { cwd: root, encoding: "utf8", env: { ...process.env, NFT_STUDIO_ASSETS_DIR: assets, NFT_STUDIO_PUBLIC_DIR: output } });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("Synced 2 layers and 4 traits");
      expect(await assetDigest(assets)).toBe(before);
      const manifest = JSON.parse(await readFile(path.join(output, "generated-assets/manifest.json"), "utf8"));
      expect(manifest.layers).toHaveLength(2);
      expect(manifest.layers[1].traits.some((trait: { isNone: boolean }) => trait.isNone)).toBe(true);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
