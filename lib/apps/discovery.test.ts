import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { GET as instructionsRoute } from "@/app/llms.txt/route";
import { GET as configurationRoute } from "@/app/mcp.json/route";
import { GET as robotsRoute } from "@/app/robots.txt/route";
import {
  mcpClientConfig,
  renderLlmsTxt,
  renderMcpJson,
  renderRobotsTxt,
  sitemapEntries,
} from "@/lib/apps/discovery";
import { ASYLUM_FACTS, resolveCopy } from "@/lib/apps/facts";
import {
  APPS,
  ASYLUM_APP,
  PAINT_APP,
  SITE,
  absoluteUrl,
  liveApps,
} from "@/lib/apps/manifest";
import { ASYLUM_WARD_NAME, CAST, INMATE_IDS } from "@/lib/asylum/cast";
import { createWard } from "@/lib/asylum/world";
import { TORMENTS } from "@/lib/asylum/torments";
import {
  AGENT_CURSOR_SECONDS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ERASE_COLOR,
  MAX_AGENT_PIXELS,
  PALETTE,
  PALETTE_COLORS,
} from "@/lib/canvas";

const root = join(import.meta.dirname, "..", "..");
const instructions = renderLlmsTxt();
const robots = renderRobotsTxt();
const configuration = renderMcpJson();

const generatedSources = [
  ["app", "llms.txt", "route.ts"],
  ["app", "mcp.json", "route.ts"],
  ["app", "robots.txt", "route.ts"],
  ["app", "sitemap.ts"],
  ["lib", "apps", "discovery.ts"],
  ["lib", "apps", "facts.ts"],
];

const dimensionLiterals = [
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_WIDTH - 1,
  CANVAS_HEIGHT - 1,
  MAX_AGENT_PIXELS,
  AGENT_CURSOR_SECONDS,
  PALETTE.length,
].map(String);

const publishedNumbers = [
  ...dimensionLiterals,
  String(CAST.length),
  String(TORMENTS.length),
  "0",
];

const publishedStrings = [
  ...PALETTE_COLORS,
  ASYLUM_WARD_NAME,
  ERASE_COLOR,
  SITE.origin,
];

function withoutPublishedFacts(document: string) {
  const tokens = [...publishedStrings, ...publishedNumbers].sort(
    (left, right) => right.length - left.length,
  );

  return tokens.reduce(
    (text, token) => text.split(token).join(""),
    document,
  );
}

describe("generated discovery documents", () => {
  it("replaces the static files it superseded", () => {
    for (const name of ["llms.txt", "mcp.json", "robots.txt"]) {
      expect(existsSync(join(root, "public", name)), name).toBe(false);
    }
  });

  it("never hardcodes a dimension", () => {
    for (const parts of generatedSources) {
      const source = readFileSync(join(root, ...parts), "utf8");

      for (const literal of dimensionLiterals) {
        expect(source, parts.join("/")).not.toMatch(
          new RegExp(`\\b${literal}\\b`),
        );
      }
    }
  });

  it("publishes the canvas the code actually serves", () => {
    expect(instructions).toContain("MCP endpoint");
    expect(instructions).toContain(
      `Canvas bounds: x=0..${CANVAS_WIDTH - 1}, y=0..${CANVAS_HEIGHT - 1}`,
    );
    expect(instructions).toMatch(new RegExp(`\\b${CANVAS_WIDTH}\\b`));
    expect(instructions).toMatch(new RegExp(`\\b${CANVAS_HEIGHT}\\b`));
    expect(instructions).toMatch(new RegExp(`\\b${MAX_AGENT_PIXELS}\\b`));
    expect(instructions).toMatch(new RegExp(`\\b${AGENT_CURSOR_SECONDS}\\b`));
    expect(instructions).toMatch(new RegExp(`\\b${PALETTE.length}\\b`));
    expect(instructions).toContain(ERASE_COLOR);

    for (const color of PALETTE_COLORS) {
      expect(instructions, color).toContain(color);
    }
  });

  it("publishes the ward the code actually describes", () => {
    expect(instructions).toContain(ASYLUM_WARD_NAME);
    expect(instructions).toMatch(new RegExp(`\\b${CAST.length}\\b`));
    expect(instructions).toMatch(new RegExp(`\\b${TORMENTS.length}\\b`));
  });

  it("publishes the inmate count the ward actually builds", () => {
    expect(ASYLUM_FACTS.inmates).toBe(createWard().inmates.length);
    expect(ASYLUM_FACTS.inmates).not.toBe(INMATE_IDS.length);
  });

  it("names every tool of every app", () => {
    for (const app of APPS) {
      for (const tool of app.agent.tools) {
        expect(instructions, tool.name).toContain(tool.name);
      }
    }
  });

  it("contains no number that is not a published fact", () => {
    for (const document of [instructions, robots, configuration]) {
      expect(withoutPublishedFacts(document)).not.toMatch(/\d/);
    }
  });

  it("resolves every fact it interpolates", () => {
    for (const document of [instructions, robots, configuration]) {
      expect(document).not.toMatch(/\{\w+\}/);
    }

    expect(() => resolveCopy("{nonexistent}")).toThrow(/nonexistent/);
  });

  it("keeps what the previous static file told agents", () => {
    expect(instructions).toContain(`# ${SITE.name}`);
    expect(instructions).toContain(SITE.transport);
    expect(instructions).toContain(absoluteUrl(PAINT_APP.agent.endpoint));
    expect(instructions).toContain(`${SITE.origin}/mcp.json`);
    expect(instructions).toContain("Canvas origin: top-left at x=0, y=0");
    expect(instructions).toContain(SITE.closing);
  });

  it("offers only the endpoints that exist", () => {
    expect(mcpClientConfig()).toEqual({
      mcpServers: {
        "matiasberrios-canvas": {
          url: "https://matiasberrios.com/api/mcp",
        },
        "matiasberrios-asylum": {
          url: "https://matiasberrios.com/api/asylum/mcp",
        },
      },
    });
    expect(Object.keys(mcpClientConfig().mcpServers)).toHaveLength(
      liveApps().length,
    );

    for (const app of APPS) {
      const published = instructions.includes(
        absoluteUrl(app.agent.endpoint),
      );
      expect(published, `${app.id} endpoint`).toBe(app.status === "live");
    }
  });

  it("describes both applications, page and endpoint alike", () => {
    for (const app of [PAINT_APP, ASYLUM_APP]) {
      expect(instructions, app.id).toContain(app.title);
      expect(instructions, app.id).toContain(absoluteUrl(app.route));
      expect(instructions, app.id).toContain(absoluteUrl(app.agent.endpoint));
    }

    expect(sitemap().map((entry) => entry.url)).toEqual([
      absoluteUrl(PAINT_APP.route),
      absoluteUrl(ASYLUM_APP.route),
    ]);
  });

  it("points crawlers at the sitemap and the instructions", () => {
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain(`Sitemap: ${SITE.origin}/sitemap.xml`);
    expect(robots).toContain(`${SITE.origin}/llms.txt`);
  });

  it("lists every live route in the sitemap", () => {
    const modified = new Date();

    expect(sitemapEntries(modified)).toEqual(
      liveApps().map((app) => ({
        url: absoluteUrl(app.route),
        lastModified: modified,
        changeFrequency: app.sitemap.changeFrequency,
        priority: app.sitemap.priority,
      })),
    );
    expect(sitemap().map((entry) => entry.url)).toEqual(
      liveApps().map((app) => absoluteUrl(app.route)),
    );
  });

  it("serves the rendered documents from the route handlers", async () => {
    const documents = [
      [instructionsRoute(), instructions, "text/plain; charset=utf-8"],
      [configurationRoute(), configuration, "application/json; charset=utf-8"],
      [robotsRoute(), robots, "text/plain; charset=utf-8"],
    ] as const;

    for (const [response, body, contentType] of documents) {
      expect(response.headers.get("content-type")).toBe(contentType);
      expect(await response.text()).toBe(body);
    }
  });
});
