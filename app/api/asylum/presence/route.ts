import { guardWardWrite, presenceRequestSchema, watchWard } from "@/lib/asylum/engine";
import { clientFingerprint } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = presenceRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid ward presence" }, { status: 400 });
  }

  try {
    const limit = await guardWardWrite(`asylum:${clientFingerprint(request)}`);

    if (!limit.allowed) {
      return Response.json(
        { error: "Too many ward heartbeats" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const outcome = await watchWard(parsed.data.spectator);

    return Response.json(
      {
        persisted: outcome.persisted,
        status: outcome.status,
        revision: outcome.revision,
        ticks: outcome.ticks,
        spectators: outcome.spectators,
        state: outcome.state,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Ward storage unavailable" }, { status: 503 });
  }
}
