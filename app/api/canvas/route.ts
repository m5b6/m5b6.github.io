import { z } from "zod";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_AGENT_PIXELS,
  PALETTE_COLORS,
} from "@/lib/canvas";
import {
  clearCanvas,
  getCanvasSnapshot,
  writePixels,
  writePresence,
} from "@/lib/canvas-store";

export const dynamic = "force-dynamic";

const participantSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9:-]+$/),
  name: z.string().trim().min(1).max(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(["human", "agent"]),
});
const cursorSchema = z
  .object({
    x: z.number().int().min(0).max(CANVAS_WIDTH - 1),
    y: z.number().int().min(0).max(CANVAS_HEIGHT - 1),
  })
  .nullable();
const colorSchema = z.enum([...PALETTE_COLORS, "transparent"]);
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("presence"),
    participant: participantSchema,
    cursor: cursorSchema,
    status: z.string().trim().max(60).nullable(),
  }),
  z.object({
    action: z.literal("paint"),
    participant: participantSchema,
    cursor: cursorSchema,
    status: z.string().trim().max(60).nullable(),
    pixels: z
      .array(
        z.object({
          x: z.number().int().min(0).max(CANVAS_WIDTH - 1),
          y: z.number().int().min(0).max(CANVAS_HEIGHT - 1),
          color: colorSchema,
        }),
      )
      .min(1)
      .max(MAX_AGENT_PIXELS),
  }),
  z.object({
    action: z.literal("clear"),
    participant: participantSchema,
  }),
]);

export async function GET() {
  try {
    return Response.json(await getCanvasSnapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Canvas storage unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = requestSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: "Invalid canvas operation" }, { status: 400 });
  }

  try {
    let revision: number;

    if (result.data.action === "presence") {
      revision = await writePresence(
        result.data.participant,
        result.data.cursor,
        result.data.status,
      );
    } else if (result.data.action === "paint") {
      revision = await writePixels(
        result.data.participant,
        result.data.pixels as import("@/lib/canvas").PixelChange[],
        result.data.cursor,
        result.data.status,
      );
    } else {
      revision = await clearCanvas();
    }

    return Response.json({ ok: true, revision });
  } catch {
    return Response.json({ error: "Canvas write failed" }, { status: 503 });
  }
}
