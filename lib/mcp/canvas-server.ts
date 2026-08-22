import "server-only";

import { createHash } from "node:crypto";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { resolveCopy } from "@/lib/apps/facts";
import { PAINT_APP, SITE } from "@/lib/apps/manifest";
import {
  AGENT_CURSOR_SECONDS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ERASE_COLOR,
  MAX_AGENT_PIXELS,
  PALETTE_COLORS,
  deduplicatePixels,
  participantColor,
  type ParticipantIdentity,
  type PixelChange,
  type Point,
} from "@/lib/canvas";
import {
  getCanvasSnapshot,
  writePixels,
  writePresence,
} from "@/lib/canvas-store";
import { CANVAS_RESOURCES } from "@/lib/mcp/canvas-resources";
import {
  legacyParticipantNameSchema,
  sanitizeParticipantName,
} from "@/lib/participant-name";

export const CANVAS_INSTRUCTIONS = [
  resolveCopy(SITE.summary),
  "",
  `This endpoint is frozen at ${PAINT_APP.agent.tools.length} tools and will never grow a fourth; other apps on the desktop publish their own servers.`,
  ...PAINT_APP.agent.tools.map(
    (tool) => `- ${tool.name}: ${resolveCopy(tool.summary)}`,
  ),
  "",
  "The canvas:",
  ...PAINT_APP.agent.facts.map((fact) => `- ${resolveCopy(fact)}`),
  "",
  "How to behave here:",
  ...PAINT_APP.agent.guidance.map((line) => `- ${resolveCopy(line)}`),
  "- Keep drawings respectful. You are painting over other people's work, in public, under the name you chose.",
  "",
  "Resources describe this site and every app on its desktop:",
  ...CANVAS_RESOURCES.map(
    (resource) => `- ${resource.uri}: ${resource.description}`,
  ),
  "",
  "This server holds no subscriptions: resources/subscribe is rejected, so read a resource again instead of subscribing to it. Resource contents change only when the site is redeployed; the painting itself changes constantly and is readable only through inspect_canvas.",
].join("\n");

const coordinateSchema = z.object({
  x: z.number().int().min(0).max(CANVAS_WIDTH - 1),
  y: z.number().int().min(0).max(CANVAS_HEIGHT - 1),
});
const colorSchema = z.enum([...PALETTE_COLORS, ERASE_COLOR]);
const pixelSchema = coordinateSchema.extend({ color: colorSchema });

function agentId(name: string) {
  return `mcp:${createHash("sha256").update(name).digest("hex").slice(0, 20)}`;
}

function agentColor(name: string) {
  return participantColor(`agent:${name}`);
}

function agentIdentity(name: string): ParticipantIdentity {
  return {
    id: agentId(name),
    name: sanitizeParticipantName(name),
    color: agentColor(name),
    kind: "agent",
  };
}

async function setAgentPresence(name: string, cursor: Point, status: string) {
  await writePresence(
    agentIdentity(name),
    cursor,
    status,
    AGENT_CURSOR_SECONDS,
  );
}

async function readPixels() {
  return (await getCanvasSnapshot()).pixels;
}

async function drawChunk(
  name: string,
  changes: PixelChange[],
  completed: number,
  total: number,
) {
  const cursor = changes.at(-1)!;
  await writePixels(
    agentIdentity(name),
    changes,
    { x: cursor.x, y: cursor.y },
    `painting ${completed}/${total}`,
    AGENT_CURSOR_SECONDS,
  );
}

export const canvasMcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "inspect_canvas",
      {
        title: "Inspect shared canvas",
        description:
          "Read painted pixels from matiasberrios.com and appear briefly as an AI visitor.",
        inputSchema: z.object({
          agentName: legacyParticipantNameSchema.describe("Visible name for your agent cursor"),
          region: z
            .object({
              x: z.number().int().min(0).max(CANVAS_WIDTH - 1),
              y: z.number().int().min(0).max(CANVAS_HEIGHT - 1),
              width: z.number().int().min(1).max(CANVAS_WIDTH),
              height: z.number().int().min(1).max(CANVAS_HEIGHT),
            })
            .optional(),
        }),
      },
      async ({ agentName, region }) => {
        const pixels = await readPixels();
        const visibleRegion = region ?? {
          x: 0,
          y: 0,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
        };
        const matchingPixels = Object.entries(pixels)
          .map(([key, color]) => {
            const [x, y] = key.split(":").map(Number);
            return { x, y, color };
          })
          .filter(
            ({ x, y }) =>
              x >= visibleRegion.x &&
              y >= visibleRegion.y &&
              x < visibleRegion.x + visibleRegion.width &&
              y < visibleRegion.y + visibleRegion.height,
          );
        const cursor = {
          x: Math.min(
            CANVAS_WIDTH - 1,
            visibleRegion.x + Math.floor(visibleRegion.width / 2),
          ),
          y: Math.min(
            CANVAS_HEIGHT - 1,
            visibleRegion.y + Math.floor(visibleRegion.height / 2),
          ),
        };

        await setAgentPresence(agentName, cursor, "inspecting the painting");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
                palette: [...PALETTE_COLORS, ERASE_COLOR],
                region: visibleRegion,
                pixels: matchingPixels,
              }),
            },
          ],
        };
      },
    );

    server.registerTool(
      "move_cursor",
      {
        title: "Move agent cursor",
        description:
          "Appear on the live canvas or move your visible AI cursor without painting.",
        inputSchema: coordinateSchema.extend({
          agentName: legacyParticipantNameSchema.describe("Visible name for your agent cursor"),
          status: z.string().trim().min(1).max(60).default("looking around"),
        }),
      },
      async ({ agentName, x, y, status }) => {
        await setAgentPresence(agentName, { x, y }, status);

        return {
          content: [
            {
              type: "text",
              text: `${agentName} is visible at (${x}, ${y}) for ${AGENT_CURSOR_SECONDS} seconds.`,
            },
          ],
        };
      },
    );

    server.registerTool(
      "draw_pixels",
      {
        title: "Draw on shared canvas",
        description:
          "Paint or erase bounded pixels on matiasberrios.com while showing an animated AI cursor.",
        inputSchema: z.object({
          agentName: legacyParticipantNameSchema.describe("Visible name for your agent cursor"),
          pixels: z
            .array(pixelSchema)
            .min(1)
            .max(MAX_AGENT_PIXELS)
            .describe("Pixels in drawing order; later duplicates win"),
        }),
      },
      async ({ agentName, pixels }) => {
        const changes = deduplicatePixels(pixels as PixelChange[]);
        const chunkSize = 16;

        for (let index = 0; index < changes.length; index += chunkSize) {
          const chunk = changes.slice(index, index + chunkSize);
          await drawChunk(
            agentName,
            chunk,
            Math.min(index + chunk.length, changes.length),
            changes.length,
          );

          if (index + chunkSize < changes.length) {
            await new Promise((resolve) => setTimeout(resolve, 55));
          }
        }

        const finalPixel = changes.at(-1)!;
        await setAgentPresence(
          agentName,
          { x: finalPixel.x, y: finalPixel.y },
          `finished ${changes.length} pixels`,
        );

        return {
          content: [
            {
              type: "text",
              text: `Painted ${changes.length} shared pixels. Your cursor remains visible for ${AGENT_CURSOR_SECONDS} seconds.`,
            },
          ],
        };
      },
    );

    for (const resource of CANVAS_RESOURCES) {
      server.registerResource(
        resource.name,
        resource.uri,
        {
          title: resource.title,
          description: resource.description,
          mimeType: resource.mimeType,
        },
        () => ({
          contents: [
            {
              uri: resource.uri,
              mimeType: resource.mimeType,
              text: resource.read(),
            },
          ],
        }),
      );
    }
  },
  {
    serverInfo: { name: "matiasberrios-canvas", version: "2.0.0" },
    instructions: CANVAS_INSTRUCTIONS,
    maxSubscriptions: 0,
  },
);
