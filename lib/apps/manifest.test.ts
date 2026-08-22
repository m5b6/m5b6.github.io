import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FACT_TOKENS } from "@/lib/apps/facts";
import {
  APPS,
  ASYLUM_APP,
  PAINT_APP,
  SITE,
  absoluteUrl,
  appById,
  liveApps,
  menuContributions,
  suggestedApp,
  type AppSpec,
} from "@/lib/apps/manifest";
import { VISITOR_TOOL_NAMES } from "@/lib/asylum/tools";
import {
  AGENT_CURSOR_SECONDS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_AGENT_PIXELS,
  PALETTE,
} from "@/lib/canvas";

const root = join(import.meta.dirname, "..", "..");
const canvasServer = readFileSync(
  join(root, "lib", "mcp", "canvas-server.ts"),
  "utf8",
);

const publishedNumbers = [
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_WIDTH - 1,
  CANVAS_HEIGHT - 1,
  MAX_AGENT_PIXELS,
  AGENT_CURSOR_SECONDS,
  PALETTE.length,
].map(String);

function registeredTools(source: string) {
  return [...source.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map(
    (match) => match[1],
  );
}

function registeredServerName(source: string) {
  return source.match(/serverInfo:\s*\{\s*name:\s*"([^"]+)"/)?.[1];
}

function pageFile(app: AppSpec) {
  return app.route === "/"
    ? join(root, "app", "page.tsx")
    : join(root, "app", app.route.slice(1), "page.tsx");
}

function copyStrings() {
  return [
    ...Object.values(SITE),
    ...APPS.flatMap((app) => [
      app.title,
      app.description,
      ...app.menus.flatMap((menu) => [
        menu.title,
        ...menu.items.map((item) => item.label),
      ]),
      ...app.agent.tools.map((tool) => tool.summary),
      ...app.agent.facts,
      ...app.agent.guidance,
    ]),
  ];
}

function sorted(values: readonly string[]) {
  return [...values].sort();
}

describe("app registry", () => {
  it("declares each app once, with its own route", () => {
    expect(sorted(APPS.map((app) => app.id))).toEqual(
      sorted([...new Set(APPS.map((app) => app.id))]),
    );
    expect(sorted(APPS.map((app) => app.route))).toEqual(
      sorted([...new Set(APPS.map((app) => app.route))]),
    );

    for (const app of APPS) {
      expect(app.route.startsWith("/"), app.id).toBe(true);
      expect(app.agent.endpoint.startsWith("/api/"), app.id).toBe(true);
      expect(app.window.size.width).toBeGreaterThanOrEqual(
        app.window.minSize.width,
      );
      expect(app.window.size.height).toBeGreaterThanOrEqual(
        app.window.minSize.height,
      );
    }
  });

  it("suggests an app that is live", () => {
    expect(suggestedApp()).toBe(PAINT_APP);
    expect(liveApps()).toContain(suggestedApp());
    expect(appById(ASYLUM_APP.id)).toBe(ASYLUM_APP);
  });

  it("gives every live app a real route file", () => {
    for (const app of liveApps()) {
      expect(existsSync(pageFile(app)), app.route).toBe(true);
    }

    expect(menuContributions().map((menu) => menu.id)).toEqual(
      liveApps().flatMap((app) => app.menus.map((menu) => menu.id)),
    );
  });

  it("documents the canvas server that is actually running", () => {
    expect(existsSync(join(root, "app", "api", "mcp", "route.ts"))).toBe(true);
    expect(registeredServerName(canvasServer)).toBe(PAINT_APP.agent.serverName);
    expect(sorted(registeredTools(canvasServer))).toEqual(
      sorted(PAINT_APP.agent.tools.map((tool) => tool.name)),
    );
    expect(registeredTools(canvasServer)).toHaveLength(3);
  });

  it("documents the asylum visitor tools that actually exist", () => {
    expect(sorted(ASYLUM_APP.agent.tools.map((tool) => tool.name))).toEqual(
      sorted(VISITOR_TOOL_NAMES),
    );
  });

  it("never writes a published number into registry copy", () => {
    for (const copy of copyStrings()) {
      for (const number of publishedNumbers) {
        expect(copy, copy).not.toMatch(new RegExp(`\\b${number}\\b`));
      }
    }
  });

  it("only interpolates facts that exist", () => {
    for (const copy of copyStrings()) {
      for (const [, token] of copy.matchAll(/\{(\w+)\}/g)) {
        expect(Object.keys(FACT_TOKENS), copy).toContain(token);
      }
    }
  });

  it("builds absolute urls from one origin", () => {
    expect(absoluteUrl("/")).toBe(`${SITE.origin}/`);
    expect(absoluteUrl(PAINT_APP.agent.endpoint)).toBe(
      `${SITE.origin}/api/mcp`,
    );
  });
});
