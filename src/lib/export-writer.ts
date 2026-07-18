import { BlobReader, BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { timestamp } from "./format";

export type OutputWriter = {
  label: string;
  write(path: string, content: Blob | string): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
};

type DirectoryHandle = {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
  }>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite"; id?: string }) => Promise<DirectoryHandle>;
  }
}

export function directoryExportSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

async function directoryForPath(root: DirectoryHandle, parts: string[]): Promise<DirectoryHandle> {
  let current = root;
  for (const part of parts) current = await current.getDirectoryHandle(part, { create: true });
  return current;
}

export async function createDirectoryWriter(filenameBase: string): Promise<OutputWriter> {
  if (!window.showDirectoryPicker) throw new Error("Folder export is not supported in this browser.");
  const parent = await window.showDirectoryPicker({ mode: "readwrite", id: "nft-studio-output" });
  const folderName = `${filenameBase}-collection-${timestamp()}`;
  const root = await parent.getDirectoryHandle(folderName, { create: true });
  return {
    label: folderName,
    async write(filePath, content) {
      const parts = filePath.split("/");
      const filename = parts.pop()!;
      const directory = await directoryForPath(root, parts);
      const handle = await directory.getFileHandle(filename, { create: true });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
    },
    async close() {},
    async abort() {
      await parent.removeEntry(folderName, { recursive: true }).catch(() => undefined);
    },
  };
}

export function createZipWriter(filenameBase: string): OutputWriter {
  const blobWriter = new BlobWriter("application/zip");
  const zip = new ZipWriter(blobWriter);
  const downloadName = `${filenameBase}-collection-${timestamp()}.zip`;
  return {
    label: downloadName,
    async write(filePath, content) {
      const reader = typeof content === "string" ? new TextReader(content) : new BlobReader(content);
      await zip.add(filePath, reader);
    },
    async close() {
      const blob = await zip.close();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
    async abort() {},
  };
}
