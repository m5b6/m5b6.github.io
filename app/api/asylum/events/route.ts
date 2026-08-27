import { connectAsylumEvents, isAsylumConfigured } from "@/lib/asylum/store";
import { listenStream } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export function GET(request: Request) {
  if (!isAsylumConfigured()) {
    return Response.json({ error: "Live ward events unavailable" }, { status: 503 });
  }

  return listenStream(connectAsylumEvents, request.signal);
}
