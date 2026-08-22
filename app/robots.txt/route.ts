import { renderRobotsTxt } from "@/lib/apps/discovery";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderRobotsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
