/// <reference lib="webworker" />

import { planCombinations } from "@/lib/generation";
import { generationReportRow, metadataFor, toCsv } from "@/lib/metadata";
import type {
  GenerationConfig,
  GenerationResult,
  SelectedCombination,
  WorkerInputMessage,
  WorkerOutputMessage,
} from "@/lib/types";

const context: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let cancelled = false;
let acknowledge: (() => void) | null = null;

function send(message: WorkerOutputMessage) {
  context.postMessage(message);
}

function waitForAck(): Promise<void> {
  return new Promise((resolve) => { acknowledge = resolve; });
}

async function sendFile(path: string, content: Blob | string) {
  send({ type: "file", path, content });
  await waitForAck();
  if (cancelled) throw new Error("Generation cancelled.");
}

async function loadBitmaps(config: GenerationConfig): Promise<Map<string, ImageBitmap>> {
  const bitmaps = new Map<string, ImageBitmap>();
  const traits = config.layers.flatMap((layer) => layer.traits).filter((trait) => !trait.isNone);
  for (const trait of traits) {
    if (cancelled) throw new Error("Generation cancelled.");
    if (bitmaps.has(trait.id)) continue;
    const response = await fetch(trait.url);
    if (!response.ok) throw new Error(`Could not load ${trait.filename}.`);
    bitmaps.set(trait.id, await createImageBitmap(await response.blob()));
  }
  return bitmaps;
}

function rarityReport(config: GenerationConfig, combinations: SelectedCombination[]) {
  return config.layers.flatMap((layer) => layer.traits.filter((trait) => trait.enabled).map((trait) => {
    const generatedCount = combinations.filter((combo) => combo[layer.id] === trait.id).length;
    const generatedPercentage = combinations.length ? generatedCount * 100 / combinations.length : 0;
    return {
      layer: layer.folderName,
      trait: trait.filename,
      configured_percentage: trait.percentage,
      generated_count: generatedCount,
      generated_percentage: generatedPercentage.toFixed(6),
      difference: (generatedPercentage - Number(trait.percentage)).toFixed(6),
    };
  }));
}

async function run(config: GenerationConfig) {
  cancelled = false;
  const started = performance.now();
  const { combinations, duplicates } = planCombinations(config);
  const bitmaps = await loadBitmaps(config);
  const canvas = new OffscreenCanvas(config.width, config.height);
  const drawing = canvas.getContext("2d", { alpha: true });
  if (!drawing) throw new Error("This browser cannot create a 2D image canvas.");
  drawing.imageSmoothingEnabled = true;
  drawing.imageSmoothingQuality = "high";
  const reportRows: Array<Record<string, unknown>> = [];

  for (let index = 0; index < combinations.length; index += 1) {
    if (cancelled) throw new Error("Generation cancelled.");
    const combination = combinations[index];
    const token = config.startingToken + index;
    const filename = `${config.filenameBase}_${token}.png`;
    drawing.clearRect(0, 0, config.width, config.height);
    for (const layer of config.layers) {
      const trait = layer.traits.find((item) => item.id === combination[layer.id]);
      if (!trait || trait.isNone) continue;
      const bitmap = bitmaps.get(trait.id);
      if (!bitmap) throw new Error(`Image data is missing for ${trait.filename}.`);
      drawing.drawImage(bitmap, 0, 0, config.width, config.height);
    }
    const image = await canvas.convertToBlob({ type: "image/png" });
    const metadata = metadataFor(config, combination, token);
    reportRows.push(generationReportRow(config, combination, token, metadata));
    await sendFile(`images/${filename}`, image);
    await sendFile(`metadata/${config.filenameBase}_${token}.json`, `${JSON.stringify(metadata, null, 2)}\n`);
    const elapsedMs = performance.now() - started;
    const completed = index + 1;
    send({
      type: "progress",
      progress: {
        completed,
        total: combinations.length,
        duplicates,
        elapsedMs,
        remainingMs: completed ? elapsedMs / completed * (combinations.length - completed) : null,
      },
    });
  }

  await sendFile("generation_report.csv", toCsv(reportRows));
  await sendFile("rarity_report.csv", toCsv(rarityReport(config, combinations)));
  await sendFile("generation_config.json", `${JSON.stringify(config, null, 2)}\n`);
  await sendFile("collection_metadata.json", `${JSON.stringify({
    name: config.imageName.trim(),
    description: config.description,
    total_supply: config.count,
    image_filename_pattern: `${config.filenameBase}_{token}.png`,
  }, null, 2)}\n`);
  bitmaps.forEach((bitmap) => bitmap.close());
  const result: GenerationResult = { generated: combinations.length, duplicates, elapsedMs: performance.now() - started };
  send({ type: "complete", result });
}

context.onmessage = (event: MessageEvent<WorkerInputMessage>) => {
  if (event.data.type === "cancel") {
    cancelled = true;
    acknowledge?.();
    acknowledge = null;
    return;
  }
  if (event.data.type === "ack") {
    acknowledge?.();
    acknowledge = null;
    return;
  }
  if (event.data.type === "start") {
    void run(event.data.config).catch((error) => {
      send({ type: "error", message: error instanceof Error ? error.message : "Generation failed." });
    });
  }
};

export {};
