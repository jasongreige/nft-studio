import { describe, expect, it } from "vitest";
import { filenameDisplayName, joinUri, sanitizeFilenameBase } from "@/lib/format";

describe("format helpers", () => {
  it("creates readable trait names", () => {
    expect(filenameDisplayName("gold_crown-file.png")).toBe("Gold Crown File");
  });

  it("creates safe output filename bases", () => {
    expect(sanitizeFilenameBase("My Babies")).toBe("my_babies");
    expect(sanitizeFilenameBase(" ../../ ")).toBe("nft");
    expect(sanitizeFilenameBase("Crème Club!")).toBe("creme_club");
  });

  it("joins optional metadata URIs", () => {
    expect(joinUri("ipfs://CID/", "baby_1.png")).toBe("ipfs://CID/baby_1.png");
    expect(joinUri("", "baby_1.png")).toBe("baby_1.png");
  });
});
