# NFT Studio

A private, browser-based generator for layered NFT artwork. Choose a collection folder, configure trait rarity through a guided interface, preview combinations, and export PNG images with marketplace-friendly metadata.

**Your artwork stays on your device.** NFT Studio has no image-upload server, account, database, analytics, or API key.

[![CI](https://github.com/jasongreige/nft-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/jasongreige/nft-studio/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-8b5cf6.svg)](LICENSE)

## Highlights

- Choose an entire asset folder directly in the browser
- Instant built-in demo with artwork generated at runtime
- Five-step interface designed for artists and non-technical users
- Drag-and-drop back-to-front layer ordering
- Exact decimal rarity totals with save validation
- Natural-random and target-matching distribution modes
- Unique combinations with reproducible random seeds
- Canvas previews and Web Worker generation
- PNG images, token JSON, collection metadata, and CSV reports
- Direct-to-folder streaming for large collections
- ZIP fallback for broad browser support
- Static Next.js export suitable for Vercel or any static host

## Fastest way to try it

Clone and start the application:

```bash
git clone https://github.com/jasongreige/nft-studio.git
cd nft-studio
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then choose one of two starting points:

1. **Choose asset folder** — select your own collection folder privately.
2. **Try the demo** — explore the complete workflow immediately.

To deploy your own public copy without a backend:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jasongreige/nft-studio)

## Prepare your artwork

Create one outer collection folder. Every direct subfolder is a layer, and every PNG or WEBP directly inside a layer is a trait.

```text
my-collection/
├── backgrounds/
│   ├── blue.png
│   ├── red.png
│   └── space.webp
├── bodies/
│   ├── human.png
│   └── robot.png
├── eyes/
└── hats/
```

Select `my-collection`, not an individual layer folder.

### Artwork rules

- Supported traits are PNG and WEBP files.
- Only images directly inside each layer folder are used.
- Hidden files, unsupported files, and deeper nested folders are ignored.
- `none.png` and `nothing.png` are recognized as transparent no-image traits.
- Folder and filenames become readable display names automatically.
- `gold_crown.png` becomes `Gold Crown`.
- Source filenames are retained in metadata and reports.

### Image recommendations

- Use transparent PNG files for every layer placed above the background.
- Give all traits the same canvas dimensions whenever possible.
- Align artwork to the same canvas coordinates before importing it.
- Use descriptive filenames.
- Optimize very large source images before generating thousands of tokens.

When dimensions differ, NFT Studio shows a warning and uses high-quality browser resizing to fit the configured output canvas.

## Browser folder selection and privacy

The phrase **Choose asset folder** is intentional: files are selected, not uploaded.

- The browser grants the page temporary read access only after you choose a folder.
- Images become session-only object URLs used by previews and the generation worker.
- Source bytes are never sent to an NFT Studio backend.
- Refreshing or closing the page releases the selected files; choose the folder again to continue.
- Preferences and rarity values can remain in browser local storage, but images do not.
- **Change artwork** releases the current collection and returns to source selection.

Like any hosted software, the hosting provider still serves the application files. Review a deployment and its third-party policies before using confidential artwork. This repository contains no analytics or upload integration.

## The five-step workflow

### 1. Layers

Review every detected folder, trait count, image size, and validation warning. Disable any complete layer that should not participate.

### 2. Layer order

Arrange layers from back to front. The first row is drawn first and appears furthest behind. Drag rows or use the keyboard-accessible arrow controls.

### 3. Trait rarity

Choose a layer and assign percentages to enabled traits. The total updates immediately using decimal arithmetic.

- **Distribute equally** gives every enabled trait the same chance.
- **Normalize to 100%** scales current values proportionally.
- **Set to zero** clears the draft values.
- **Save this layer** becomes available only at exactly 100%.

Edits remain drafts until saved. Generation stays unavailable until every enabled layer has a valid saved distribution.

### 4. Preview

Generate one or five temporary samples. Each preview shows selected source filenames, configured rarity, and the combined probability. Previewing writes nothing and does not alter final generation.

### 5. Generate

Enter an image name and quantity, select a distribution mode, and choose an export method.

`My Babies` produces names such as:

```text
my_babies_1.png
my_babies_1.json
my_babies_2.png
my_babies_2.json
```

## Distribution modes

### Natural randomness

Every trait is selected independently using its configured probability. This behaves like repeated dice rolls, so generated percentages naturally vary—especially for small collections.

### Match rarity targets

NFT Studio calculates per-layer target counts with largest-remainder allocation, seeded shuffling, and uniqueness repair. It attempts to match configured totals as closely as the collection size permits.

Both modes enforce unique full trait combinations and stop when the requested count exceeds the theoretical maximum.

## Export options

### Choose output folder

Recommended for large collections. Supporting browsers ask for write permission and stream each finished file into a new timestamped folder. Images do not accumulate in browser memory.

Direct folder writing currently works best in Chrome or Edge and requires HTTPS or localhost.

### Download ZIP

Works in more browsers but builds the archive in memory. ZIP generation is limited to 1,000 NFTs.

A completed export contains:

```text
collection-name-collection-YYYYMMDD-HHMMSS/
├── images/
│   ├── collection_name_1.png
│   └── ...
├── metadata/
│   ├── collection_name_1.json
│   └── ...
├── collection_metadata.json
├── generation_config.json
├── generation_report.csv
└── rarity_report.csv
```

## Metadata

Each token includes standard attributes and explicit source-trait information:

```json
{
  "name": "My Babies #1",
  "description": "",
  "image": "my_babies_1.png",
  "edition": 1,
  "attributes": [
    {
      "trait_type": "Background",
      "value": "Blue"
    }
  ],
  "properties": {
    "traits": [
      {
        "layer": "backgrounds",
        "filename": "blue.png",
        "display_name": "Blue",
        "configured_rarity_percentage": 12.5
      }
    ],
    "combination_probability_percentage": "0.000125"
  }
}
```

None traits affect combination probability. They are omitted from marketplace `attributes` but retained in the explicit source-trait list so reports remain auditable.

Set an optional IPFS or HTTPS base image URI under **Advanced settings** after uploading generated images. Leave it blank to use relative filenames.

## Saved settings

Settings are saved automatically in browser local storage. **Export settings** downloads layer order, rarities, naming, and advanced preferences as JSON.

Settings files do not contain images. A user-selected folder must be selected again after a refresh before imported settings can be reconciled with its stable layer and trait IDs.

## Browser support

- Use a current desktop browser for folder selection and generation.
- Chrome or Edge is recommended for direct-to-folder export.
- Firefox and Safari can use ZIP export where direct directory writing is unavailable.
- Folder selection support may be limited in older browsers and embedded in-app browsers.
- Large source images and ZIP exports consume browser memory.

## Deploying

NFT Studio uses Next.js static export and needs no runtime server. `npm run build` writes the deployable application to `out/`.

You can deploy it to:

- Vercel
- GitHub Pages with suitable path configuration
- Netlify
- Cloudflare Pages
- Any static web server

Browser-selected artwork is read at runtime, so visitors can use their own collection without modifying the deployment or uploading images to a server.

## Development

Requirements:

- Node.js 20.9 or newer
- npm 10 or newer

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run check` | Run ESLint, TypeScript, and unit tests |
| `npm test` | Run Vitest tests |
| `npm run test:e2e` | Run Playwright user-flow tests |
| `npm run build` | Create the production static export |
| `npm start` | Serve an existing `out/` build |

Install Playwright Chromium once before running end-to-end tests:

```bash
npx playwright install chromium
```

### Architecture

```text
src/lib/asset-input.ts             Browser folder parsing and generated demo
src/components/                    Guided React interface
src/lib/                           Framework-independent generation logic
src/workers/generator.worker.ts    Sequential compositor and report generator
src/test/                          Unit and integration tests
e2e/                               Playwright user-flow tests
```

The Web Worker plans unique combinations, caches decoded traits, composites through `OffscreenCanvas`, and uses an acknowledgement protocol so only one completed image waits to be written at a time.

Tests create disposable artwork at runtime and do not require an artwork collection in the repository.

## Troubleshooting

### The selected folder is rejected

Select one outer collection folder containing direct layer folders. Images placed directly in the outer folder or more than one folder deep are not treated as traits.

### My selected collection disappeared after refresh

This is intentional for privacy. Browser file permissions are session-scoped in this workflow. Select the folder again; saved settings will be reconciled by stable folder and filenames.

### A layer does not appear

Confirm that it is a direct folder and contains at least one valid PNG or WEBP directly inside it.

### Rarity cannot be saved

Enabled traits must total exactly 100%. Use **Normalize to 100%** or **Distribute equally**, then save the layer.

### Not enough unique combinations

Reduce the collection size, enable more traits, or give additional traits a positive rarity.

### Preview or generation fails

Verify that all files are valid PNG or WEBP images. Try current Chrome or Edge, reduce output dimensions, and close memory-heavy tabs.

### Direct folder export is unavailable

Use Chrome or Edge on HTTPS or localhost, or select **Download ZIP**.

## Contributing and security

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report security concerns according to [SECURITY.md](SECURITY.md).

Do not include artwork you do not own or have permission to distribute in issues, test fixtures, or pull requests.

## License

NFT Studio source code is available under the [MIT License](LICENSE). Artwork selected in the browser remains subject to its owner's terms and is never included in this repository by the app.
