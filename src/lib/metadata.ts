import { combinedProbability } from "./rarity";
import { joinUri } from "./format";
import type { GenerationConfig, SelectedCombination, TokenMetadata } from "./types";

export function metadataFor(config: GenerationConfig, combination: SelectedCombination, token: number): TokenMetadata {
  const filename = `${config.filenameBase}_${token}.png`;
  const selected = config.layers.map((layer) => {
    const trait = layer.traits.find((item) => item.id === combination[layer.id]);
    if (!trait) throw new Error(`Missing selected trait in ${layer.displayName}.`);
    return { layer, trait };
  });
  return {
    name: `${config.imageName.trim()} #${token}`,
    description: config.description,
    image: joinUri(config.baseImageUri, filename),
    edition: token,
    attributes: selected
      .filter(({ trait }) => !trait.isNone)
      .map(({ layer, trait }) => ({ trait_type: layer.displayName, value: trait.displayName })),
    properties: {
      traits: selected.map(({ layer, trait }) => ({
        layer: layer.folderName,
        filename: trait.filename,
        display_name: trait.displayName,
        configured_rarity_percentage: Number(trait.percentage),
      })),
      combination_probability_percentage: combinedProbability(selected.map(({ trait }) => trait.percentage)),
    },
  };
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")).join("\n")}\n`;
}

export function generationReportRow(config: GenerationConfig, combination: SelectedCombination, token: number, metadata: TokenMetadata) {
  const row: Record<string, unknown> = {
    token_id: token,
    filename: `${config.filenameBase}_${token}.png`,
    combination_probability_percentage: metadata.properties.combination_probability_percentage,
  };
  for (const layer of config.layers) {
    const trait = layer.traits.find((item) => item.id === combination[layer.id])!;
    row[layer.folderName] = trait.filename;
    row[`${layer.folderName}_rarity_percentage`] = trait.percentage;
  }
  return row;
}
