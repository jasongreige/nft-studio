# NFT Studio

A private, browser-based generator for layered NFT artwork. Add image folders, configure rarity through a guided interface, preview combinations, and export PNG images with marketplace-friendly JSON and CSV reports.

NFT Studio is built with Next.js and TypeScript. Artwork is composited on the user's device and is never uploaded to a backend.

## Why NFT Studio?

- Five-step interface designed for non-technical users
- Automatic layer and trait detection from folders
- Drag-and-drop back-to-front layer ordering
- Live decimal rarity totals with validation
- Weighted random and exact-target distribution modes
- Unique combination enforcement and reproducible random seeds
- Browser previews before generating a collection
- Detailed metadata containing source filenames and trait rarity
- Direct-to-folder streaming for collections up to 10,000 images
- ZIP downloads for smaller collections
- No database, account, API key, or Python installation

## Requirements

- [Node.js](https://nodejs.org/) 20.9 or newer
- npm 10 or newer
- A current desktop browser
  - Chrome or Edge is recommended for large direct-to-folder exports.
  - Other modern browsers can use ZIP export for up to 1,000 images.

## Quick start

```bash
git clone https://github.com/jasongreige/nft-studio.git
cd nft-studio
npm install
```

The public repository intentionally contains an empty `assets/` folder. Add your artwork before starting the app.

```text
assets/
├── backgrounds/
│   ├── blue.png
│   ├── red.png
│   └── space.png
├── bodies/
│   ├── human.png
│   └── robot.png
├── eyes/
└── hats/
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Preparing artwork

### Folder rules

- Every direct folder inside `assets/` is one layer.
- Every PNG or WEBP directly inside a layer folder is one trait.
- Hidden and unsupported files are ignored.
- Folder and filenames are converted into readable labels automatically.
- `gold_crown.png` becomes `Gold Crown`.
- `nothing.png` or `none.png` becomes an optional no-image trait.

### Image recommendations

- Use transparent PNG files for layers drawn over other artwork.
- Give every trait the same width and height whenever possible.
- Keep artwork aligned to the same canvas coordinates.
- Use descriptive filenames because original filenames appear in reports and metadata.
- Optimize large source files before generating thousands of images.

If dimensions differ, NFT Studio displays a warning and resizes traits to the selected output dimensions with high-quality browser smoothing.

### Refreshing assets

Asset discovery runs automatically before `npm run dev` and `npm run build`. If the server is already running when artwork changes, stop it and restart, or run:

```bash
npm run sync-assets
```

The synchronization script reads `assets/`, validates images, and creates ignored browser-ready files under `public/generated-assets/`. It never edits source artwork.

## Using the interface

### 1. Layers

Review every detected folder, trait count, and image size. Disable any complete layer that should not participate in generation.

### 2. Layer order

Arrange layers from back to front. The first row is composited first and appears furthest behind. Drag rows or use the accessible arrow controls.

### 3. Trait rarity

Choose a layer and assign percentages to its enabled traits. The total updates immediately.

- **Distribute equally** gives every enabled trait the same chance.
- **Normalize to 100%** scales the current values proportionally.
- **Set to zero** clears the draft values.
- **Save this layer** is available only when enabled traits total exactly 100%.

Edits remain drafts until saved. Final generation is unavailable until every enabled layer has a valid saved distribution.

### 4. Preview

Generate one or five temporary examples. A preview shows the selected source filename, configured trait rarity, and combined probability. It does not write files or change the final random sequence.

### 5. Generate

Enter an Image name and collection size, then choose a distribution mode:

- **Natural randomness** selects every trait independently using its configured probability. Actual collection percentages can vary.
- **Match rarity targets** uses largest-remainder target counts and seeded shuffling to match configured percentages as closely as possible while keeping full combinations unique.

The Image name controls both display titles and safe filenames. `My Babies` produces:

```text
my_babies_1.png
my_babies_1.json
my_babies_2.png
my_babies_2.json
```

## Export options

### Choose output folder

Recommended for large collections. In Chrome or Edge, the browser asks permission to create a timestamped folder and streams each completed file directly to disk. Completed images are not retained in browser memory.

The File System Access API requires localhost or HTTPS and an explicit user action. Cancelled or failed runs remove their incomplete timestamped folder when the browser permits it.

### Download ZIP

Works across more browsers but holds the archive in browser memory. NFT Studio limits ZIP generation to 1,000 images.

Every completed export contains:

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

Each token receives standard marketplace-style attributes plus explicit source information:

```json
{
  "name": "My Babies #1",
  "description": "",
  "image": "my_babies_1.png",
  "edition": 1,
  "attributes": [
    {
      "trait_type": "Back Accessories",
      "value": "Cape"
    }
  ],
  "properties": {
    "traits": [
      {
        "layer": "back accessories",
        "filename": "cape.png",
        "display_name": "Cape",
        "configured_rarity_percentage": 12.5
      }
    ],
    "combination_probability_percentage": "0.000125"
  }
}
```

`combination_probability_percentage` multiplies the configured probabilities of all selected traits. It describes the configured probability of that combination, not a guaranteed observed frequency.

Set an optional IPFS or HTTPS base image URI under Advanced settings after uploading images. When left empty, metadata uses the generated filename.

## Saved settings and privacy

Configuration is saved automatically in browser local storage. Export Settings downloads layer order, rarity, naming, and advanced preferences as JSON. It never includes artwork.

- Generation occurs locally in the browser.
- There is no analytics integration, authentication, or backend storage.
- Source artwork is excluded from this Git repository by default.
- Review third-party hosting and browser policies before working with confidential artwork.

## Deploying to Vercel

The application is a static Next.js export and deploys cleanly to Vercel. However, files ignored by Git are not available during a Vercel build.

For a private local collection, keep artwork ignored and run NFT Studio locally. To deploy a collection-specific site, a fork owner must intentionally publish the required artwork—for example by changing the ignore policy or force-adding selected assets. Those files will then be publicly downloadable from the deployed website and Git history.

Do not publish artwork unless you own it and intend to make it public.

## Development

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Synchronize assets and start the local app |
| `npm run sync-assets` | Rebuild the browser asset manifest |
| `npm run check` | Run linting, TypeScript, and unit tests |
| `npm test` | Run Vitest unit and integration tests |
| `npm run test:e2e` | Run Chromium user-flow tests |
| `npm run build` | Validate assets and create the static production build |
| `npm start` | Serve an existing `out/` production build |

Install the Playwright browser once before running end-to-end tests:

```bash
npx playwright install chromium
```

### Architecture

```text
assets/                         Private local source artwork (ignored)
scripts/sync-assets.mjs         Read-only asset validation and manifest build
src/components/                 Guided React interface
src/lib/                        Framework-independent generation logic
src/workers/generator.worker.ts Image compositor and report generator
src/test/                       Unit and integration tests
e2e/                            Playwright browser tests
```

The Web Worker plans unique combinations, caches decoded traits, composites through `OffscreenCanvas`, and uses an acknowledgement protocol so only one completed image waits to be written at a time.

## Troubleshooting

### “Add your artwork to begin”

The repository ships without artwork. Add at least one layer folder containing PNG or WEBP files under `assets/`, then restart `npm run dev`.

### Rarity cannot be saved

Enabled trait values must total exactly 100%. Use Normalize or Distribute equally, then save that layer.

### Not enough unique combinations

Reduce the requested collection size, enable more traits, or assign a positive rarity to additional traits.

### Exact distribution cannot be created

Some target counts cannot form enough unique complete combinations. Reduce the amount, adjust rarity, or use Natural randomness.

### Folder export is unavailable

Use current Chrome or Edge on localhost/HTTPS, or use ZIP export for collections up to 1,000.

### Artwork changes do not appear

Restart the development server or run `npm run sync-assets`, then refresh the page.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Never include copyrighted or personal collection artwork in a contribution.

## Security

Please report vulnerabilities through GitHub private vulnerability reporting as described in [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
