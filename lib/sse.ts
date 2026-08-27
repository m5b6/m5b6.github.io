import "server-only";

import type { Client } from "pg";

const CLIENT_HEARTBEAT_MS = 15_000;
const LISTEN_KEEPALIVE_MS = 30_000;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/**
 * A Postgres LISTEN rendered as an event stream.
 *
 * The stream opens immediately so a visitor is never left waiting on a scaled-to-zero
 * database for the first byte, but `ready` is only sent once the LISTEN is attached. The
 * client turns "Live" on `ready` and then expects the very next NOTIFY, so announcing it
 * early would silently drop other people's strokes.
 *
 * The listening connection is also kept alive, because Neon drops an idle one and a dropped
 * LISTEN is a stream that stays open and never delivers again.
 */
export function listenStream(
  connect: () => Promise<Client>,
  signal: AbortSignal,
) {
  const encoder = new TextEncoder();
  let client: Client | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;
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
        if (keepalive) clearInterval(keepalive);
        client?.removeAllListeners();
        void client?.end();
        try {
          controller.close();
        } catch {}
      };

      closeStream = cleanup;
      signal.addEventListener("abort", cleanup, { once: true });
      heartbeat = setInterval(() => send(": keepalive\n\n"), CLIENT_HEARTBEAT_MS);
      send("retry: 1000\n: opening\n\n");

      void connect()
        .then((connected) => {
          if (closed) {
            void connected.end();
            return;
          }

          client = connected;
          connected.on("notification", (message) => {
            if (message.payload) send(`data: ${message.payload}\n\n`);
          });
          connected.on("error", cleanup);
          send(`data: {"type":"ready"}\n\n`);
          keepalive = setInterval(() => {
            connected.query("SELECT 1").catch(cleanup);
          }, LISTEN_KEEPALIVE_MS);
        })
        .catch(cleanup);
    },
    cancel() {
      closeStream?.();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
