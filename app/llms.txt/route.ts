import { renderLlmsTxt } from "@/lib/apps/discovery";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
