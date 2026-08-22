import {
  consumeRateLimit,
  emptyTrash,
  listTrash,
  restoreTrash,
} from "@/lib/canvas-store";
import { clearRateLimits, clientFingerprint } from "@/lib/rate-limit";
import { trashRequestSchema, type TrashSnapshot } from "@/lib/trash";

export async function GET() {
  try {
    const entries = await listTrash();
    return Response.json({ entries } satisfies TrashSnapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Canvas storage unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = trashRequestSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: "Invalid trash operation" }, { status: 400 });
  }

  const bucket = `trash:${result.data.action}:${clientFingerprint(request)}`;

  for (const { windowSeconds, limit } of clearRateLimits()) {
    try {
      const { allowed } = await consumeRateLimit(bucket, windowSeconds, limit);
      if (allowed) continue;
    } catch {
      return Response.json({ error: "Canvas storage unavailable" }, { status: 503 });
    }

    return Response.json(
      { error: "Too many trash operations" },
      { status: 429, headers: { "Retry-After": String(windowSeconds) } },
    );
  }

  try {
    if (result.data.action === "empty") {
      const discarded = await emptyTrash();
      return Response.json({ ok: true, discarded });
    }

    const restored = await restoreTrash(
      result.data.participant.id,
      result.data.revision,
    );

    if (!restored.restored) {
      return Response.json({ error: "The Trash is empty" }, { status: 409 });
    }

    return Response.json({
      ok: true,
      revision: restored.revision,
      pixelCount: restored.pixelCount,
    });
  } catch {
    return Response.json({ error: "Trash write failed" }, { status: 503 });
  }
}
