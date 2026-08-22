import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_CLEAR_LIMITS,
  clearRateLimits,
} from "@/lib/rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("clear rate limits", () => {
  it("stays strict in production, because one clear wipes the whole canvas", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    expect(clearRateLimits()).toEqual(PRODUCTION_CLEAR_LIMITS);
    expect(PRODUCTION_CLEAR_LIMITS[0]).toEqual({
      windowSeconds: 3_600,
      limit: 2,
    });
    expect(PRODUCTION_CLEAR_LIMITS[1]).toEqual({
      windowSeconds: 86_400,
      limit: 5,
    });
  });

  it("never lets a day allow more clears than an hour tier would", () => {
    const [hourly, daily] = PRODUCTION_CLEAR_LIMITS;

    expect(daily.limit).toBeLessThan(hourly.limit * 24);
  });

  it("relaxes outside production so the canvas stays testable", () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(clearRateLimits()[0].limit).toBeGreaterThan(
      PRODUCTION_CLEAR_LIMITS[0].limit,
    );
  });
});
