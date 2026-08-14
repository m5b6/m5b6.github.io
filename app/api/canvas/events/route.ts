import { connectCanvasEvents } from "@/lib/canvas-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  try {
    const client = await connectCanvasEvents();
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let closeStream: (() => void) | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (value: string) => {
          if (!closed) controller.enqueue(encoder.encode(value));
        };
        const cleanup = () => {
          if (closed) return;
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          client.removeAllListeners();
          void client.end();
          try {
            controller.close();
          } catch {}
        };

        closeStream = cleanup;
        client.on("notification", (message) => {
          if (message.payload) send(`data: ${message.payload}\n\n`);
        });
        client.on("error", cleanup);
        request.signal.addEventListener("abort", cleanup, { once: true });
        heartbeat = setInterval(() => send(": keepalive\n\n"), 15_000);
        send(`retry: 1000\ndata: {"type":"ready"}\n\n`);
      },
      cancel() {
        closeStream?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json({ error: "Live events unavailable" }, { status: 503 });
  }
}
