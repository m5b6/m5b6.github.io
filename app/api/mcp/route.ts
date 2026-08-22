import { canvasMcpHandler } from "@/lib/mcp/canvas-server";
import { preflight, withCors } from "@/lib/mcp/with-cors";
import { withRateLimit } from "@/lib/mcp/with-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = withCors(withRateLimit(canvasMcpHandler));

export { handler as GET, handler as POST, preflight as OPTIONS };
