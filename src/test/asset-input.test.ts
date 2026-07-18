import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { manifestFromFiles, stableAssetId } from "@/lib/asset-input";

function folderFile(path: string, type = "image/png"): File {
  const name = path.split("/").at(-1)!;
  const file = new File([new Uint8Array([1, 2, 3])], name, { type });
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

describe("browser asset folders", () => {
  beforeEach(() => {
    let objectUrl = 0;
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 640, height: 640, close: vi.fn() })));
    const NativeUrl = URL;
    vi.stubGlobal("URL", class extends NativeUrl {
      static createObjectURL = vi.fn(() => `blob:test-${objectUrl += 1}`);
      static revokeObjectURL = vi.fn();
    });
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("creates stable IDs from folder and filename inputs", async () => {
    expect(await stableAssetId("hats", "crown.png")).toBe(await stableAssetId("hats", "crown.png"));
    expect(await stableAssetId("hats", "crown.png")).not.toBe(await stableAssetId("eyes", "crown.png"));
  });

  it("turns direct layer folders into a manifest and recognizes None", async () => {
    const result = await manifestFromFiles([
      folderFile("my-art/backgrounds/blue.png"),
      folderFile("my-art/hats/crown.png"),
      folderFile("my-art/hats/nothing.png"),
      folderFile("my-art/hats/nested/ignored.png"),
      folderFile("my-art/notes.txt", "text/plain"),
      folderFile("__MACOSX/my-art/._blue.png"),
    ]);
    expect(result.collectionName).toBe("my-art");
    expect(result.ignoredFiles).toBe(3);
    expect(result.manifest.layers.map((layer) => layer.folderName)).toEqual(["backgrounds", "hats"]);
    expect(result.manifest.layers[1].traits.find((trait) => trait.filename === "nothing.png")?.isNone).toBe(true);
    expect(result.manifest.commonDimensions).toEqual({ width: 640, height: 640 });
  });

  it("rejects selecting files without a collection and layer hierarchy", async () => {
    await expect(manifestFromFiles([folderFile("hats/crown.png")])).rejects.toThrow(/collection folder/i);
  });
});
