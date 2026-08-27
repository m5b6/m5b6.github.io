import { timingSafeEqual } from "node:crypto";
import { tickWard } from "@/lib/asylum/engine";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const offered = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const offeredBytes = Buffer.from(offered);
  const expectedBytes = Buffer.from(expected);

  if (offeredBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(offeredBytes, expectedBytes);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Ward 7 is locked" }, { status: 401 });
  }

  try {
    const outcome = await tickWard();

    return Response.json(
      {
        status: outcome.status,
        persisted: outcome.persisted,
        revision: outcome.revision,
        ticks: outcome.ticks,
        spectators: outcome.spectators,
        tick: outcome.state.tick,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Ward storage unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
