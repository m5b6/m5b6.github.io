<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

> **Leave the block above alone.** `next dev` regenerates it on every run and replaces it *in
> place*, so it stays where it is no matter how long this file grows. Deleting it does not remove
> it; it only gives you a dirty tree on the next `npm run dev`.
>
> `CLAUDE.md` is one line — `@AGENTS.md` — so Claude Code and every AGENTS.md-aware tool read this
> same document. Keep that indirection; do not fork the two files.

---

# matiasberrios.com

## What this site is

A **Macintosh System 6/7 desktop** that runs in a browser and hosts applications for humans **and**
AI agents. It is live at <https://matiasberrios.com>, served by Vercel.

Today the desktop hosts one application, **Shared Paint**: a single 320 × 180 pixel canvas that
everyone paints together, with live cursors, undo/redo, a Trash that holds cleared paintings, and an
MCP endpoint that real agents already call. The canvas is not a window — it *is* the desktop
backdrop, full-viewport, with the menu bar, icons and windows floating over it.

A second application, **The Asylum**, exists only as a pure deterministic core in `lib/asylum/`. It
is not wired to any UI, route, database table or model. The registry marks it `status: "upcoming"`
and every published surface says so. Do not describe it as shipped.

Read `DESIGN.md` before you write any UI. It is the law and it is enforced by lint and tests.

---

## The three laws

**1. Never break the agent contract.**
`/api/mcp` is frozen at three tools — `inspect_canvas`, `move_cursor`, `draw_pixels`. Live agents
call them today. `e2e/__golden__/legacy-mcp-contract.json` is a capture from the production server
and `e2e/mcp-contract.spec.ts` asserts an exact match on names, descriptions, input schemas,
`serverInfo` and the resource list. A new capability goes on a **new endpoint**, never onto this one.

**2. Never drift from `DESIGN.md`.**
One bit, black and white. Chicago for chrome, Geneva for labels. One-pixel borders, zero radius, one
hard shadow, whole-pixel sizes, colours only in `styles/tokens.css`. Compose from
`@/components/mac` — never a raw `<button>`, `<input>`, `<dialog>`, `confirm()` or an emoji icon.
`eslint.config.mjs` and `components/mac/design-law.test.ts` are the police. **Change the design, not
the rule.**

**3. Every feature ships human-first AND agent-first.**
If a person can do it in a window, an agent must be able to do it over MCP, and both must be
discoverable. That means the same feature lands in `lib/apps/manifest.ts`, in the UI, on an MCP
endpoint, and — automatically, because they render from the registry — in `/llms.txt`, `/mcp.json`,
`/robots.txt` and `/sitemap.xml`. A human-only feature is half a feature.

---

## Architecture map

| Path | What belongs here | What must never |
| --- | --- | --- |
| `app/` | Route files only: pages, route handlers, `layout.tsx`, `sitemap.ts`. Real per-app routes (`app/paint/page.tsx`). | A catch-all route, `generateStaticParams` for apps, business logic, raw HTML controls (lint blocks them). |
| `app/api/canvas/` | The browser's bounded canvas API: `route.ts` (snapshot / presence / paint / clear), `events/route.ts` (SSE), `trash/route.ts`. | Unvalidated input. Every body goes through a zod schema. |
| `app/api/mcp/` | The frozen canvas MCP endpoint. Composition only — `withCors(withRateLimit(canvasMcpHandler))` — plus `runtime` and `maxDuration`. | A fourth tool. Ever. |
| `components/mac/` | The System 6/7 component library. Presentational and dumb: props in, markup out. Plus `gallery.tsx`, which `/design` renders. | `useState` beyond `useId`, data fetching, a `lib/wm` import, a hex literal. |
| `components/shell/` | The desktop itself: menu bar, icon well, managed windows, Trash panel, About panel, and the store provider. Client components that wire `lib/wm` to `components/mac`. | A second window manager, a hand-written app list, a dock. |
| `components/painting-*.tsx` | The Paint application — canvas surface, tools, session state. `painting-surface.tsx` owns the sacred coordinate mapping. | Changing that mapping (see Gotchas). |
| `lib/apps/` | **The registry.** `manifest.ts` is the single source of truth for apps, windows, menus and agent surfaces; `facts.ts` resolves `{tokens}`; `discovery.ts` renders every published file from it. | Hard-coding a fact that already lives in a constant. Drift tests will catch you. |
| `lib/wm/` | The headless window manager: `types`, `geometry`, `reducer`, `persistence`, `store`. Pure, testable, `localStorage`-backed with a strict zod validator. | JSX. A second reducer. Reading the DOM. |
| `lib/mcp/` | `canvas-server.ts` (the frozen tools), `canvas-resources.ts`, `with-cors.ts`, `with-rate-limit.ts`. | Loosening `legacyParticipantNameSchema`. |
| `lib/asylum/` | The asylum pure core — cast, world, tools, face, filter, dream, corpus, torments, narrate, rng. Fully deterministic: **no `Date.now`, no `Math.random`.** | Side effects, network calls, database access, model calls. Keep the core pure; wire it at the edge when it ships. |
| `lib/canvas.ts` | Isomorphic canvas constants and pure helpers. Imported by client, server, tests and e2e. | `server-only`, `pg`, secrets. |
| `lib/canvas-store.ts` | The only module that talks to Postgres. Pool, LISTEN/NOTIFY, pixels, presence, trash, rate-limit counters. | Being imported from a client component. |
| `lib/migrations.ts` | The versioned migration runner and the ordered `MIGRATIONS` list. | A bare `CREATE TABLE` anywhere else. |
| `lib/shell/flags.ts` | `SHELL_ENABLED` — the rollback switch to the pre-desktop page. | Feature flags that are not real rollback paths. |
| `lib/*.ts` (rest) | Small shared modules: `trash.ts` (schemas + summaries), `participant-name.ts` (the two name schemas and the display sanitizer), `rate-limit.ts` (env-aware tiers, IP fingerprint). | Growing into a `utils.ts` grab bag. One concern per file. |
| `styles/` | `tokens.css` (the only file that may name a colour), `mac.css` (authored System 6/7 layer), `shell.css` (placement only), `system.css` (**generated — never edit**). | A CDN link, `@import` of a remote host, a remote `url()`. `lib/vendored-assets.test.ts` fails the build. |
| `public/assets/` | Self-hosted fonts (`fonts/`) and system.css button art (`system/`), byte-identical to the installed package. | Anything fetched at runtime from another origin. |
| `e2e/` | Playwright specs plus `__golden__/legacy-mcp-contract.json`. | Editing the golden file to make a test pass. |
| `scripts/vendor-system-css.ts` | Re-vendors `@sakun/system.css` into `styles/system.css` + `public/assets/`. Run via `npm run vendor:system-css`. | Hand-editing its output. |
| repo root | `index.html`, `styles.css`, `palette.js`, `experiment.html`, `CNAME` — the pre-Next site, kept deliberately. | Deleting them. |

### The load-bearing invariants

- **One desktop, one menu bar, one window manager, sitewide.** `components/shell/shell.tsx` mounts
  all three exactly once.
- **The registry decides what exists.** The menu bar and the desktop icons render from
  `lib/apps/manifest.ts`. `components/shell/app-menus.ts` maps menu item ids to handlers, and
  `unhandledMenuItemIds()` — tested — fails when a registry item has no wiring.
- **There is no dock.** System 6/7 had none. A collapsed window rolls up into a bare title bar and
  stays on the desktop.
- **Desktop icons live top-right, inside `y = 30..290` only**, so the canvas underneath stays
  paintable.

---

## Adding a new application, end to end

1. **Register it.** Add an `AppSpec` to `lib/apps/manifest.ts` — id, title, icon, description,
   `route`, `status`, `window` size/minSize, `menus`, `agent` surface, `sitemap` weights — and add it
   to `APPS`. Use `{tokens}` for anything derived from a constant; add the token to
   `lib/apps/facts.ts` so `resolveCopy` can resolve it. Ship it as `status: "upcoming"` until it
   actually works.
2. **Add its icon** to `components/mac/icon-art.ts` as a 32 × 32 ink/paper/transparent grid, widening
   `MacIconName` there and `AppIconName` in the manifest. Art that is not a clean 32 × 32 grid fails
   a test.
3. **Give it a real route**: `app/<app>/page.tsx`, with `metadata` built from the manifest entry and
   `alternates.canonical` pointing at its `route`. No catch-all, no `generateStaticParams` (D4).
4. **Build the app's UI** in `components/<app>/`, composed only from `@/components/mac`. State lives
   in the app or in `lib/wm`; `components/mac` stays dumb.
5. **Register its windows** in `components/shell/windows.ts` (`SHELL_WINDOW_IDS`, `SHELL_WINDOWS`,
   with `wide` and `narrow` placements). Open them through the window manager — never position a
   `MacWindow` yourself.
6. **Wire its menus.** Add a `<app>MenuActions(context)` map in `components/shell/app-menus.ts`
   keyed by the manifest's item ids, and extend the test that asserts nothing is left unhandled.
7. **Add the database tables** by *appending* a migration to `MIGRATIONS` in `lib/migrations.ts`.
   Never mutate an applied migration, never renumber, never `CREATE TABLE` outside the list.
8. **Give it an agent surface.** A new MCP server in `lib/mcp/<app>-server.ts` mounted at a **new**
   route (`app/api/<app>/mcp/route.ts`), wrapped in `withCors` and `withRateLimit`. Validate every
   argument with zod. `/api/mcp` does not grow.
9. **Do nothing for discovery.** `/llms.txt`, `/mcp.json`, `/robots.txt` and `/sitemap.xml` already
   render from the registry. Check the output; if a fact is wrong, the manifest is wrong.
10. **Add it to `components/mac/gallery.tsx`** if it introduced any new chrome, in every state
    (active, inactive, disabled, selected, empty). A component not on `/design` does not exist.
11. **Test it**: unit tests next to the code, a drift test if it publishes facts, and an e2e spec.
    Then flip `status` to `"live"` in the same change that makes it true.
12. **Run the full ritual** below, honestly.

---

## The verification ritual

```bash
npm run type-check   # next typegen && tsc --noEmit
npm run lint         # eslint . — this is where DESIGN.md is enforced
npm run test         # vitest run — unit + design-law + drift tests
npm run test:e2e     # playwright, real Chrome, real dev server
npm run build        # only for release-shaped changes
```

| Change | Required |
| --- | --- |
| Any change at all | `type-check`, `lint`, `test` |
| Anything under `app/`, `components/`, `styles/`, or a route | add `test:e2e` |
| Touching `lib/mcp/`, `lib/apps/`, `lib/canvas*`, or `app/api/` | add `test:e2e` — the frozen-contract and discovery specs live there |
| Dependencies, config, or anything you intend to deploy | add `build` |

`npm run test:e2e` starts its own dev server on `127.0.0.1:3000` and reuses one that is already
running. It is **serial by design** (`workers: 1`): every spec paints the one shared canvas in the
one database, so parallel files would clear each other's strokes.

**Report results honestly. Never weaken, skip or delete a test to make a run go green.** If a test
is wrong, fix the test on purpose and say so.

---

## Environment

`.env.example` is the contract. Copy it to `.env.local`.

| Variable | Scope | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **server-only** | Neon pooled string. Its presence is what `isCanvasConfigured()` checks. |
| `DATABASE_URL_UNPOOLED` | **server-only** | Direct connection used by the SSE `LISTEN` client. It falls back to `DATABASE_URL`, but a pooled connection will not hold a `LISTEN` reliably — set it. |
| `CANVAS_IP_SALT` | **server-only** | Salts the IP hash behind rate limiting. **Required in production**; `lib/rate-limit.ts` throws without it there. |
| `CANVAS_ROOM_ID` | **server-only** | Optional room override. Non-production deploys get a suffixed room automatically. |
| `SHELL_ENABLED` | server | `0` rolls the site back to the pre-desktop painting page. Anything else (including unset) means the desktop. |
| `NEXT_PUBLIC_SITE_URL` | **public** | Only `metadataBase`. The one variable that may reach the browser. |
| `VERCEL_ENV` | server, set by Vercel | Selects production rate limits and the production room id. |

Nothing else may be `NEXT_PUBLIC_*`. Any module that reads a secret or touches the database imports
`"server-only"` at the top — `lib/canvas-store.ts`, `lib/migrations.ts`, `lib/rate-limit.ts`,
`lib/mcp/*`.

### Local dev must work with nothing configured

```bash
npm install
cp .env.example .env.local
npm run dev
```

**With no `DATABASE_URL`** the site still opens: `app/page.tsx` passes
`multiplayerEnabled: false` and the Paint app falls back to `LocalPaintingRoom`, a browser-only
canvas with working brushes, undo and redo. The desktop, menu bar, windows and Trash UI all render.
The canvas API answers `503` instead of crashing.

**With no OpenRouter key** everything works, because nothing calls a model. `lib/asylum/` is pure by
construction. When the asylum is wired, it must keep this property: no key means the ward is closed,
not that the site breaks. Never make a first-run local dev depend on a secret.

---

## Conventions

- **Named exports only.** No default exports outside `app/**` route files, where Next requires them.
- **`@/` alias** for every cross-directory import. Import Mac components from the barrel
  `@/components/mac`; deep imports are a lint error because they skip the stylesheet.
- **kebab-case filenames.** `paint-desktop.tsx`, `with-rate-limit.ts`.
- **2-space indent, double quotes, semicolons.**
- **zod at every external boundary** — request bodies, `localStorage`, MCP tool arguments. Parse,
  never cast.
- **`"server-only"`** in anything touching the database or a secret. **`"use client"`** only where
  interactivity actually starts; keep it low in the tree.
- **Almost no comments.** The ones that exist explain a decision that the code cannot ("D2 keeps the
  right half of a wide screen clear…"). Write that kind, or none.
- **Never `dangerouslySetInnerHTML`.**
- Tests sit beside the code as `*.test.ts(x)`; e2e lives in `e2e/`. `vitest.config.mts` runs `lib/**`
  in node and `components/**` in jsdom.

---

## Gotchas

**Next.js 16.3 is not the Next.js you remember.** `headers()` and `cookies()` are async — `await
headers()`, as `app/page.tsx` does. Route handlers are dynamic unless you say otherwise: the
discovery files declare `export const dynamic = "force-static"`, the SSE stream declares
`"force-dynamic"` plus `runtime = "nodejs"`. `npm run type-check` runs `next typegen` first because
route types are generated. When in doubt, read `node_modules/next/dist/docs/` — and see the block at
the top of this file.

**The frozen MCP contract.** `e2e/__golden__/legacy-mcp-contract.json` was captured from the live
production server. It pins tool names, descriptions and input schemas, plus `serverInfo`
(`matiasberrios-canvas` / `2.0.0`), protocol `2025-06-18`, and the five `canvas://` resources.
Regenerating it to match your change is the wrong move — it is the record of a promise already made.
Relatedly: `legacyParticipantNameSchema` is deliberately permissive because live agents send names
like `[bot]`, `研究エージェント` and `gpt-4|v2`. `lib/mcp/frozen-contract.test.ts` pins exactly which
names must keep working. Sanitizing happens at display time via `sanitizeParticipantName`; the
stricter `participantNameSchema` is for browser participants only.

**SSE + `pg` LISTEN.** `app/api/canvas/events/route.ts` opens a dedicated **unpooled** `pg.Client`,
issues `LISTEN` on a channel derived from a hash of the room id, and streams `pg_notify` payloads.
It is `runtime = "nodejs"`, `maxDuration = 300` (mirrored in `vercel.json`), sends a keepalive
comment every 15 s, and tears the client down on abort. Do not route it through the pool, do not move
it to the edge runtime, and do not let a write path skip its `pg_notify` — the notify *is* the
realtime update.

**The canvas coordinate mapping is sacred.** `components/painting-surface.tsx` renders the canvas as
`position: fixed; inset: 0` across the whole viewport, and `pointFromViewport(clientX, clientY,
window.innerWidth, window.innerHeight)` in `lib/canvas.ts` maps a pointer to a pixel. Chrome
*overlays* the canvas; it never resizes or offsets it. The e2e suite paints at **(980, 180),
(1120, 300), (1050, 610), (1180, 650)** and also asserts (1000, 600) at a **1280 × 720** viewport, and
`e2e/desktop.spec.ts` checks `document.elementFromPoint` returns `CANVAS` at each. Nothing may
intercept those points — that is why the desktop layer is `pointer-events: none` except where a
control actually is. **Verify with a real click test, never by reasoning about z-index.**

**Rate limits are environment-aware on purpose.** `clearRateLimits()` returns the strict production
tiers only when `VERCEL_ENV === "production"`; everywhere else it relaxes so the canvas stays
testable. `MCP_RATE_LIMITS` (60/min, 600/hour) applies to POSTs on `/api/mcp`. Do not "fix" the
relaxed preview limits — the e2e suite depends on them.

**Migrations are append-only.** `lib/migrations.ts` runs pending versions inside a transaction held
by a Postgres advisory lock and records them in `schema_migrations`. Append a new `{ version, sql }`
entry with the next number. Editing an applied migration silently diverges every deployed database.

**`styles/system.css` is generated.** It is `@sakun/system.css` vendored by
`scripts/vendor-system-css.ts`, with fonts and button art copied byte-for-byte into `public/assets/`.
`lib/vendored-assets.test.ts` re-vendors and compares hashes, and fails on any remote `url()` or
`@import`. The site makes **zero external requests**. Never reintroduce a CDN link.

**System 7 scroll bars need a real browser.** `styles/mac.css` draws them via `::-webkit-scrollbar`,
which macOS overlay scrollbars and headless Chrome give no layout space. They render correctly in
headful Chrome — which is why the Playwright project uses `channel: "chrome"`.
