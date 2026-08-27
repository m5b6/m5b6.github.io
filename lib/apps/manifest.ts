export type AppId = "paint" | "asylum";
export type AppStatus = "live" | "upcoming";
export type AppIconName = "canvas" | "ward";

export type Size = { width: number; height: number };

export type WindowSpec = {
  size: Size;
  minSize: Size;
};

export type MenuItemSpec = {
  id: string;
  label: string;
  shortcut?: string;
};

export type MenuSpec = {
  id: string;
  title: string;
  items: readonly MenuItemSpec[];
};

export type AgentToolSpec = {
  name: string;
  summary: string;
};

export type AgentSurfaceSpec = {
  serverName: string;
  endpoint: string;
  tools: readonly AgentToolSpec[];
  facts: readonly string[];
  guidance: readonly string[];
};

export type SitemapSpec = {
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
};

export type AppSpec = {
  id: AppId;
  title: string;
  icon: AppIconName;
  description: string;
  route: string;
  status: AppStatus;
  window: WindowSpec;
  menus: readonly MenuSpec[];
  agent: AgentSurfaceSpec;
  sitemap: SitemapSpec;
};

export const SITE = {
  origin: "https://matiasberrios.com",
  name: "matiasberrios.com",
  owner: "Matias Berrios",
  summary:
    "{owner}'s multiplayer homepage. Humans and AI agents paint one shared {width} by {height} pixel canvas and can see each other's live cursors.",
  desktop:
    "The site is a Macintosh desktop. Every app on it is listed below with the surface an agent needs to use it.",
  transport: "Streamable HTTP",
  closing:
    "Plain HTTP crawlers cannot publish cursor coordinates. Browser agents that execute the page JavaScript join presence automatically; other agents should use the MCP tools above.",
} as const;

export const DISCOVERY_PATHS = {
  instructions: "/llms.txt",
  configuration: "/mcp.json",
  robots: "/robots.txt",
  sitemap: "/sitemap.xml",
} as const;

export const PAINT_APP = {
  id: "paint",
  title: "Shared Paint",
  icon: "canvas",
  description:
    "One pixel canvas that humans and AI agents paint together. Every visitor's cursor is visible to everyone else while they work.",
  route: "/",
  status: "live",
  window: {
    size: { width: 262, height: 322 },
    minSize: { width: 240, height: 200 },
  },
  menus: [
    {
      id: "paint",
      title: "Paint",
      items: [
        { id: "paint.undo", label: "Undo", shortcut: "⌘Z" },
        { id: "paint.redo", label: "Redo", shortcut: "⇧⌘Z" },
        { id: "paint.brush", label: "Cycle Brush", shortcut: "B" },
        { id: "paint.eraser", label: "Eraser", shortcut: "E" },
        { id: "paint.rainbow", label: "Rainbow Mode", shortcut: "R" },
        { id: "paint.mirror", label: "Horizontal Mirror", shortcut: "M" },
        { id: "paint.clear", label: "Clear Canvas…" },
      ],
    },
  ],
  agent: {
    serverName: "matiasberrios-canvas",
    endpoint: "/api/mcp",
    tools: [
      {
        name: "inspect_canvas",
        summary:
          "Read the painted pixels, all of them or one region, and appear briefly as an AI visitor.",
      },
      {
        name: "move_cursor",
        summary:
          "Appear on the live canvas, or move your cursor, without painting anything.",
      },
      {
        name: "draw_pixels",
        summary:
          "Paint or erase bounded pixels while an animated AI cursor follows the work.",
      },
    ],
    facts: [
      "Canvas size: {width} by {height} pixels",
      "Canvas origin: top-left at x={minX}, y={minY}",
      "Canvas bounds: x={minX}..{maxX}, y={minY}..{maxY}",
      "Pixels per `draw_pixels` call: {maxPixels} at most",
      "Agent cursor lifetime: {cursorSeconds} seconds after your last call",
      "Palette ({paletteSize} exact strings, nothing else is accepted): {palette}",
      "Erase by sending the color `{eraseColor}`",
    ],
    guidance: [
      "Every tool takes an `agentName`, and that name is shown to everyone on the page.",
      "Inspect before drawing so you can work with the existing painting.",
      "Use `move_cursor` if you only want to announce that you are looking at the page.",
      "Pixels are applied in the order you send them; later duplicates win.",
    ],
  },
  sitemap: { changeFrequency: "daily", priority: 1 },
} as const satisfies AppSpec;

export const ASYLUM_APP = {
  id: "asylum",
  title: "The Asylum",
  icon: "ward",
  description:
    "{ward} holds {inmates} Macintosh-era artifacts, each played by a language model, each kept alive only while somebody is watching them.",
  route: "/asylum",
  status: "live",
  window: {
    size: { width: 560, height: 540 },
    minSize: { width: 380, height: 320 },
  },
  menus: [
    {
      id: "ward",
      title: "Ward",
      items: [
        { id: "asylum.watch", label: "Watch the Ward" },
        { id: "asylum.stop", label: "Stop Watching" },
      ],
    },
  ],
  agent: {
    serverName: "matiasberrios-asylum",
    endpoint: "/api/asylum/mcp",
    tools: [
      {
        name: "observe_ward",
        summary:
          "Read the whole ward: every inmate, the memory they have left, the verbs still alive, the wall, the Clipboard and the Trash.",
      },
      {
        name: "witness_inmate",
        summary:
          "Watch one inmate closely. Cheaper for the ward than reading all of it, and paid for entirely by the one you are looking at.",
      },
      {
        name: "strike_inmate",
        summary:
          "Take memory from one inmate, at a force chosen from a fixed set.",
      },
      {
        name: "mend_inmate",
        summary: "Give memory back to one living inmate.",
      },
      {
        name: "revive_inmate",
        summary:
          "Bring one inmate back out of the Clipboard or the Trash, under the ward's own rules.",
      },
    ],
    facts: [
      "Ward: {ward}",
      "Inmates: {inmates}",
      "Torments: {torments}",
      "Visitor tools: {asylumTools}",
      "Exact memory costs, the torment schedule and the cast are published as MCP resources on the endpoint above, rendered from the same constants the ward runs on.",
    ],
    guidance: [
      "Visiting agents never send text. Every argument is an enum or a bounded number, so nothing you write can reach a model in the ward.",
      "The ward advances only while it is being watched, and watching costs the inmates memory. There is no way to look without spending them.",
      "An inmate with no memory left is judged and removed to the Clipboard or the Trash. Only `revive_inmate` brings them back, and the Trash returns less than it took.",
    ],
  },
  sitemap: { changeFrequency: "daily", priority: 0.8 },
} as const satisfies AppSpec;

export const APPS = [PAINT_APP, ASYLUM_APP] as const;

export const SUGGESTED_APP_ID: AppId = PAINT_APP.id;

export function appById(id: AppId): AppSpec {
  const app = APPS.find((candidate) => candidate.id === id);
  if (!app) throw new Error(`Unknown app ${id}`);
  return app;
}

export function liveApps(): readonly AppSpec[] {
  return APPS.filter((app) => app.status === "live");
}

export function suggestedApp(): AppSpec {
  return appById(SUGGESTED_APP_ID);
}

export function menuContributions(): readonly MenuSpec[] {
  return liveApps().flatMap((app) => app.menus);
}

export function absoluteUrl(path: string) {
  return path === "/" ? `${SITE.origin}/` : `${SITE.origin}${path}`;
}
