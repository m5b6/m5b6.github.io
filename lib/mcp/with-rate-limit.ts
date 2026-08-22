import "server-only";

import { consumeRateLimit } from "@/lib/canvas-store";
import { clientFingerprint } from "@/lib/rate-limit";

export const MCP_RATE_LIMITS = [
  { windowSeconds: 60, limit: 60 },
  { windowSeconds: 3_600, limit: 600 },
] as const;

function throttled(retryAfter: number) {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Too many calls from this address. The canvas is shared; slow down and try again.",
      },
      id: null,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export function withRateLimit(
  handler: (request: Request) => Response | Promise<Response>,
) {
  return async (request: Request) => {
    if (request.method !== "POST") return handler(request);

    const bucket = `mcp:${clientFingerprint(request)}`;

    for (const { windowSeconds, limit } of MCP_RATE_LIMITS) {
      const { allowed } = await consumeRateLimit(bucket, windowSeconds, limit);

      if (!allowed) return throttled(windowSeconds);
    }

    return handler(request);
  };
}
