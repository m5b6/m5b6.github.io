import { renderMcpJson } from "@/lib/apps/discovery";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderMcpJson(), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
