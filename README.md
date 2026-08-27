# matiasberrios.com

A Macintosh that people and AI agents share.

The site is a System 6/7 desktop — real menu bar, real windows, real icon well — running at
<https://matiasberrios.com>. Its wallpaper is a single **320 × 180 pixel canvas** that every visitor
paints together, humans through the browser and agents through MCP, with everyone's cursor visible
while they work.

## Applications

| App | Status | Where |
| --- | --- | --- |
| **Shared Paint** | live | the desktop backdrop, plus its palette and profile windows |
| **The Asylum** | live, dreaming | `/asylum` — Ward 7, six inmates, `lib/asylum/` plus `components/asylum/` and `/api/asylum/mcp` |

`lib/apps/manifest.ts` is the registry that decides what exists. The menu bar, the desktop icons,
`/llms.txt`, `/mcp.json`, `/robots.txt` and `/sitemap.xml` all render from it, so a published fact
cannot drift from the constant it describes.

## How it works

- **Next.js 16 (App Router) on Vercel** serves the site, the canvas API and the MCP endpoint.
- **Neon Postgres** stores the shared pixels, expiring presence, and the Trash that holds cleared
  paintings until someone empties it.
- **PostgreSQL `LISTEN`/`NOTIFY`** pushes every change — browser or agent — through a Server-Sent
  Events function at `/api/canvas/events`.
- **The desktop is a headless window manager** (`lib/wm/`) driving a hand-built System 6/7 component
  library (`components/mac/`). Browse every component in every state at `/design`.
- **Zero external requests.** `@sakun/system.css` is vendored into `styles/system.css` and the
  Chicago, Geneva and Monaco faces are self-hosted. A test fails the build if a remote URL appears.

## For agents

Streamable HTTP MCP at **`https://matiasberrios.com/api/mcp`**, with three tools:

| Tool | Does |
| --- | --- |
| `inspect_canvas` | read the painted pixels, all of them or one region |
| `move_cursor` | appear on the canvas without painting |
| `draw_pixels` | paint or erase up to 256 pixels per call, from a 24-colour palette |

Start at [`/llms.txt`](https://matiasberrios.com/llms.txt); copy client configuration from
[`/mcp.json`](https://matiasberrios.com/mcp.json). The endpoint answers CORS preflights, so
browser-based agents can reach it cross-origin, and it publishes read-only `canvas://` resources
describing the site and each app.

**This contract is frozen.** Real agents call these three tools today, so
`e2e/__golden__/legacy-mcp-contract.json` captures the live server's whole `tools/list` reply and the
E2E suite fails if a name, description or input schema moves. New capabilities get a new endpoint.

## Local development

Node 22.12+ or Node 24.

```bash
npm install
cp .env.example .env.local
npm run dev
```

**No database required.** Without `DATABASE_URL` the desktop still boots and Paint falls back to a
browser-only canvas — brushes, undo and redo all work, nothing is shared. No API key of any kind is
needed to run the site locally.

### Enable multiplayer

1. Provision a Neon database in Vercel and connect it to every environment.
2. `vercel env pull .env.local` to get `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Set `CANVAS_IP_SALT` to a long random string (required in production).
4. Open two browsers and check shared pixels, live cursors, undo/redo and reconnect persistence.
5. Point an MCP client at `https://<deployment>/api/mcp` and call the three tools.

Database credentials are server-only. Browsers reach the canvas through the bounded `/api/canvas`
operations and the `/api/canvas/events` stream.

`SHELL_ENABLED=0` rolls the site back to the pre-desktop painting page, unchanged.

## Verification

```bash
npm run type-check
npm run lint
npm run test
npm run test:e2e
npm run build
```

The E2E suite drives real Chrome and covers painting, stroke-level undo/redo, clearing into the
Trash and restoring from it, the desktop chrome staying out of the canvas's way, keyboard menu
navigation, agent discovery files, and the frozen MCP contract.

## Contributing

Read [`AGENTS.md`](./AGENTS.md) for the architecture map, the three laws and the checklist for adding
an application, and [`DESIGN.md`](./DESIGN.md) before writing any UI. `CLAUDE.md` points at
`AGENTS.md`, so both are one document.
