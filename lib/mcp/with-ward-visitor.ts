import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { clientFingerprint } from "@/lib/rate-limit";

export type WardVisitor = {
  /** Spectator id for the ward. Matches the engine's enum-safe id shape. */
  id: string;
  /** Rate-limit bucket key. Never the raw address; `clientFingerprint` salts it. */
  address: string;
};

const ANONYMOUS: WardVisitor = { id: "mcp:anonymous", address: "anonymous" };

const visitors = new AsyncLocalStorage<WardVisitor>();

export function wardVisitor(): WardVisitor {
  return visitors.getStore() ?? ANONYMOUS;
}

/**
 * An MCP tool callback never sees the HTTP request, and D1 forbids asking a
 * visiting agent to name itself — a name is free text. The salted address it
 * arrived from is the only identity the ward may have, so the wrapper carries it
 * into the call instead of the body carrying it in.
 */
export function withWardVisitor(
  handler: (request: Request) => Response | Promise<Response>,
) {
  return (request: Request) => {
    const address = clientFingerprint(request);

    return visitors.run({ id: `mcp:${address}`, address }, () =>
      handler(request),
    );
  };
}
