import { asylumMcpHandler } from "@/lib/mcp/asylum-server";
import { preflight, withCors } from "@/lib/mcp/with-cors";
import { withRateLimit } from "@/lib/mcp/with-rate-limit";
import { withWardVisitor } from "@/lib/mcp/with-ward-visitor";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = withCors(withRateLimit(withWardVisitor(asylumMcpHandler)));

export { handler as GET, handler as POST, preflight as OPTIONS };
