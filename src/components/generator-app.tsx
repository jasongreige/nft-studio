"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, CircleGauge, Download,
  Eye, FileArchive, FolderDown, FolderOpen, ImageIcon, Info, Layers3, LoaderCircle, Play, RefreshCw,
  Save, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Square, Upload, WandSparkles,
} from "lucide-react";
import Decimal from "decimal.js";
import { HelpTip } from "./help-tip";
import { SortableLayer } from "./sortable-layer";
import { Stepper } from "./stepper";
import { createDirectoryWriter, createZipWriter, directoryExportSupported, type OutputWriter } from "@/lib/export-writer";
import { createDemoManifest, manifestFromFiles, releaseManifest } from "@/lib/asset-input";
import { formatDuration, sanitizeFilenameBase } from "@/lib/format";
import { createPreviews, type PreviewResult } from "@/lib/preview";
import { equalEnabledRarity, maximumCombinations, normalizeRarity, rarityIsValid, rarityTotal } from "@/lib/rarity";
import { defaultSettings, enabledRaritiesValid, mergeSettings, STORAGE_KEY, toGenerationConfig } from "@/lib/settings";
import type { AppSettings, AssetLayer, AssetManifest, LayerRarity, ProgressEvent, WorkerOutputMessage } from "@/lib/types";

const STEP_COPY = [
  ["Your artwork layers", "Every direct folder in your selected collection becomes one layer."],
  ["Choose the stack", "Arrange layers from the furthest behind to the furthest in front."],
  ["Set trait rarity", "Decide how often each image should be selected."],
  ["Preview your collection", "Create a few examples without saving any files."],
  ["Generate your collection", "Name, generate, and save the complete collection."],
] as const;

function dimensionSummary(layer: AssetLayer) {
  return [...new Set(layer.traits.map((trait) => `${trait.width}×${trait.height}`))].join(", ");
}

function LayerStep({ manifest, settings, setSettings }: { manifest: AssetManifest; settings: AppSettings; setSettings: React.Dispatch<React.SetStateAction<AppSettings | null>> }) {
  return (
    <div className="layer-grid">
      {manifest.layers.map((layer) => {
        const enabled = settings.enabledLayers[layer.id];
        const sizes = new Set(layer.traits.map((trait) => `${trait.width}×${trait.height}`));
        return (
          <article className={`layer-card ${enabled ? "enabled" : ""}`} key={layer.id}>
            <div className="layer-thumbnails">
              {layer.traits.slice(0, 4).map((trait) => trait.isNone
                ? <span className="none-thumb" key={trait.id}>None</span>
                : <img src={trait.url} alt="" key={trait.id} />)}
            </div>
            <div className="layer-card-title"><div><h3>{layer.displayName}</h3><p>{layer.folderName}</p></div>
              <label className="switch"><input type="checkbox" checked={enabled} onChange={(event) => setSettings((current) => current ? ({ ...current, enabledLayers: { ...current.enabledLayers, [layer.id]: event.target.checked } }) : current)} /><span /></label>
            </div>
            <div className="layer-facts"><span><ImageIcon size={15} /> {layer.traits.length} traits</span><span className={sizes.size > 1 ? "warning-text" : ""}><CircleGauge size={15} /> {dimensionSummary(layer)}</span></div>
            {sizes.size > 1 && <p className="inline-notice"><Info size={14} /> Mixed sizes will be aligned automatically.</p>}
          </article>
        );
      })}
    </div>
  );
}

function OrderStep({ manifest, settings, setSettings }: { manifest: AssetManifest; settings: AppSettings; setSettings: React.Dispatch<React.SetStateAction<AppSettings | null>> }) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const byId = new Map(manifest.layers.map((layer) => [layer.id, layer]));
  const ordered = settings.layerOrder.map((id) => byId.get(id)).filter((item): item is AssetLayer => Boolean(item));
  function onDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = settings.layerOrder.indexOf(String(event.active.id));
    const to = settings.layerOrder.indexOf(String(event.over.id));
    setSettings((current) => current ? ({ ...current, layerOrder: arrayMove(current.layerOrder, from, to) }) : current);
  }
  function move(index: number, direction: -1 | 1) {
    setSettings((current) => current ? ({ ...current, layerOrder: arrayMove(current.layerOrder, index, index + direction) }) : current);
  }
  return (
    <div className="order-layout">
      <div className="order-guide"><div className="stack-art"><Layers3 size={38} /><span>FRONT</span><i /><i /><i /><span>BACK</span></div><h3>How stacking works</h3><p>The top of this list is drawn first, behind everything below it. Drag rows or use the arrow buttons.</p></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={settings.layerOrder} strategy={verticalListSortingStrategy}>
          <div className="sortable-list">{ordered.map((layer, index) => <SortableLayer key={layer.id} layer={layer} index={index} total={ordered.length} onMove={(direction) => move(index, direction)} />)}</div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function RarityStep({ manifest, settings, drafts, setDrafts, setSettings }: {
  manifest: AssetManifest; settings: AppSettings; drafts: Record<string, LayerRarity>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, LayerRarity>>>;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>;
}) {
  const enabledLayers = manifest.layers.filter((layer) => settings.enabledLayers[layer.id]);
  const [selectedId, setSelectedId] = useState(enabledLayers[0]?.id ?? "");
  const layer = enabledLayers.find((item) => item.id === selectedId) ?? enabledLayers[0];
  if (!layer) return <div className="empty-state"><AlertCircle /><h3>No layers enabled</h3><p>Return to Layers and enable at least one.</p></div>;
  const draft = drafts[layer.id];
  const total = rarityTotal(draft);
  const valid = rarityIsValid(draft);
  const isSaved = JSON.stringify(draft) === JSON.stringify(settings.savedRarities[layer.id]);
  const setDraft = (next: LayerRarity) => setDrafts((current) => ({ ...current, [layer.id]: next }));
  return (
    <div className="rarity-layout">
      <aside className="rarity-layers">
        <p className="eyebrow">Layers</p>
        {enabledLayers.map((item) => {
          const saved = rarityIsValid(settings.savedRarities[item.id]);
          return <button key={item.id} className={item.id === layer.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><span>{item.displayName}<small>{item.traits.length} traits</small></span>{saved && <CheckCircle2 size={17} />}</button>;
        })}
      </aside>
      <section className="rarity-editor">
        <div className="rarity-header"><div><p className="eyebrow">Editing rarity</p><h3>{layer.displayName}</h3><p>Set how likely each trait is to appear. Enabled traits must add up to exactly 100%.</p></div>
          <div className={`total-orb ${valid ? "valid" : total.greaterThan(100) ? "over" : ""}`}><strong>{total.toFixed(2).replace(/\.00$/, "")}%</strong><span>of 100%</span></div>
        </div>
        <div className="total-track"><span style={{ width: `${Decimal.min(total, 100).toNumber()}%` }} /></div>
        <div className={`total-message ${valid ? "success" : "error"}`}>{valid ? <><Check size={16} /> Perfect — this layer is ready to save.</> : total.greaterThan(100) ? <><AlertCircle size={16} /> Reduce the total by {total.minus(100).toFixed(2)}%.</> : <><AlertCircle size={16} /> Add {new Decimal(100).minus(total).toFixed(2)}% to reach 100%.</>}</div>
        <div className="rarity-actions"><button onClick={() => setDraft(equalEnabledRarity(draft))}><Sparkles size={15} /> Distribute equally</button><button onClick={() => setDraft(normalizeRarity(draft))}><RefreshCw size={15} /> Normalize to 100%</button><button onClick={() => setDraft(Object.fromEntries(Object.entries(draft).map(([id, value]) => [id, { ...value, percentage: "0" }])))}><Square size={14} /> Set to zero</button></div>
        <div className="trait-list">
          {layer.traits.map((trait) => {
            const item = draft[trait.id];
            return <div className={`trait-row ${item.enabled ? "" : "disabled"}`} key={trait.id}>
              {trait.isNone ? <span className="trait-none">None</span> : <img src={trait.url} alt={`${trait.displayName} trait`} />}
              <div className="trait-copy"><strong>{trait.displayName}</strong><small>{trait.filename}</small></div>
              <label className="mini-switch"><input type="checkbox" checked={item.enabled} aria-label={`Enable ${trait.displayName}`} onChange={(event) => setDraft({ ...draft, [trait.id]: { ...item, enabled: event.target.checked } })} /><span /></label>
              <input className="rarity-range" type="range" min="0" max="100" step="0.1" value={Math.min(100, Number(item.percentage) || 0)} disabled={!item.enabled} aria-label={`${trait.displayName} rarity slider`} onChange={(event) => setDraft({ ...draft, [trait.id]: { ...item, percentage: event.target.value } })} />
              <label className="percentage-input"><input type="number" min="0" max="100" step="0.1" value={item.percentage} disabled={!item.enabled} aria-label={`${trait.displayName} rarity percentage`} onChange={(event) => setDraft({ ...draft, [trait.id]: { ...item, percentage: event.target.value } })} /><span>%</span></label>
            </div>;
          })}
        </div>
        <div className="save-rarity"><div>{isSaved ? <><CheckCircle2 size={18} /> All changes saved</> : <><Info size={18} /> You have unsaved changes</>}</div><button className="primary-button" disabled={!valid || isSaved} onClick={() => setSettings((current) => current ? ({ ...current, savedRarities: { ...current.savedRarities, [layer.id]: structuredClone(draft) } }) : current)}><Save size={17} /> Save this layer</button></div>
      </section>
    </div>
  );
}

function PreviewStep({ manifest, settings }: { manifest: AssetManifest; settings: AppSettings }) {
  const [previews, setPreviews] = useState<PreviewResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function generate(count: number) {
    setLoading(true); setError("");
    try { setPreviews(await createPreviews(toGenerationConfig(manifest, settings), count)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not generate previews."); }
    finally { setLoading(false); }
  }
  return <div>
    <div className="preview-actions"><button className="primary-button" onClick={() => generate(1)} disabled={loading}><Eye size={17} /> Generate one preview</button><button className="secondary-button" onClick={() => generate(5)} disabled={loading}><WandSparkles size={17} /> Generate five</button><span>Previews are temporary and do not affect your final collection.</span></div>
    {loading && <div className="loading-panel"><LoaderCircle className="spin" /><p>Compositing your preview…</p></div>}
    {error && <p className="error-banner"><AlertCircle size={17} /> {error}</p>}
    {!loading && !previews.length && <div className="preview-placeholder"><div><Sparkles size={38} /></div><h3>Your artwork will appear here</h3><p>Generate a preview to check layer order and rarity before exporting.</p></div>}
    <div className="preview-grid">{previews.map((preview, index) => <article className="preview-card" key={`${preview.metadata.edition}-${index}`}><img src={preview.url} alt={`Generated preview ${index + 1}`} /><div><h3>{preview.metadata.name}</h3><p>Combined probability <strong>{preview.metadata.properties.combination_probability_percentage}%</strong></p><ul>{preview.metadata.properties.traits.map((trait) => <li key={trait.layer}><span>{trait.layer}</span><strong>{trait.filename}</strong><small>{trait.configured_rarity_percentage}%</small></li>)}</ul></div></article>)}</div>
  </div>;
}

function AdvancedSettings({ settings, setSettings, onImport, onExport, dimensionsDiffer }: { settings: AppSettings; setSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>; onImport: (file: File) => void; onExport: () => void; dimensionsDiffer: boolean }) {
  return <details className="advanced"><summary><span><Settings2 size={18} /> Advanced settings</span><ChevronDown size={17} /></summary><div className="advanced-grid">
    <label><span>Random seed <HelpTip text="Use the same seed and settings to reproduce the same collection." /></span><input value={settings.seed} placeholder="Optional" onChange={(event) => setSettings((current) => current ? ({ ...current, seed: event.target.value }) : current)} /></label>
    <label><span>Starting token <HelpTip text="The number used for the first image and metadata file." /></span><input type="number" min="0" value={settings.startingToken} onChange={(event) => setSettings((current) => current ? ({ ...current, startingToken: Math.max(0, Number(event.target.value)) }) : current)} /></label>
    <label><span>Output width {dimensionsDiffer && <em>Mixed asset sizes</em>}</span><input type="number" min="1" value={settings.width} onChange={(event) => setSettings((current) => current ? ({ ...current, width: Math.max(1, Number(event.target.value)) }) : current)} /></label>
    <label><span>Output height</span><input type="number" min="1" value={settings.height} onChange={(event) => setSettings((current) => current ? ({ ...current, height: Math.max(1, Number(event.target.value)) }) : current)} /></label>
    <label className="wide"><span>Description <HelpTip text="Optional description included in every NFT metadata file." /></span><textarea rows={3} value={settings.description} placeholder="Tell collectors about this collection…" onChange={(event) => setSettings((current) => current ? ({ ...current, description: event.target.value }) : current)} /></label>
    <label className="wide"><span>Base image URI <HelpTip text="Leave blank for local filenames. After uploading images, enter an IPFS or HTTPS folder URI." /></span><input value={settings.baseImageUri} placeholder="ipfs://YOUR_CID/ (optional)" onChange={(event) => setSettings((current) => current ? ({ ...current, baseImageUri: event.target.value }) : current)} /></label>
    <div className="settings-files wide"><div><strong>Saved settings</strong><p>Settings files contain preferences and rarities—not your images.</p></div><button onClick={onExport}><Download size={16} /> Export settings</button><label className="button-label"><Upload size={16} /> Import settings<input type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])} /></label></div>
  </div></details>;
}

function GenerateStep({ manifest, settings, setSettings, setDrafts }: { manifest: AssetManifest; settings: AppSettings; setSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>; setDrafts: React.Dispatch<React.SetStateAction<Record<string, LayerRarity>>> }) {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error" | "cancelled">("idle");
  const [message, setMessage] = useState("");
  const [folderSupport, setFolderSupport] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const writerRef = useRef<OutputWriter | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setFolderSupport(directoryExportSupported()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => () => {
    workerRef.current?.postMessage({ type: "cancel" });
    workerRef.current?.terminate();
    void writerRef.current?.abort();
  }, []);
  const enabledLayers = manifest.layers.filter((layer) => settings.enabledLayers[layer.id]);
  const max = maximumCombinations(enabledLayers, settings.enabledLayers, settings.savedRarities);
  const valid = enabledRaritiesValid(manifest, settings) && settings.imageName.trim().length > 0 && settings.count <= max;
  const dimensionsDiffer = new Set(manifest.layers.flatMap((layer) => layer.traits.map((trait) => `${trait.width}x${trait.height}`))).size > 1;

  function exportSettings() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "nft-studio-settings.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  async function importSettings(file: File) {
    try {
      const imported = mergeSettings(manifest, JSON.parse(await file.text()));
      setSettings(imported); setDrafts(structuredClone(imported.savedRarities)); setMessage("Settings imported successfully.");
    } catch { setStatus("error"); setMessage("That settings file is invalid."); }
  }
  async function start(kind: "folder" | "zip") {
    if (!valid || status === "running") return;
    setStatus("idle"); setMessage(""); setProgress(null);
    try {
      const base = sanitizeFilenameBase(settings.imageName);
      const writer = kind === "folder" ? await createDirectoryWriter(base) : createZipWriter(base);
      writerRef.current = writer;
      const worker = new Worker(new URL("../workers/generator.worker.ts", import.meta.url));
      workerRef.current = worker;
      setStatus("running"); setMessage(`Writing to ${writer.label}`);
      worker.onmessage = async (event: MessageEvent<WorkerOutputMessage>) => {
        const data = event.data;
        if (data.type === "progress") { setProgress(data.progress); return; }
        if (data.type === "file") {
          try { await writer.write(data.path, data.content); worker.postMessage({ type: "ack" }); }
          catch (reason) { worker.postMessage({ type: "cancel" }); await writer.abort(); setStatus("error"); setMessage(reason instanceof Error ? reason.message : "Could not write output files."); worker.terminate(); }
          return;
        }
        if (data.type === "complete") {
          await writer.close(); setStatus("complete"); setMessage(`Generated ${data.result.generated.toLocaleString()} NFTs in ${formatDuration(data.result.elapsedMs)}.`); worker.terminate(); workerRef.current = null; writerRef.current = null; return;
        }
        if (data.type === "error") {
          await writer.abort(); setStatus(data.message.toLowerCase().includes("cancel") ? "cancelled" : "error"); setMessage(data.message); worker.terminate(); workerRef.current = null; writerRef.current = null;
        }
      };
      worker.postMessage({ type: "start", config: toGenerationConfig(manifest, settings) });
    } catch (reason) { setStatus("error"); setMessage(reason instanceof Error ? reason.message : "Could not start generation."); }
  }
  function cancel() { workerRef.current?.postMessage({ type: "cancel" }); setMessage("Stopping safely…"); }
  return <div className="generate-layout"><section className="generate-form">
    <label className="hero-field"><span>Image name <HelpTip text="Used for filenames and NFT titles. For example, My Babies creates my_babies_1.png." /></span><input value={settings.imageName} placeholder="My Collection" onChange={(event) => setSettings((current) => current ? ({ ...current, imageName: event.target.value }) : current)} /><small>Files will look like <strong>{sanitizeFilenameBase(settings.imageName)}_{settings.startingToken}.png</strong></small></label>
    <div className="generate-row"><label><span>How many NFTs?</span><input type="number" min="1" max={max} value={settings.count} onChange={(event) => setSettings((current) => current ? ({ ...current, count: Math.max(1, Math.floor(Number(event.target.value))) }) : current)} /><small>Up to {max.toLocaleString()} unique combinations</small></label></div>
    <fieldset className="mode-choice"><legend>How should rarity be applied?</legend><label className={settings.mode === "weighted" ? "selected" : ""}><input type="radio" name="mode" checked={settings.mode === "weighted"} onChange={() => setSettings((current) => current ? ({ ...current, mode: "weighted" }) : current)} /><WandSparkles /><span><strong>Natural randomness</strong><small>Each trait is drawn by chance. Final totals can vary.</small></span><i /></label><label className={settings.mode === "exact" ? "selected" : ""}><input type="radio" name="mode" checked={settings.mode === "exact"} onChange={() => setSettings((current) => current ? ({ ...current, mode: "exact" }) : current)} /><SlidersHorizontal /><span><strong>Match rarity targets</strong><small>Attempts to match your percentages as closely as possible.</small></span><i /></label></fieldset>
    <AdvancedSettings settings={settings} setSettings={setSettings} onImport={importSettings} onExport={exportSettings} dimensionsDiffer={dimensionsDiffer} />
  </section><aside className="export-card"><div className="export-icon"><FolderDown /></div><h3>Ready to create?</h3><p>Your artwork stays in this browser. Nothing is uploaded to a server.</p><dl><div><dt>Images</dt><dd>{settings.count.toLocaleString()} PNG</dd></div><div><dt>Canvas</dt><dd>{settings.width} × {settings.height}</dd></div><div><dt>Metadata</dt><dd>JSON + CSV reports</dd></div></dl>
    {!enabledRaritiesValid(manifest, settings) && <p className="error-banner"><AlertCircle size={16} /> Save a valid 100% rarity total for every enabled layer.</p>}
    {settings.count > max && <p className="error-banner"><AlertCircle size={16} /> Only {max.toLocaleString()} unique combinations are possible.</p>}
    {status === "running" ? <div className="generation-progress"><div><strong>{progress ? `${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()}` : "Preparing artwork…"}</strong><span>{progress ? `${Math.round(progress.completed / progress.total * 100)}%` : ""}</span></div><div className="progress-track"><span style={{ width: progress ? `${progress.completed / progress.total * 100}%` : "3%" }} /></div><p>{progress ? `${progress.duplicates.toLocaleString()} duplicates skipped · ${formatDuration(progress.remainingMs)} remaining` : "Loading traits and planning unique combinations…"}</p><button className="danger-button" onClick={cancel}>Cancel safely</button></div> : <div className="export-buttons"><button className="primary-button large" disabled={!valid || !folderSupport} onClick={() => start("folder")}><FolderDown size={19} /> Choose output folder</button><small>{folderSupport ? "Best for large collections in Chrome or Edge." : "Folder export is unavailable in this browser."}</small><button className="secondary-button large" disabled={!valid || settings.count > 1000} onClick={() => start("zip")}><FileArchive size={19} /> Download ZIP</button><small>ZIP export is limited to 1,000 NFTs to protect browser memory.</small></div>}
    {status !== "idle" && status !== "running" && <p className={`status-banner ${status}`}>{status === "complete" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}{message}</p>}
    {status === "running" && <p className="quiet-status">{message}</p>}
  </aside></div>;
}

type AssetSource = "folder" | "demo" | "bundled";

function SourceLanding({ bundledManifest, loading, selecting, error, inputRef, onFiles, onDemo, onBundled }: {
  bundledManifest: AssetManifest | null;
  loading: boolean;
  selecting: boolean;
  error: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList) => void;
  onDemo: () => void;
  onBundled: () => void;
}) {
  const bundledTraits = bundledManifest?.layers.reduce((sum, layer) => sum + layer.traits.length, 0) ?? 0;
  return <main className="source-landing">
    <header className="landing-nav"><Link className="brand" href="/"><span><Sparkles /></span><div><strong>NFT Studio</strong><small>Open-source collection generator</small></div></Link><a href="https://github.com/jasongreige/nft-studio" target="_blank" rel="noreferrer">View on GitHub <ArrowRight size={15} /></a></header>
    <section className="landing-hero"><div className="brand-mark"><Sparkles /></div><p className="eyebrow">Private by design</p><h1>Turn your artwork into a collection.</h1><p>Select your layer folders, tune each rarity, preview combinations, and export images with metadata. Everything happens in your browser.</p><div className="trust-row"><span><ShieldCheck size={16} /> No uploads</span><span><Layers3 size={16} /> PNG + WEBP</span><span><WandSparkles size={16} /> Metadata included</span></div></section>
    <section className="source-choices" aria-label="Choose how to begin">
      <button className="source-card featured" disabled={loading || selecting} onClick={() => inputRef.current?.click()}><span className="source-icon"><FolderOpen /></span><span className="source-badge">Recommended</span><strong>Choose asset folder</strong><small>Select one collection folder containing your layer folders. Files stay on this device.</small><span className="source-action">{selecting ? <><LoaderCircle className="spin" /> Reading artwork…</> : <>Choose folder <ArrowRight size={16} /></>}</span></button>
      <button className="source-card" disabled={loading || selecting} onClick={onDemo}><span className="source-icon demo"><Play /></span><strong>Try the demo</strong><small>Explore all five steps immediately with a small collection generated by the app.</small><span className="source-action">Open demo <ArrowRight size={16} /></span></button>
      {bundledTraits > 0 && <button className="source-card" disabled={loading || selecting} onClick={onBundled}><span className="source-icon bundled"><Layers3 /></span><strong>Explore included art</strong><small>Try the public {bundledManifest!.layers.length}-layer collection with {bundledTraits} original traits by Jason Greige.</small><span className="source-action">Open included art <ArrowRight size={16} /></span></button>}
    </section>
    <input className="visually-hidden" ref={inputRef} type="file" accept="image/png,image/webp,.png,.webp" multiple {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(event) => { if (event.target.files?.length) onFiles(event.target.files); event.target.value = ""; }} />
    {error && <p className="landing-error" role="alert"><AlertCircle size={17} /> {error}</p>}
    <section className="folder-example"><div><p className="eyebrow">Folder format</p><h2>One folder per layer</h2><p>Select the outer collection folder. Only PNG and WEBP files directly inside each layer are used.</p></div><pre><code>{`my-collection/\n├── backgrounds/\n│   ├── blue.png\n│   └── sunset.png\n├── bodies/\n├── eyes/\n└── hats/`}</code></pre></section>
    <footer className="landing-footer"><span>MIT-licensed software · No account · No backend</span><span>Included artwork: non-commercial use with attribution.</span></footer>
  </main>;
}

export function GeneratorApp() {
  const [bundledManifest, setBundledManifest] = useState<AssetManifest | null>(null);
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LayerRarity>>({});
  const [source, setSource] = useState<AssetSource | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/generated-assets/manifest.json").then(async (response) => {
      if (!response.ok) throw new Error("Asset manifest is missing. Run npm run sync-assets, then refresh.");
      setBundledManifest(await response.json() as AssetManifest);
    }).catch((reason) => setLoadError(reason instanceof Error ? reason.message : "Could not prepare NFT Studio."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (settings) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => () => releaseManifest(source === "bundled" ? null : manifest), [manifest, source]);

  function activate(nextManifest: AssetManifest, nextSource: AssetSource, label: string) {
    releaseManifest(source === "bundled" ? null : manifest);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    let storedSettings: unknown = defaultSettings(nextManifest);
    if (stored) {
      try { storedSettings = JSON.parse(stored); }
      catch { window.localStorage.removeItem(STORAGE_KEY); }
    }
    const nextSettings = mergeSettings(nextManifest, storedSettings);
    setManifest(nextManifest); setSettings(nextSettings); setDrafts(structuredClone(nextSettings.savedRarities));
    setSource(nextSource); setSourceLabel(label); setStep(0); setLoadError("");
  }

  async function chooseFiles(files: FileList) {
    setSelecting(true); setLoadError("");
    try {
      const result = await manifestFromFiles(files);
      activate(result.manifest, "folder", result.collectionName);
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : "Could not read that folder."); }
    finally { setSelecting(false); }
  }

  async function openDemo() {
    setSelecting(true); setLoadError("");
    try { activate(await createDemoManifest(), "demo", "Demo collection"); }
    catch (reason) { setLoadError(reason instanceof Error ? reason.message : "Could not create the demo."); }
    finally { setSelecting(false); }
  }

  function changeSource() {
    releaseManifest(source === "bundled" ? null : manifest);
    setManifest(null); setSettings(null); setDrafts({}); setSource(null); setSourceLabel(""); setStep(0); setLoadError("");
  }

  const subtitle = STEP_COPY[step];
  const enabledCount = useMemo(() => settings ? Object.values(settings.enabledLayers).filter(Boolean).length : 0, [settings]);
  if (!manifest || !settings || !source) return <SourceLanding bundledManifest={bundledManifest} loading={loading} selecting={selecting} error={loadError} inputRef={inputRef} onFiles={(files) => void chooseFiles(files)} onDemo={() => void openDemo()} onBundled={() => bundledManifest && activate(bundledManifest, "bundled", "Included art")} />;
  return <div className="app-shell"><header className="topbar"><Link className="brand" href="/" onClick={(event) => { event.preventDefault(); changeSource(); }}><span><Sparkles /></span><div><strong>NFT Studio</strong><small>Private, browser-based generator</small></div></Link><div className="topbar-actions"><span className="source-pill"><FolderOpen size={15} /> {sourceLabel}</span><button onClick={changeSource}>Change artwork</button><div className="privacy-pill"><ShieldCheck size={16} /> Your images stay private</div></div></header><div className="workspace"><Stepper current={step} onSelect={setStep} /><main className="main-panel"><header className="page-heading"><div><p className="eyebrow">Step {step + 1} of 5</p><h1>{subtitle[0]}</h1><p>{subtitle[1]}</p></div><div className="collection-stats"><span><Layers3 size={16} /> {enabledCount} layers</span><span><ImageIcon size={16} /> {manifest.layers.reduce((sum, layer) => sum + layer.traits.length, 0)} traits</span></div></header><section className="step-content">
    {step === 0 && <LayerStep manifest={manifest} settings={settings} setSettings={setSettings} />}
    {step === 1 && <OrderStep manifest={manifest} settings={settings} setSettings={setSettings} />}
    {step === 2 && <RarityStep manifest={manifest} settings={settings} drafts={drafts} setDrafts={setDrafts} setSettings={setSettings} />}
    {step === 3 && <PreviewStep manifest={manifest} settings={settings} />}
    {step === 4 && <GenerateStep manifest={manifest} settings={settings} setSettings={setSettings} setDrafts={setDrafts} />}
  </section><footer className="step-footer"><button className="text-button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={17} /> Back</button>{step < 4 && <button className="primary-button" onClick={() => setStep((value) => value + 1)}>Continue <ArrowRight size={17} /></button>}</footer></main></div></div>;
}
