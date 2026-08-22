import { renderLlmsTxt } from "@/lib/apps/discovery";
import { CANVAS_FACTS, resolveCopy } from "@/lib/apps/facts";
import {
  absoluteUrl,
  APPS,
  DISCOVERY_PATHS,
  SITE,
  type AppSpec,
} from "@/lib/apps/manifest";
import { PALETTE } from "@/lib/canvas";

export type CanvasResource = {
  name: string;
  uri: string;
  title: string;
  description: string;
  mimeType: string;
  read: () => string;
};

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function appUri(app: AppSpec) {
  return `canvas://apps/${app.id}`;
}

function appSummary(app: AppSpec) {
  return {
    id: app.id,
    title: app.title,
    status: app.status,
    resource: appUri(app),
  };
}

function appDetail(app: AppSpec) {
  const live = app.status === "live";

  return {
    ...appSummary(app),
    description: resolveCopy(app.description),
    page: live ? absoluteUrl(app.route) : null,
    mcp: live
      ? { serverName: app.agent.serverName, url: absoluteUrl(app.agent.endpoint) }
      : null,
    tools: app.agent.tools.map((tool) => ({
      name: tool.name,
      summary: resolveCopy(tool.summary),
    })),
    facts: app.agent.facts.map(resolveCopy),
    guidance: app.agent.guidance.map(resolveCopy),
    menus: app.menus.map((menu) => ({
      title: menu.title,
      items: menu.items.map((item) => item.label),
    })),
  };
}

const siteResource: CanvasResource = {
  name: "site",
  uri: "canvas://site",
  title: SITE.name,
  description:
    "Everything an agent needs to know about this site, in the same words it publishes at /llms.txt.",
  mimeType: "text/markdown",
  read: renderLlmsTxt,
};

const desktopResource: CanvasResource = {
  name: "desktop",
  uri: "canvas://apps",
  title: "Desktop apps",
  description:
    "Every app on the desktop, live or not yet open, with the resource that describes it.",
  mimeType: "application/json",
  read: () =>
    json({
      site: SITE.origin,
      transport: SITE.transport,
      discovery: Object.fromEntries(
        Object.entries(DISCOVERY_PATHS).map(([key, path]) => [
          key,
          absoluteUrl(path),
        ]),
      ),
      apps: APPS.map(appSummary),
    }),
};

const paletteResource: CanvasResource = {
  name: "palette",
  uri: "canvas://palette",
  title: "Canvas palette and bounds",
  description:
    "The exact colors, bounds and per-call limits the drawing tools accept, as machine-readable JSON.",
  mimeType: "application/json",
  read: () =>
    json({
      canvas: {
        width: CANVAS_FACTS.width,
        height: CANVAS_FACTS.height,
        minX: CANVAS_FACTS.minX,
        minY: CANVAS_FACTS.minY,
        maxX: CANVAS_FACTS.maxX,
        maxY: CANVAS_FACTS.maxY,
      },
      maxPixelsPerCall: CANVAS_FACTS.maxPixelsPerCall,
      cursorSeconds: CANVAS_FACTS.cursorSeconds,
      eraseColor: CANVAS_FACTS.eraseColor,
      colors: PALETTE.map(({ color, name }) => ({ color, name })),
    }),
};

const appResources: readonly CanvasResource[] = APPS.map((app) => ({
  name: `app.${app.id}`,
  uri: appUri(app),
  title: app.title,
  description: resolveCopy(app.description),
  mimeType: "application/json",
  read: () => json(appDetail(app)),
}));

export const CANVAS_RESOURCES: readonly CanvasResource[] = [
  siteResource,
  desktopResource,
  paletteResource,
  ...appResources,
];
