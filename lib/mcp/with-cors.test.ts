import { describe, expect, it } from "vitest";
import { preflight, withCors } from "@/lib/mcp/with-cors";

function requestWith(headers: Record<string, string> = {}) {
  return new Request("https://matiasberrios.com/api/mcp", {
    method: "OPTIONS",
    headers,
  });
}

describe("mcp cors", () => {
  it("answers a preflight without a body", async () => {
    const response = preflight(requestWith());

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "mcp-session-id",
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "mcp-session-id",
    );
  });

  it("echoes the headers a browser asks to send", () => {
    const response = preflight(
      requestWith({ "access-control-request-headers": "x-custom, accept" }),
    );

    expect(response.headers.get("access-control-allow-headers")).toBe(
      "x-custom, accept",
    );
    expect(response.headers.get("vary")).toContain(
      "Access-Control-Request-Headers",
    );
  });

  it("keeps the wrapped response intact", async () => {
    const wrapped = withCors(
      () =>
        new Response("event: message\ndata: {}\n\n", {
          status: 202,
          headers: {
            "content-type": "text/event-stream",
            "mcp-session-id": "abc",
          },
        }),
    );
    const response = await wrapped(requestWith());

    expect(response.status).toBe(202);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("mcp-session-id")).toBe("abc");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.text()).toBe("event: message\ndata: {}\n\n");
  });
});
