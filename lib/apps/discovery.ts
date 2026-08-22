import { resolveCopy } from "@/lib/apps/facts";
import {
  absoluteUrl,
  APPS,
  DISCOVERY_PATHS,
  liveApps,
  SITE,
  suggestedApp,
  type AppSpec,
} from "@/lib/apps/manifest";

export type McpClientConfig = {
  mcpServers: Record<string, { url: string }>;
};

export type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: AppSpec["sitemap"]["changeFrequency"];
  priority: number;
};

function section(app: AppSpec) {
  const heading =
    app.status === "live" ? app.title : `${app.title} (not open yet)`;
  const endpoint =
    app.status === "live"
      ? `- MCP endpoint: ${absoluteUrl(app.agent.endpoint)}`
      : "- MCP endpoint: none yet. This file will name it the day it opens.";
  const page =
    app.status === "live" ? [`- Page: ${absoluteUrl(app.route)}`] : [];
  const tools = app.agent.tools.map(
    (tool) => `- Tool \`${tool.name}\`: ${tool.summary}`,
  );

  return [
    `## ${heading}`,
    "",
    resolveCopy(app.description),
    "",
    ...page,
    endpoint,
    ...tools,
    ...app.agent.facts.map((fact) => `- ${resolveCopy(fact)}`),
    ...app.agent.guidance.map((line) => `- ${resolveCopy(line)}`),
  ].join("\n");
}

export function renderLlmsTxt() {
  const pages = [
    `- [Homepage](${absoluteUrl(suggestedApp().route)}): shared painting and live presence`,
    `- [MCP configuration](${absoluteUrl(DISCOVERY_PATHS.configuration)}): ready-to-copy client configuration`,
    `- [Agent instructions](${absoluteUrl(DISCOVERY_PATHS.instructions)}): this file`,
  ];

  return [
    `# ${SITE.name}`,
    "",
    `> ${resolveCopy(SITE.summary)}`,
    "",
    resolveCopy(SITE.desktop),
    "",
    "## Connecting",
    "",
    `- Client configuration: ${absoluteUrl(DISCOVERY_PATHS.configuration)}`,
    `- Transport: ${SITE.transport}`,
    `- Suggested app: ${suggestedApp().title}`,
    "",
    ...APPS.map((app) => `${section(app)}\n`),
    "## Pages",
    "",
    ...pages,
    "",
    resolveCopy(SITE.closing),
    "",
  ].join("\n");
}

export function mcpClientConfig(): McpClientConfig {
  return {
    mcpServers: Object.fromEntries(
      liveApps().map((app) => [
        app.agent.serverName,
        { url: absoluteUrl(app.agent.endpoint) },
      ]),
    ),
  };
}

export function renderMcpJson() {
  return `${JSON.stringify(mcpClientConfig(), null, 2)}\n`;
}

export function renderRobotsTxt() {
  return [
    `# ${SITE.name}`,
    `# Agent instructions: ${absoluteUrl(DISCOVERY_PATHS.instructions)}`,
    `# MCP configuration: ${absoluteUrl(DISCOVERY_PATHS.configuration)}`,
    "",
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${absoluteUrl(DISCOVERY_PATHS.sitemap)}`,
    "",
  ].join("\n");
}

export function sitemapEntries(lastModified: Date): SitemapEntry[] {
  return liveApps().map((app) => ({
    url: absoluteUrl(app.route),
    lastModified,
    changeFrequency: app.sitemap.changeFrequency,
    priority: app.sitemap.priority,
  }));
}
