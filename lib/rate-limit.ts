import "server-only";

import { createHash } from "node:crypto";
import { CANVAS_ROOM_ID } from "@/lib/canvas";

export type RateLimitTier = { windowSeconds: number; limit: number };

export const PRODUCTION_CLEAR_LIMITS: readonly RateLimitTier[] = [
  { windowSeconds: 3_600, limit: 2 },
  { windowSeconds: 86_400, limit: 5 },
];

const PREVIEW_CLEAR_LIMITS: readonly RateLimitTier[] = [
  { windowSeconds: 60, limit: 60 },
];

export function isProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function clearRateLimits() {
  return isProduction() ? PRODUCTION_CLEAR_LIMITS : PREVIEW_CLEAR_LIMITS;
}

function fingerprintSalt() {
  const salt = process.env.CANVAS_IP_SALT;

  if (salt) return salt;

  if (isProduction()) {
    throw new Error("CANVAS_IP_SALT is required in production");
  }

  return CANVAS_ROOM_ID;
}

export function clientFingerprint(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "local";

  return createHash("sha256")
    .update(`${fingerprintSalt()}:${address}`)
    .digest("hex")
    .slice(0, 32);
}
