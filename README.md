# PixelCraft Studio

Open-source AI media generation playground powered by [fal.ai](https://fal.ai). Generate, edit, upscale, and persist images and videos using state-of-the-art models from a single interface.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Convex](https://img.shields.io/badge/Convex-backend-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

### Text-to-Image

Generate images from text prompts using multiple model families:

- **Flux** — Dev, Schnell, Pro Ultra
- **Stable Diffusion** — 3.5 Large
- **Recraft** — V3 (vectors, logos)
- **Flux 2** — Flex
- **OpenAI** — GPT Image 1.5
- **Google** — Nano Banana, Nano Banana 2
- **Ideogram** — V3
- **Bria** — Fibo

Each model exposes conditional controls: negative prompt, guidance scale, inference steps, aspect ratio, resolution, style, colors, reference images, and more.

### Image-to-Video / Text-to-Video

Animate images or generate videos from text:

- **Kling** — v3 Pro, O3 Standard (multi-shot, elements, audio)
- **MiniMax** — Hailuo 2.3 Pro, Hailuo 02 Standard
- **ByteDance** — Seedance 1.5 Pro
- **Google** — Veo 3.1, Veo 3.1 Fast
- **OpenAI** — Sora 2, Sora 2 Pro
- **Wan (Alibaba)** — Wan 2.2
- **Creatify** — Aurora (avatar + lip-sync)

Supports duration, aspect ratio, resolution, audio generation, multi-shot timelines, and custom elements.

### Image Editor

- **Upscale** — Super Resolution, Bria Creative (4MP), Topaz Gigapixel, SeedVR2
- **Background Removal** — Rembg, Bria RMBG 2.0, Pixelcut

### Gallery & Persistence

- Local gallery with Zustand + localStorage
- Auto-persist media to **Cloudflare R2** via **Convex** backend
- Files survive after fal.ai URLs expire (24h TTL)
- Download, delete, migrate to R2, view metadata
- Cost tier badges ($–$$$$) per generation

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| State | Zustand with persist middleware |
| Backend | Convex (realtime DB, HTTP routes, cron jobs) |
| AI API | fal.ai (@fal-ai/client) |
| Storage | Cloudflare R2 (via Convex file component) |
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

   This will populate `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.

4. **Configure R2 in Convex Dashboard** (if using persistence):

   Go to your [Convex Dashboard](https://dashboard.convex.dev) → Project → Settings → Environment Variables and add:

   ```
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key
   R2_SECRET_ACCESS_KEY=your_secret_key
   R2_BUCKET_NAME=pixelcraft
   R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev
   ```

5. **Run the dev server:**

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Without R2 (minimal setup)

If you only want to generate media without persistence, just set `FAL_KEY` and run Convex. The app works without R2 — generated media will be available via fal.ai URLs (which expire after 24h).

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
    actions.ts          # Server actions (fal.ai API calls)
    persistence.ts      # R2 upload/persist logic
    cost-estimate.ts    # Cost estimation per model
    image-optimize.ts   # Client-side image optimization
    download.ts         # File download helpers
  stores/
    gallery.ts          # Zustand gallery store with localStorage persistence
  types/
    index.ts            # Model configs, types, cost tiers
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

Actual costs are determined by fal.ai pricing per model. Check [fal.ai pricing](https://fal.ai/models) for current rates.

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
