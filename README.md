# EchoHex

A geospatial message board where messages are pinned to the map and aggregated into an H3 hexagonal grid.

## What it does

Users open the app, grant location access, and post short messages (up to 200 characters) anchored to their current geographic hexagon. As you pan and zoom the map, messages in your viewport load and appear as floating, draggable bubbles over their hex cells. A word-cloud layer visualizes the most frequent terms per hex at lower zoom levels. Messages expire after 48 hours. Reactions (emoji) update in real time via Supabase Realtime.

## Key features

- **H3 hex grid** — Uber's H3 library tessellates the map at resolution 7–9 depending on zoom; each cell is a distinct message zone
- **Word-cloud overlay** — D3-force-driven word cloud rendered per hex, showing the dominant vocabulary of recent messages
- **Floating message bubbles** — draggable, physics-simulated cards that stay positioned over their hex, powered by d3-force and Framer Motion
- **Compose bubble** — context-aware compose button that only appears when the user is inside a hex; enforces geographic constraint server-side
- **Emoji reactions** — per-message reaction counts, incremented via a Supabase RPC to avoid race conditions
- **Real-time updates** — Supabase Postgres Changes subscription pushes inserts, updates, and deletes to all connected clients; inserts are batched in 100 ms windows to avoid render churn
- **Anonymous sessions** — session identity is a random UUID stored in localStorage; no authentication required

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Map | Mapbox GL JS via react-map-gl |
| Hex grid | Uber H3 (h3-js) |
| Physics | d3-force |
| Animation | Framer Motion |
| Backend / DB | Supabase (PostgreSQL + Realtime) |
| State | Zustand |
| Styling | Tailwind CSS v4 |
| UI primitives | Radix UI, shadcn/ui |
| Notifications | Sonner |
| Date handling | Day.js |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- A Mapbox account with a public token
- A Supabase project with the `messages` table and `increment_reaction` RPC (see Deploy note)

### Install

```bash
pnpm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public access token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

### Dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Allow location access when prompted.

### Production build

```bash
pnpm build
pnpm start
```

## Deploy note

**Vercel** — import the repository and add the three environment variables in the project settings. No additional Vercel configuration is required; the app uses standard Next.js App Router conventions.

**Supabase** — the app expects:

1. A `messages` table with columns: `id` (uuid, pk), `h3_index` (text), `content` (text), `pos_relative` (jsonb), `reactions` (jsonb, default `{}`), `temp_user_id` (text), `created_at` (timestamptz, default `now()`).
2. A Postgres function `increment_reaction(msg_id uuid, emoji text)` that atomically increments `reactions->emoji` on the target row.
3. Realtime enabled on the `messages` table.

**Mapbox** — a free-tier account is sufficient for personal or portfolio use. Use a URL-restricted token in production to prevent unauthorized usage.
