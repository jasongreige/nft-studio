export type Dimensions = { width: number; height: number };

export type AssetTrait = {
  id: string;
  filename: string;
  displayName: string;
  url: string;
  width: number;
  height: number;
  isNone: boolean;
};

export type AssetLayer = {
  id: string;
  folderName: string;
  displayName: string;
  traits: AssetTrait[];
};

export type AssetManifest = {
  version: 1;
  generatedAt: string;
  commonDimensions: Dimensions | null;
  layers: AssetLayer[];
};

export type TraitRarity = { enabled: boolean; percentage: string };
export type LayerRarity = Record<string, TraitRarity>;
export type SavedRarity = Record<string, LayerRarity>;

export type DistributionMode = "weighted" | "exact";

export type AppSettings = {
  version: 1;
  layerOrder: string[];
  enabledLayers: Record<string, boolean>;
  savedRarities: SavedRarity;
  imageName: string;
  count: number;
  mode: DistributionMode;
  seed: string;
  startingToken: number;
  width: number;
  height: number;
  description: string;
  baseImageUri: string;
};

export type GenerationTrait = AssetTrait & { percentage: string; enabled: boolean };
export type GenerationLayer = Omit<AssetLayer, "traits"> & { traits: GenerationTrait[] };

export type GenerationConfig = {
  layers: GenerationLayer[];
  count: number;
  mode: DistributionMode;
  seed: string;
  imageName: string;
  filenameBase: string;
  startingToken: number;
  width: number;
  height: number;
  description: string;
  baseImageUri: string;
};

export type SelectedCombination = Record<string, string>;

export type TokenTraitProperty = {
  layer: string;
  filename: string;
  display_name: string;
  configured_rarity_percentage: number;
};

export type TokenMetadata = {
  name: string;
  description: string;
  image: string;
  edition: number;
  attributes: Array<{ trait_type: string; value: string }>;
  properties: {
    traits: TokenTraitProperty[];
    combination_probability_percentage: string;
  };
};

export type ProgressEvent = {
  completed: number;
  total: number;
  duplicates: number;
  elapsedMs: number;
  remainingMs: number | null;
};

export type GenerationResult = {
  generated: number;
  duplicates: number;
  elapsedMs: number;
};

export type WorkerStartMessage = { type: "start"; config: GenerationConfig };
export type WorkerCancelMessage = { type: "cancel" };
export type WorkerAckMessage = { type: "ack" };
export type WorkerInputMessage = WorkerStartMessage | WorkerCancelMessage | WorkerAckMessage;

export type WorkerProgressMessage = { type: "progress"; progress: ProgressEvent };
export type WorkerFileMessage = { type: "file"; path: string; content: Blob | string };
export type WorkerCompleteMessage = { type: "complete"; result: GenerationResult };
export type WorkerErrorMessage = { type: "error"; message: string };
export type WorkerOutputMessage = WorkerProgressMessage | WorkerFileMessage | WorkerCompleteMessage | WorkerErrorMessage;
