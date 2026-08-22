const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS =
  "content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id";
const EXPOSED_HEADERS = "mcp-session-id, mcp-protocol-version";
const MAX_AGE = "86400";

export function corsHeaders(request: Request) {
  const requested = request.headers.get("access-control-request-headers");

  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-allow-headers": requested ?? ALLOWED_HEADERS,
    "access-control-expose-headers": EXPOSED_HEADERS,
    "access-control-max-age": MAX_AGE,
    vary: "Origin, Access-Control-Request-Headers",
  };
}

export function preflight(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function withCors(
  handler: (request: Request) => Response | Promise<Response>,
) {
  return async (request: Request) => {
    const response = await handler(request);
    const headers = new Headers(response.headers);

    for (const [name, value] of Object.entries(corsHeaders(request))) {
      headers.set(name, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
