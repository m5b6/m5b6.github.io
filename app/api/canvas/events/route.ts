import { connectCanvasEvents } from "@/lib/canvas-store";
import { listenStream } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export function GET(request: Request) {
  return listenStream(connectCanvasEvents, request.signal);
}
