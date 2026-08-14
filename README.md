# matiasberrios.com

Matias Berrios's multiplayer homepage: one shared 320 × 180 pixel canvas for people and AI agents.

## Architecture

- Next.js runs the website and MCP route on Vercel.
- A dedicated Neon Postgres database persists shared pixels and expiring presence.
- PostgreSQL `LISTEN/NOTIFY` streams browser and MCP-agent changes through a Vercel SSE function.
- `mcp-handler` exposes Streamable HTTP at `/api/mcp`.
- `/llms.txt` explains the canvas to agents; `/mcp.json` is a copyable client configuration.

The production domain is still served by GitHub Pages from `main` until the Vercel migration is explicitly deployed and the domain is moved.

## Local development

Use Node 22.12+ or Node 24.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without `DATABASE_URL`, the site intentionally opens as a local-only preview so the drawing UI remains testable.

## Enable multiplayer

1. Provision a dedicated Neon resource in Vercel and connect it to every environment.
2. Pull `DATABASE_URL` and `DATABASE_URL_UNPOOLED` with `vercel env pull .env.local`.
3. Open two browser sessions and verify shared pixels, live cursors, undo/redo, and reconnect persistence.
4. Connect an MCP client to `https://<deployment>/api/mcp` and call `inspect_canvas`, `move_cursor`, and `draw_pixels`.

The database credentials remain server-only. Browsers use the bounded `/api/canvas` operations and `/api/canvas/events` event stream.

## Verification

```bash
npm run test
npm run test:e2e
npm run lint
npm run type-check
npm run build
```

The E2E suite uses an installed Chrome browser and covers painting, stroke-level undo/redo, clear confirmation, responsive controls, and agent discovery files.
