import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { absoluteUrl, PAINT_APP } from "../lib/apps/manifest";

const goldenContract = JSON.parse(
  readFileSync(
    join(__dirname, "__golden__", "legacy-mcp-contract.json"),
    "utf8",
  ),
) as { tools: { name: string }[] };

const FROZEN_TOOLS = ["inspect_canvas", "move_cursor", "draw_pixels"];
const SERVER_INFO = { name: "matiasberrios-canvas", version: "2.0.0" };
const PROTOCOL_VERSION = "2025-06-18";
const RESOURCE_URIS = [
  "canvas://site",
  "canvas://apps",
  "canvas://palette",
  "canvas://apps/paint",
  "canvas://apps/asylum",
];

type JsonRpcMessage = {
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

type McpReply = {
  status: number;
  headers: Record<string, string>;
  sessionId?: string;
  messages: JsonRpcMessage[];
};

function parseMcpBody(contentType: string, body: string): JsonRpcMessage[] {
  if (contentType.includes("text/event-stream")) {
    return body
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim()) as JsonRpcMessage);
  }

  return body.trim() ? [JSON.parse(body) as JsonRpcMessage] : [];
}

async function post(
  request: APIRequestContext,
  body: Record<string, unknown>,
  sessionId?: string,
): Promise<McpReply> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const response = await request.post("/api/mcp", { headers, data: body });
  const responseHeaders = response.headers();

  return {
    status: response.status(),
    headers: responseHeaders,
    sessionId: responseHeaders["mcp-session-id"],
    messages: parseMcpBody(
      responseHeaders["content-type"] ?? "",
      await response.text(),
    ),
  };
}

async function initialize(request: APIRequestContext) {
  const reply = await post(request, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "contract-test", version: "1.0.0" },
    },
  });

  expect(reply.status).toBe(200);
  expect(reply.messages[0]?.error).toBeUndefined();
  await post(
    request,
    { jsonrpc: "2.0", method: "notifications/initialized" },
    reply.sessionId,
  );

  return reply;
}

async function readResource(
  request: APIRequestContext,
  uri: string,
  sessionId?: string,
) {
  const reply = await post(
    request,
    { jsonrpc: "2.0", id: 20, method: "resources/read", params: { uri } },
    sessionId,
  );
  const contents = (
    reply.messages[0]?.result as
      | { contents?: { uri: string; mimeType: string; text: string }[] }
      | undefined
  )?.contents;

  expect(contents, uri).toHaveLength(1);
  expect(contents![0].uri).toBe(uri);
  return contents![0];
}

test("freezes the legacy MCP tool contract", async ({ request }) => {
  const handshake = await initialize(request);
  expect(handshake.messages[0]?.result?.serverInfo).toEqual(SERVER_INFO);

  const listed = await post(
    request,
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    handshake.sessionId,
  );

  expect(listed.status).toBe(200);
  expect(listed.messages[0]?.result).toEqual(goldenContract);

  const tools = (listed.messages[0]?.result as { tools: { name: string }[] })
    .tools;
  expect(tools.map((tool) => tool.name)).toEqual(FROZEN_TOOLS);
  expect(tools).toHaveLength(3);
  expect(goldenContract.tools.map((tool) => tool.name)).toEqual(FROZEN_TOOLS);
});

test("tells agents the truth about subscriptions", async ({ request }) => {
  const handshake = await initialize(request);
  const instructions = handshake.messages[0]?.result?.instructions as string;

  expect(instructions).toContain("resources/subscribe is rejected");
  expect(handshake.messages[0]?.result?.capabilities).not.toHaveProperty(
    "resources.subscribe",
  );

  const subscribed = await post(
    request,
    {
      jsonrpc: "2.0",
      id: 3,
      method: "resources/subscribe",
      params: { uri: RESOURCE_URIS[0] },
    },
    handshake.sessionId,
  );

  expect(subscribed.messages[0]?.error).toBeDefined();
  expect(subscribed.messages[0]?.result).toBeUndefined();
});

test("answers a browser preflight and labels cross-origin replies", async ({
  request,
}) => {
  const preflight = await request.fetch("/api/mcp", {
    method: "OPTIONS",
    headers: {
      origin: "https://agent.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type, mcp-session-id",
    },
  });

  expect(preflight.status()).toBe(204);
  const headers = preflight.headers();
  expect(headers["access-control-allow-origin"]).toBe("*");
  expect(headers["access-control-allow-methods"]).toContain("POST");
  expect(headers["access-control-allow-headers"]).toContain("mcp-session-id");
  expect(headers["access-control-expose-headers"]).toContain("mcp-session-id");
  expect(Number(headers["access-control-max-age"])).toBeGreaterThan(0);

  const posted = await request.post("/api/mcp", {
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      origin: "https://agent.example",
    },
    data: {
      jsonrpc: "2.0",
      id: 4,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "browser-agent", version: "1.0.0" },
      },
    },
  });

  expect(posted.status()).toBe(200);
  expect(posted.headers()["access-control-allow-origin"]).toBe("*");
  expect(posted.headers()["access-control-expose-headers"]).toContain(
    "mcp-session-id",
  );
});

test("publishes resources describing the site and its apps", async ({
  request,
}) => {
  const handshake = await initialize(request);
  const listed = await post(
    request,
    { jsonrpc: "2.0", id: 5, method: "resources/list" },
    handshake.sessionId,
  );
  const resources = (
    listed.messages[0]?.result as {
      resources: { uri: string; title: string; mimeType: string }[];
    }
  ).resources;

  expect(resources.map((resource) => resource.uri)).toEqual(RESOURCE_URIS);
  for (const resource of resources) {
    expect(resource.title, resource.uri).toBeTruthy();
    expect(resource.mimeType, resource.uri).toBeTruthy();
  }

  const site = await readResource(request, "canvas://site", handshake.sessionId);
  expect(site.mimeType).toBe("text/markdown");
  expect(site.text).toContain("Canvas bounds: x=0..319, y=0..179");

  const palette = await readResource(
    request,
    "canvas://palette",
    handshake.sessionId,
  );
  const paletteJson = JSON.parse(palette.text) as {
    canvas: { width: number; height: number; maxX: number; maxY: number };
    colors: { color: string; name: string }[];
  };
  expect(paletteJson.canvas).toEqual({
    width: 320,
    height: 180,
    minX: 0,
    minY: 0,
    maxX: 319,
    maxY: 179,
  });
  expect(paletteJson.colors.length).toBeGreaterThan(0);
  expect(paletteJson.colors[0]).toHaveProperty("name");

  const paint = await readResource(
    request,
    "canvas://apps/paint",
    handshake.sessionId,
  );
  const paintJson = JSON.parse(paint.text) as {
    page: string;
    mcp: { serverName: string; url: string };
    tools: { name: string }[];
  };
  expect(paintJson.page).toBe(absoluteUrl(PAINT_APP.route));
  expect(paintJson.mcp).toEqual({
    serverName: PAINT_APP.agent.serverName,
    url: absoluteUrl(PAINT_APP.agent.endpoint),
  });
  expect(paintJson.tools.map((tool) => tool.name)).toEqual(FROZEN_TOOLS);
});
