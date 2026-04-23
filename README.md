# PixelCraft Studio

Open-source AI media playground. Build creative workflows that chain text-to-image, image-to-video, upscaling, and background removal — all backed by [fal.ai](https://fal.ai) models with persistent storage via Convex + Cloudflare R2.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Convex](https://img.shields.io/badge/Convex-backend-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

## Why PixelCraft?

Most AI media tools lock you into a single model or a fixed pipeline. PixelCraft is designed around **composable workflows**: generate an image, send it to video, upscale the result, remove the background — each step powered by whichever model fits the job and your budget.

New models ship on fal.ai every week. PixelCraft's architecture makes it straightforward to integrate them: add a config entry, wire the parameters in the server action, and the UI adapts automatically. The pattern is consistent — use an AI assistant with the [fal.ai docs](https://fal.ai/models) open and you can go from zero to a working integration in minutes.

## Workflows

PixelCraft supports end-to-end media creation pipelines from a single interface:

### Generate

**Text → Image** — Write a prompt, pick a model, tune controls (guidance, steps, seed, aspect ratio, resolution, negative prompt, reference images, style, colors). Generate one or multiple images per run.

**Text → Video / Image → Video** — Animate from a prompt, a source image, or both. Configure duration, aspect ratio, resolution, audio generation, multi-shot timelines, and custom elements depending on the model.

### Edit

**Image editing** — Re-style or transform an existing image using a prompt. Supports image-to-image, reference-based editing, and model-specific modes.

**Upscale** — Increase resolution with models that add detail rather than just stretching pixels. Choose between basic upscaling, creative enhancement, or professional-grade restoration.

**Background removal** — Clean cutouts for product photos, portraits, or compositing. Multiple models available depending on edge precision needs.

### Persist & Manage

- **Gallery** — All generated media is stored locally in the browser and displayed in a unified gallery with metadata, cost info, and download actions.
- **Auto-persist to R2** — Media is automatically uploaded to Cloudflare R2 via Convex, so files survive after fal.ai URLs expire (24h TTL).
- **R2 Manager** — Browse, search, and delete persisted files directly from the UI.

### Compose

The real power is combining these steps:

1. Generate an image from text
2. Edit or refine it with image-to-image
3. Animate it into a video
4. Upscale the result for production

Each step uses the best model for the job, with cost estimates shown before every generation.

## Adding New Models

PixelCraft uses a config-driven architecture. Models are defined in `src/types/index.ts` as data — not scattered across components. To add a new model:

1. **Find the model** on [fal.ai/models](https://fal.ai/models) and check its input/output schema
2. **Add a config entry** in `IMAGE_MODEL_FAMILIES`, `VIDEO_MODEL_FAMILIES`, `UPSCALE_MODELS`, or `BG_REMOVAL_MODELS` with the model's supported controls
3. **Wire the parameters** in `src/lib/actions.ts` — add a conditional block that maps your config fields to the fal.ai input schema
4. **Done** — the UI renders controls dynamically based on the config's `supports` array

The pattern is the same across all model types. Check `src/types/index.ts` for existing examples, then use an AI assistant with the [fal.ai documentation](https://fal.ai/models) to generate the integration. Most new models can be added in under 30 minutes.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| State | Zustand with persist middleware |
| Backend | Convex (realtime DB, HTTP routes, cron jobs) |
| AI API | fal.ai ([@fal-ai/client](https://www.npmjs.com/package/@fal-ai/client)) |
| Storage | Cloudflare R2 (via [Convex file component](https://www.npmjs.com/package/@gilhrpenner/convex-files-control)) |
| Package Manager | Bun |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- A [fal.ai](https://fal.ai) account and API key
- A [Convex](https://convex.dev) account
- A [Cloudflare R2](https://www.cloudflare.com/products/r2/) bucket (optional, for persistence)

### Setup

1. **Clone and install:**

   ```bash
   git clone https://github.com/carlosglz1912/pixelcraft.git
   cd pixelcraft
   bun install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your credentials:

   ```
   FAL_KEY=your_fal_key

   # Convex (run `bunx convex dev` to auto-populate these)
   CONVEX_DEPLOYMENT=
   NEXT_PUBLIC_CONVEX_URL=

   # Cloudflare R2 (optional — enables persistent file storage)
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key
   R2_SECRET_ACCESS_KEY=your_secret_key
   R2_BUCKET_NAME=pixelcraft
   R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev
   ```

3. **Initialize Convex:**

   ```bash
   bunx convex dev
   ```

   This populates `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.

4. **Configure R2 in Convex Dashboard** (if using persistence):

   Go to [Convex Dashboard](https://dashboard.convex.dev) → Project → Settings → Environment Variables and add the same R2 credentials.

5. **Run the dev server:**

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Without R2 (minimal setup)

Just set `FAL_KEY` and run Convex. The app works without R2 — generated media will be available via fal.ai URLs (which expire after 24h).

## Project Structure

```
src/
  app/                  # Next.js App Router
  components/
    features/           # Gallery, text-to-image, image-to-video, image-editor, R2 manager
    layout/             # App tabs / sidebar
    providers/          # Convex provider
    ui/                 # shadcn/ui components
  lib/
    actions.ts          # Server actions — all fal.ai API calls live here
    persistence.ts      # R2 upload/persist logic
    cost-estimate.ts    # Cost estimation per model/tier
    image-optimize.ts   # Client-side image optimization before upload
    download.ts         # File download helpers
  stores/
    gallery.ts          # Zustand gallery store with localStorage persistence
  types/
    index.ts            # Model configs, support flags, cost tiers
    fal.ts              # fal.ai response types
convex/
  files.ts              # File upload/download/persist mutations
  http.ts               # HTTP routes for file persistence
  schema.ts             # Convex database schema
  crons.ts              # Hourly cleanup of expired files
```

## Cost Awareness

Each model is tagged with a cost tier. The UI shows estimated costs before generation:

| Tier | Label |
|------|-------|
| free | Free |
| low | $ |
| medium | $$ |
| high | $$$ |
| premium | $$$$ |

Actual costs are determined by [fal.ai pricing](https://fal.ai/models) per model.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | TypeScript type checking |

## License

[MIT](LICENSE)
